-- Harden battle lifecycle: add state/revision metadata, indexes, transactional matchmaking, and authoritative transition RPC.

-- Add missing lifecycle columns
ALTER TABLE battle_sessions
    ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'queued',
    ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS round_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS round_ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES users(id);

-- Backfill state from status when present
UPDATE battle_sessions
SET state = COALESCE(state, status)
WHERE state IS NULL OR state = '';

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_battle_sessions_state ON battle_sessions(state);
CREATE INDEX IF NOT EXISTS idx_battle_sessions_created_desc ON battle_sessions(created_at DESC);

-- Unique protection for votes (if not already present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_battle_votes_unique ON battle_votes(session_id, user_id, round_number);

-- Authoritative battle state transition RPC
CREATE OR REPLACE FUNCTION battle_transition(
  p_session_id UUID,
  p_target_state TEXT,
  p_actor UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_state TEXT;
  v_revision INTEGER;
  v_allowed BOOLEAN := FALSE;
BEGIN
  -- Lock the session row
  SELECT state, revision INTO v_current_state, v_revision
  FROM battle_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF v_current_state IS NULL THEN
    RAISE EXCEPTION 'battle_not_found';
  END IF;

  -- Guard: actor must be participant or creator
  IF NOT EXISTS (
    SELECT 1 FROM battle_participants WHERE session_id = p_session_id AND user_id = p_actor
  ) AND NOT EXISTS (
    SELECT 1 FROM battle_sessions WHERE id = p_session_id AND creator_id = p_actor
  ) THEN
    RAISE EXCEPTION 'unauthorized_actor';
  END IF;

  -- Allowed transitions (minimal conservative set)
  IF v_current_state = 'queued' AND p_target_state IN ('live_round_1','live') THEN
    v_allowed := TRUE;
  ELSIF v_current_state LIKE 'live%' AND p_target_state IN ('judging','complete','cancelled') THEN
    v_allowed := TRUE;
  ELSIF v_current_state = 'judging' AND p_target_state IN ('complete','cancelled') THEN
    v_allowed := TRUE;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'invalid_transition % -> %', v_current_state, p_target_state;
  END IF;

  UPDATE battle_sessions
  SET state = p_target_state,
      status = p_target_state,
      revision = v_revision + 1,
      round_started_at = COALESCE(round_started_at, NOW())
  WHERE id = p_session_id;

  RETURN jsonb_build_object('ok', true, 'from', v_current_state, 'to', p_target_state, 'revision', v_revision + 1);
END;
$$;

-- Transactional matchmaking + session creation
CREATE OR REPLACE FUNCTION matchmake_pair_and_create_session(
  p_mode TEXT DEFAULT 'freestyle'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self UUID;
  v_other UUID;
  v_self_row matchmaking_queue%ROWTYPE;
  v_other_row matchmaking_queue%ROWTYPE;
  v_session_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_self := auth.uid();
  IF v_self IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Ensure self is queued and lock row
  SELECT * INTO v_self_row
  FROM matchmaking_queue
  WHERE user_id = v_self AND status = 'queued' AND mode = p_mode
  FOR UPDATE;

  IF v_self_row.id IS NULL THEN
    RAISE EXCEPTION 'not_queued';
  END IF;

  -- Find opponent and lock
  SELECT * INTO v_other_row
  FROM matchmaking_queue
  WHERE status = 'queued' AND mode = p_mode AND user_id <> v_self
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_other_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'matched', false, 'queue_id', v_self_row.id);
  END IF;

  -- Create battle session atomically
  INSERT INTO battle_sessions (
    creator_id,
    battle_type,
    format,
    entry_fee_tokens,
    total_rounds,
    current_round,
    status,
    countdown_seconds,
    locked_beat_id,
    winner,
    created_at,
    updated_at,
    state,
    revision
  ) VALUES (
    v_self,
    CASE WHEN p_mode = 'ranked' THEN 'ranked' ELSE 'casual' END,
    '60s',
    0,
    2,
    1,
    'live_round_1',
    0,
    NULL,
    NULL,
    v_now,
    v_now,
    'live_round_1',
    1
  ) RETURNING id INTO v_session_id;

  -- Insert participants
  INSERT INTO battle_participants(session_id, user_id, slot, status, display_name)
  VALUES (v_session_id, v_self, 1, 'connected', 'MC A');

  INSERT INTO battle_participants(session_id, user_id, slot, status, display_name)
  VALUES (v_session_id, v_other_row.user_id, 2, 'connected', 'MC B');

  -- Update queue rows to matched
  UPDATE matchmaking_queue
  SET status = 'matched', battle_id = v_session_id, updated_at = v_now
  WHERE id IN (v_self_row.id, v_other_row.id);

  RETURN jsonb_build_object(
    'ok', true,
    'matched', true,
    'battle_session_id', v_session_id,
    'opponent_user_id', v_other_row.user_id
  );
END;
$$;

-- Convenience indexes for queue
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_mode_status ON matchmaking_queue(mode, status);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_joined_at ON matchmaking_queue(created_at);

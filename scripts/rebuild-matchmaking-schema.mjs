import pg from 'pg';

const { Client } = pg;

async function rebuildMatchmakingSchema() {
  const client = new Client({
    host: 'aws-1-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.xjnxrkdtdfvusofiwshu',
    password: 'kys48wlXoYWDbOEL',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    query_timeout: 30000
  });

  try {
    await client.connect();
    console.log('🔌 Connected to Supabase PostgreSQL');

    // Drop and recreate matchmaking tables with full schema
    const schema = `
-- Drop existing tables
DROP TABLE IF EXISTS public.matchmaking_queue CASCADE;
DROP TABLE IF EXISTS public.battles CASCADE;
DROP TABLE IF EXISTS public.battle_sessions CASCADE;

-- Recreate matchmaking_queue with full schema
CREATE TABLE public.matchmaking_queue (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.users(id),
    queue_type varchar(20) NOT NULL CHECK (queue_type IN ('freestyle', 'ranked', 'tournament')),
    battle_format varchar(20) NOT NULL DEFAULT '60s' CHECK (battle_format IN ('30s', '60s', '90s', '120s')),
    entry_fee integer DEFAULT 0,
    preferred_genres text[] DEFAULT '{}',
    min_elo integer DEFAULT 0,
    max_elo integer DEFAULT 3000,
    status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'matched', 'cancelled')),
    preferences jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    expires_at timestamptz DEFAULT (now() + interval '10 minutes') NOT NULL
);

-- Recreate battles with full schema
CREATE TABLE public.battles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by uuid NOT NULL REFERENCES public.users(id),
    participant_1_id uuid REFERENCES public.users(id),
    participant_2_id uuid REFERENCES public.users(id),
    queue_type varchar(20) NOT NULL CHECK (queue_type IN ('freestyle', 'ranked', 'tournament')),
    battle_format varchar(20) NOT NULL DEFAULT '60s' CHECK (battle_format IN ('30s', '60s', '90s', '120s')),
    entry_fee integer DEFAULT 0,
    prize_pool integer DEFAULT 0,
    beat_id uuid REFERENCES public.beats(id),
    participant_1_beat_id uuid REFERENCES public.beats(id),
    participant_2_beat_id uuid REFERENCES public.beats(id),
    status varchar(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'in_progress', 'completed', 'cancelled')),
    started_at timestamptz,
    completed_at timestamptz,
    expires_at timestamptz DEFAULT (now() + interval '30 minutes'),
    winner_id uuid REFERENCES public.users(id),
    participant_1_score integer DEFAULT 0,
    participant_2_score integer DEFAULT 0,
    participant_1_votes integer DEFAULT 0,
    participant_2_votes integer DEFAULT 0,
    room_id varchar(255),
    livekit_room_id varchar(255),
    recording_url varchar(500),
    processed_url varchar(500),
    egress_id varchar(255),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Recreate battle_sessions
CREATE TABLE public.battle_sessions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    battle_id uuid NOT NULL REFERENCES public.battles(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    livekit_room_name varchar(255) NOT NULL,
    participant_identity varchar(255) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX matchmaking_queue_user_idx ON public.matchmaking_queue(user_id);
CREATE INDEX matchmaking_queue_type_idx ON public.matchmaking_queue(queue_type);
CREATE INDEX matchmaking_queue_status_idx ON public.matchmaking_queue(status);
CREATE INDEX matchmaking_queue_expires_at_idx ON public.matchmaking_queue(expires_at);

CREATE INDEX battles_created_by_idx ON public.battles(created_by);
CREATE INDEX battles_participant_1_idx ON public.battles(participant_1_id);
CREATE INDEX battles_participant_2_idx ON public.battles(participant_2_id);
CREATE INDEX battles_status_idx ON public.battles(status);
CREATE INDEX battles_queue_type_idx ON public.battles(queue_type);

CREATE INDEX battle_sessions_battle_idx ON public.battle_sessions(battle_id);
CREATE INDEX battle_sessions_user_idx ON public.battle_sessions(user_id);

-- Functions
CREATE OR REPLACE FUNCTION public.cleanup_expired_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.matchmaking_queue 
  WHERE expires_at < now();
END;
$$;

CREATE OR REPLACE FUNCTION public.find_match(p_user_id uuid, p_queue_type varchar(20))
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  opponent_id uuid;
  new_battle_id uuid;
BEGIN
  -- Find an opponent
  SELECT user_id INTO opponent_id
  FROM public.matchmaking_queue
  WHERE queue_type = p_queue_type 
    AND user_id != p_user_id
    AND status = 'active'
    AND expires_at > now()
  LIMIT 1;
  
  IF opponent_id IS NOT NULL THEN
    -- Create a battle
    INSERT INTO public.battles (created_by, participant_1_id, participant_2_id, queue_type, battle_format)
    VALUES (p_user_id, p_user_id, opponent_id, p_queue_type, '60s')
    RETURNING id INTO new_battle_id;
    
    -- Update queue entries to matched
    UPDATE public.matchmaking_queue 
    SET status = 'matched', updated_at = now()
    WHERE user_id IN (p_user_id, opponent_id);
    
    RETURN new_battle_id;
  END IF;
  
  RETURN NULL;
END;
$$;

-- RLS policies
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own queue entries
CREATE POLICY "Users can view own queue entries" ON public.matchmaking_queue
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own queue entries
CREATE POLICY "Users can insert own queue entries" ON public.matchmaking_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own queue entries
CREATE POLICY "Users can update own queue entries" ON public.matchmaking_queue
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own queue entries
CREATE POLICY "Users can delete own queue entries" ON public.matchmaking_queue
    FOR DELETE USING (auth.uid() = user_id);

-- Users can view battles they participate in
CREATE POLICY "Users can view own battles" ON public.battles
    FOR SELECT USING (
        auth.uid() = created_by OR 
        auth.uid() = participant_1_id OR 
        auth.uid() = participant_2_id
    );

-- Users can view their own battle sessions
CREATE POLICY "Users can view own battle sessions" ON public.battle_sessions
    FOR SELECT USING (auth.uid() = user_id);
`;

    await client.query(schema);
    console.log('✅ Matchmaking schema rebuilt successfully');

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Schema rebuild failed:', err.message);
    process.exit(1);
  }
}

rebuildMatchmakingSchema();

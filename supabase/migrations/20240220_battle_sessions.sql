-- Battle Sessions Table
CREATE TABLE battle_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  battle_type VARCHAR(20) NOT NULL CHECK (battle_type IN ('ranked', 'casual', 'tournament')),
  format VARCHAR(10) NOT NULL CHECK (format IN ('30s', '60s', '90s')),
  entry_fee_tokens INTEGER NOT NULL DEFAULT 0,
  total_rounds INTEGER NOT NULL DEFAULT 2,
  current_round INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'live_round_1', 'live_round_2', 'judging', 'complete')),
  countdown_seconds INTEGER NOT NULL DEFAULT 0,
  locked_beat_id UUID REFERENCES beats(id),
  winner UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Battle Participants Table
CREATE TABLE battle_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES battle_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  slot INTEGER NOT NULL CHECK (slot IN (1, 2)),
  status VARCHAR(20) NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'ready', 'recording', 'disconnected')),
  display_name VARCHAR(100) NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, slot),
  UNIQUE(session_id, user_id)
);

-- Battle Messages Table
CREATE TABLE battle_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES battle_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Battle Votes Table
CREATE TABLE battle_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES battle_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  round_number INTEGER NOT NULL,
  voted_for UUID NOT NULL REFERENCES users(id),
  timestamp BIGINT NOT NULL,
  UNIQUE(session_id, user_id, round_number),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Battle Recordings Table
CREATE TABLE battle_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES battle_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  round_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  mime_type VARCHAR(50) NOT NULL DEFAULT 'audio/webm',
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Battle Session History Table (for audit trail)
CREATE TABLE battle_session_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES battle_sessions(id),
  event_type VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES users(id),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_battle_sessions_creator ON battle_sessions(creator_id);
CREATE INDEX idx_battle_sessions_status ON battle_sessions(status);
CREATE INDEX idx_battle_sessions_created ON battle_sessions(created_at);
CREATE INDEX idx_battle_participants_session ON battle_participants(session_id);
CREATE INDEX idx_battle_participants_user ON battle_participants(user_id);
CREATE INDEX idx_battle_messages_session ON battle_messages(session_id);
CREATE INDEX idx_battle_messages_timestamp ON battle_messages(timestamp);
CREATE INDEX idx_battle_votes_session ON battle_votes(session_id);
CREATE INDEX idx_battle_votes_round ON battle_votes(session_id, round_number);
CREATE INDEX idx_battle_recordings_session ON battle_recordings(session_id);
CREATE INDEX idx_battle_session_history_session ON battle_session_history(session_id);

-- RLS Policies
ALTER TABLE battle_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_session_history ENABLE ROW LEVEL SECURITY;

-- Battle Sessions RLS
CREATE POLICY "Users can view battle sessions they participate in" ON battle_sessions
  FOR SELECT USING (
    id IN (
      SELECT session_id FROM battle_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert battle sessions" ON battle_sessions
  FOR INSERT WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Users can update battle sessions they created" ON battle_sessions
  FOR UPDATE USING (creator_id = auth.uid());

-- Battle Participants RLS
CREATE POLICY "Users can view participants in sessions they participate in" ON battle_participants
  FOR SELECT USING (
    user_id = auth.uid() OR 
    session_id IN (
      SELECT session_id FROM battle_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own participation" ON battle_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own participation" ON battle_participants
  FOR UPDATE USING (user_id = auth.uid());

-- Battle Messages RLS
CREATE POLICY "Users can view messages in sessions they participate in" ON battle_messages
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM battle_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in sessions they participate in" ON battle_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    session_id IN (
      SELECT session_id FROM battle_participants 
      WHERE user_id = auth.uid()
    )
  );

-- Battle Votes RLS
CREATE POLICY "Users can view votes in sessions they participate in" ON battle_votes
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM battle_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert votes in sessions they participate in" ON battle_votes
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    session_id IN (
      SELECT session_id FROM battle_participants 
      WHERE user_id = auth.uid()
    )
  );

-- Battle Recordings RLS
CREATE POLICY "Users can view recordings in sessions they participate in" ON battle_recordings
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM battle_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own recordings" ON battle_recordings
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Battle Session History RLS
CREATE POLICY "Users can view history for sessions they participate in" ON battle_session_history
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM battle_participants 
      WHERE user_id = auth.uid()
    )
  );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_battle_sessions_updated_at 
  BEFORE UPDATE ON battle_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

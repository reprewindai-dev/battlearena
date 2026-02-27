-- Matchmaking Queue Table
CREATE TABLE matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('freestyle', 'ranked')),
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'matched', 'cancelled')),
  battle_id UUID REFERENCES battle_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, mode)
);

-- Battle Matches Table
CREATE TABLE battle_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL REFERENCES battle_sessions(id) ON DELETE CASCADE,
  user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('freestyle', 'ranked')),
  status VARCHAR(20) NOT NULL DEFAULT 'found' CHECK (status IN ('found', 'expired', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(battle_id)
);

-- Indexes for performance
CREATE INDEX idx_matchmaking_queue_user_mode ON matchmaking_queue(user_id, mode);
CREATE INDEX idx_matchmaking_queue_status_created ON matchmaking_queue(status, created_at);
CREATE INDEX idx_matchmaking_queue_mode_status ON matchmaking_queue(mode, status);
CREATE INDEX idx_battle_matches_status ON battle_matches(status);
CREATE INDEX idx_battle_matches_created ON battle_matches(created_at DESC);

-- RLS Policies
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_matches ENABLE ROW LEVEL SECURITY;

-- Matchmaking Queue RLS
CREATE POLICY "Users can view their own queue entries" ON matchmaking_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own queue entries" ON matchmaking_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queue entries" ON matchmaking_queue
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own queue entries" ON matchmaking_queue
  FOR DELETE USING (auth.uid() = user_id);

-- Battle Matches RLS
CREATE POLICY "Users can view matches they participate in" ON battle_matches
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "System can insert battle matches" ON battle_matches
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update battle matches" ON battle_matches
  FOR UPDATE WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_matchmaking_queue_updated_at 
  BEFORE UPDATE ON matchmaking_queue 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_battle_matches_updated_at 
  BEFORE UPDATE ON battle_matches 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up old queue entries
CREATE OR REPLACE FUNCTION cleanup_old_queue_entries()
RETURNS void AS $$
BEGIN
  -- Cancel queue entries older than 30 minutes
  UPDATE matchmaking_queue 
  SET status = 'cancelled', updated_at = NOW()
  WHERE status = 'queued' 
  AND created_at < NOW() - INTERVAL '30 minutes';
  
  -- Mark expired matches (older than 1 hour)
  UPDATE battle_matches 
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'found' 
  AND created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup function (run every 10 minutes)
-- This would typically be handled by a cron job or pg_cron extension
-- SELECT cron.schedule('cleanup-queue', '*/10 * * * *', 'SELECT cleanup_old_queue_entries();');

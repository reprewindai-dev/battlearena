import pg from 'pg';

const { Client } = pg;

async function updateSchema() {
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

    // Add missing columns and functions
    const updates = `
-- Add battle_format column to matchmaking_queue
ALTER TABLE public.matchmaking_queue 
ADD COLUMN IF NOT EXISTS battle_format varchar(20) DEFAULT '60s' 
CHECK (battle_format IN ('30s', '60s', '90s'));

-- Add status column to battles if missing
ALTER TABLE public.battles 
ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'pending' 
CHECK (status IN ('pending', 'active', 'completed'));

-- Add missing columns to battles
ALTER TABLE public.battles 
ADD COLUMN IF NOT EXISTS round_duration_seconds integer DEFAULT 60,
ADD COLUMN IF NOT EXISTS started_at timestamptz,
ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Cleanup function for expired queue entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.matchmaking_queue 
  WHERE created_at < now() - interval '10 minutes';
END;
$$;

-- Function to find matches
CREATE OR REPLACE FUNCTION public.find_match(p_mode varchar(20), p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_match_id uuid;
  opponent_id uuid;
  new_battle_id uuid;
BEGIN
  -- Find an opponent in the queue
  SELECT user_id INTO opponent_id
  FROM public.matchmaking_queue
  WHERE mode = p_mode 
    AND user_id != p_user_id
  LIMIT 1;
  
  IF opponent_id IS NOT NULL THEN
    -- Create a battle
    INSERT INTO public.battles (mode, status, participants, round_duration_seconds)
    VALUES (p_mode, 'pending', ARRAY[p_user_id, opponent_id], 60)
    RETURNING id INTO new_battle_id;
    
    -- Remove both users from queue
    DELETE FROM public.matchmaking_queue 
    WHERE user_id IN (p_user_id, opponent_id);
    
    RETURN new_battle_id;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Function to check queue status
CREATE OR REPLACE FUNCTION public.get_queue_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  queue_count integer;
  user_in_queue boolean;
  result jsonb;
BEGIN
  SELECT COUNT(*) INTO queue_count
  FROM public.matchmaking_queue;
  
  SELECT EXISTS(
    SELECT 1 FROM public.matchmaking_queue 
    WHERE user_id = p_user_id
  ) INTO user_in_queue;
  
  result := jsonb_build_object(
    'total_in_queue', queue_count,
    'user_in_queue', user_in_queue
  );
  
  RETURN result;
END;
$$;
`;

    await client.query(updates);
    console.log('✅ Schema updates applied successfully');

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Schema update failed:', err.message);
    process.exit(1);
  }
}

updateSchema();

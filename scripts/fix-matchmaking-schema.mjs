import pg from 'pg';

const { Client } = pg;

async function fixMatchmakingSchema() {
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

    // Add missing expires_at column
    const updates = `
-- Add expires_at column to matchmaking_queue
ALTER TABLE public.matchmaking_queue 
ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '10 minutes');

-- Update existing entries to have expires_at
UPDATE public.matchmaking_queue 
SET expires_at = created_at + interval '10 minutes' 
WHERE expires_at IS NULL;

-- Add index on expires_at for performance
CREATE INDEX IF NOT EXISTS matchmaking_queue_expires_at_idx ON public.matchmaking_queue(expires_at);
`;

    await client.query(updates);
    console.log('✅ Matchmaking schema fixes applied successfully');

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Schema fix failed:', err.message);
    process.exit(1);
  }
}

fixMatchmakingSchema();

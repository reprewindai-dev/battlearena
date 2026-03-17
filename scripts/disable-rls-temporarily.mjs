import pg from 'pg';

const { Client } = pg;

async function disableRLSTemporarily() {
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

    // Disable RLS temporarily for testing
    const disableRLS = `
-- Disable RLS for matchmaking (temporarily for testing)
ALTER TABLE public.matchmaking_queue DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.battles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_sessions DISABLE ROW LEVEL SECURITY;
`;

    await client.query(disableRLS);
    console.log('✅ RLS disabled temporarily for testing');

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Failed to disable RLS:', err.message);
    process.exit(1);
  }
}

disableRLSTemporarily();

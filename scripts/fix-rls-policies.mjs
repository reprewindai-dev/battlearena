import pg from 'pg';

const { Client } = pg;

async function fixRLSPolicies() {
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

    // Fix RLS policies for matchmaking
    const policies = `
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own queue entries" ON public.matchmaking_queue;
DROP POLICY IF EXISTS "Users can insert own queue entries" ON public.matchmaking_queue;
DROP POLICY IF EXISTS "Users can update own queue entries" ON public.matchmaking_queue;
DROP POLICY IF EXISTS "Users can delete own queue entries" ON public.matchmaking_queue;

-- Allow authenticated users to manage their own queue entries
CREATE POLICY "Users can manage own queue entries" ON public.matchmaking_queue
    FOR ALL USING (auth.uid() = user_id);

-- Allow authenticated users to view queue entries (for matchmaking)
CREATE POLICY "Users can view queue entries" ON public.matchmaking_queue
    FOR SELECT USING (auth.role() = 'authenticated');

-- Fix battles policies
DROP POLICY IF EXISTS "Users can view own battles" ON public.battles;

CREATE POLICY "Users can view battles" ON public.battles
    FOR SELECT USING (
        auth.role() = 'authenticated' AND (
            auth.uid() = created_by OR 
            auth.uid() = participant_1_id OR 
            auth.uid() = participant_2_id
        )
    );

CREATE POLICY "Users can create battles" ON public.battles
    FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Fix battle_sessions policies
DROP POLICY IF EXISTS "Users can view own battle sessions" ON public.battle_sessions;

CREATE POLICY "Users can manage own battle sessions" ON public.battle_sessions
    FOR ALL USING (auth.uid() = user_id);
`;

    await client.query(policies);
    console.log('✅ RLS policies updated successfully');

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ RLS policy update failed:', err.message);
    process.exit(1);
  }
}

fixRLSPolicies();

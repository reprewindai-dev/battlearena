import pg from 'pg';

const { Client } = pg;

async function fixForeignKey() {
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

    // Check if user exists and create if needed
    const { rows: users } = await client.query(`
      SELECT id, email FROM public.users 
      WHERE id = '00000000-0000-0000-0000-000000000001'
    `);

    if (users.length === 0) {
      console.log('👤 Creating test user for queue operations...');
      await client.query(`
        INSERT INTO public.users (id, email, username)
        VALUES ('00000000-0000-0000-0000-000000000001', 'test@battlearena.com', 'TestUser')
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          username = EXCLUDED.username,
          updated_at = now()
      `);
      console.log('✅ Test user created');
    } else {
      console.log('✅ Test user already exists');
    }

    // Also create in auth.users if needed
    const { rows: authUsers } = await client.query(`
      SELECT id FROM auth.users 
      WHERE id = '00000000-0000-0000-0000-000000000001'
    `);

    if (authUsers.length === 0) {
      console.log('🔐 Creating auth user record...');
      await client.query(`
        INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test@battlearena.com', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('✅ Auth user created');
    } else {
      console.log('✅ Auth user already exists');
    }

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Foreign key fix failed:', err.message);
    process.exit(1);
  }
}

fixForeignKey();

import pg from 'pg';

const { Client } = pg;

async function createTestUsers() {
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

    // Create test users
    const users = [
      { id: '00000000-0000-0000-0000-000000000001', email: 'test1@battlearena.com', username: 'TestUser1' },
      { id: '00000000-0000-0000-0000-000000000002', email: 'test2@battlearena.com', username: 'TestUser2' },
      { id: '00000000-0000-0000-0000-000000000003', email: 'test3@battlearena.com', username: 'TestUser3' },
      { id: '00000000-0000-0000-0000-000000000004', email: 'test4@battlearena.com', username: 'TestUser4' },
    ];

    for (const user of users) {
      await client.query(`
        INSERT INTO public.users (id, email, username)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          username = EXCLUDED.username,
          updated_at = now()
      `, [user.id, user.email, user.username]);
      
      console.log(`✅ Created user: ${user.username}`);
    }

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Test user creation failed:', err.message);
    process.exit(1);
  }
}

createTestUsers();

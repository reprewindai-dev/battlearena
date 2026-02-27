import pg from 'pg';

const { Client } = pg;

async function createPublicUser() {
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

    // Create public user record for the logged-in user
    const userId = '93d4e785-678b-4e1e-92fd-1e9d26efc446';
    
    await client.query(`
      INSERT INTO public.users (id, email, username)
      VALUES ($1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        username = EXCLUDED.username,
        updated_at = now()
    `, [userId, 'test@battlearena.com', 'TestUser']);
    
    console.log('✅ Public user record created/updated');

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Failed to create public user:', err.message);
    process.exit(1);
  }
}

createPublicUser();

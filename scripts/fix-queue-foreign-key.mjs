import pg from 'pg';

const { Client } = pg;

async function fixQueueForeignKey() {
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

    // Check the foreign key constraint
    const { rows: constraints } = await client.query(`
      SELECT tc.constraint_name, tc.table_name, kcu.column_name, 
             ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'matchmaking_queue'
    `);

    console.log('🔍 Foreign key constraints:');
    constraints.forEach(constraint => {
      console.log(`   ${constraint.constraint_name}: ${constraint.column_name} -> ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
    });

    // Check if the user exists in both tables
    const userId = '93d4e785-678b-4e1e-92fd-1e9d26efc446';
    
    const { rows: authUser } = await client.query(`
      SELECT id FROM auth.users WHERE id = $1
    `, [userId]);

    const { rows: publicUser } = await client.query(`
      SELECT id FROM public.users WHERE id = $1
    `, [userId]);

    console.log(`\n👤 User existence check for ${userId}:`);
    console.log(`   Auth users: ${authUser.length > 0 ? '✅ Exists' : '❌ Missing'}`);
    console.log(`   Public users: ${publicUser.length > 0 ? '✅ Exists' : '❌ Missing'}`);

    if (authUser.length === 0) {
      console.log('\n🔐 Creating auth user record...');
      await client.query(`
        INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
        VALUES ($1, 'authenticated', 'authenticated', 'test@battlearena.com', now(), now())
        ON CONFLICT (id) DO NOTHING
      `, [userId]);
      console.log('✅ Auth user created');
    }

    if (publicUser.length === 0) {
      console.log('\n👥 Creating public user record...');
      await client.query(`
        INSERT INTO public.users (id, email, username)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          username = EXCLUDED.username,
          updated_at = now()
      `, [userId, 'test@battlearena.com', 'TestUser']);
      console.log('✅ Public user created');
    }

    // Test queue insertion
    console.log('\n🧪 Testing queue insertion...');
    const { rows: testInsert } = await client.query(`
      INSERT INTO public.matchmaking_queue (user_id, queue_type, battle_format, status)
      VALUES ($1, 'freestyle', '60s', 'active')
      RETURNING id
    `, [userId]);

    console.log(`✅ Queue test successful: ${testInsert[0].id}`);

    // Clean up test
    await client.query(`
      DELETE FROM public.matchmaking_queue WHERE id = $1
    `, [testInsert[0].id]);
    console.log('✅ Test cleaned up');

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Fix failed:', err.message);
    console.error('Details:', err.detail);
    process.exit(1);
  }
}

fixQueueForeignKey();

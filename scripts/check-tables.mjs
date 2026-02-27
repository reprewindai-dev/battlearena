import pg from 'pg';

const { Client } = pg;

async function checkTables() {
  const client = new Client({
    host: 'aws-1-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.xjnxrkdtdfvusofiwshu',
    password: 'kys48wlXoYWDbOEL',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log('🔍 Checking database tables...');
    
    const result = await client.query(`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema IN ('public', 'auth') 
      ORDER BY table_schema, table_name
    `);
    
    console.log('📋 Tables found:');
    result.rows.forEach(row => {
      console.log(`  ${row.table_schema}.${row.table_name}`);
    });
    
    await client.end();
  } catch (err) {
    console.error('❌ Check failed:', err.message);
    process.exit(1);
  }
}

checkTables();

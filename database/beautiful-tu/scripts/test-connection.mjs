import { createSupabasePgClient } from "./lib/supabase-pg-client.mjs";

async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  const client = createSupabasePgClient({
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully');
    
    const result = await client.query('SELECT version()');
    console.log('📊 PostgreSQL version:', result.rows[0].version.split(',')[0]);
    
    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
}

testConnection();

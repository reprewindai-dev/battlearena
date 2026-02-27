import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function loadSchema() {
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

    const schemaPath = path.join(__dirname, '..', 'fix-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('📄 Loaded fix-schema.sql');

    await client.query(schema);
    console.log('✅ Schema loaded successfully');

    // Verify tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'auth' 
      ORDER BY table_name
    `);
    console.log('📋 Auth tables created:', result.rows.map(r => r.table_name));

  } catch (err) {
    console.error('❌ Schema load failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

loadSchema();

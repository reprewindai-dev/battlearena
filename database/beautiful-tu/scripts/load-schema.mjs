import { createSupabasePgClient } from "./lib/supabase-pg-client.mjs";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadSchema() {
  const client = createSupabasePgClient({
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
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

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Client } = pg;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.DATABASE_URL;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Supabase credentials not found in .env.local');
  process.exit(1);
}

// Tables to export (order matters for foreign keys)
const TABLES = [
  'users',
  'user_profiles',
  'user_ratings',
  'user_billing_profiles',
  'beats',
  'battle_participants',
  'battles',
  'battle_recordings',
  'matchmaking_queue',
  'crews',
  'crew_members',
  'mentorships',
  'community_events',
  'community_event_attendees',
  'follows',
  'payment_ledger',
  'token_purchases',
  'token_transactions',
  'payouts',
  'referral_invites',
  'user_referrals',
  'notifications',
  'moderation_cases',
  'moderation_actions',
  'moderation_reports',
  'ai_moderation_flags',
  'user_moderation_history',
  'telemetry_events',
  'idempotency_keys',
  'governance_circuit_breaker_state',
  'fairness_monitoring',
  'red_team_simulations',
  'challenges',
  'admin_audit_log',
  'roles',
  'role_assignments',
  'tournaments',
  'tournament_participants',
  'tournament_brackets',
  'activity_feed'
];

function escapeValue(value) {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    return "'" + value.replace(/'/g, "''").replace(/\\/g, '\\\\') + "'";
  }
  if (value instanceof Date) return "'" + value.toISOString() + "'";
  if (Buffer.isBuffer(value)) return "'\\\\x" + value.toString('hex') + "'";
  return 'NULL';
}

async function exportTable(client, tableName) {
  try {
    // Get column names
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `;
    const columnsResult = await client.query(columnsQuery, [tableName]);
    
    if (columnsResult.rows.length === 0) {
      console.log(`  Table ${tableName}: No columns found (may not exist)`);
      return '';
    }

    const columns = columnsResult.rows.map(r => r.column_name);
    const columnNames = columns.join(', ');

    // Get all data
    const dataQuery = `SELECT * FROM ${tableName}`;
    const dataResult = await client.query(dataQuery);

    if (dataResult.rows.length === 0) {
      console.log(`  Table ${tableName}: 0 rows`);
      return `-- Table ${tableName}: No data\n\n`;
    }

    console.log(`  Table ${tableName}: ${dataResult.rows.length} rows`);

    let sql = `-- Table: ${tableName}\n-- Rows: ${dataResult.rows.length}\n`;
    
    for (const row of dataResult.rows) {
      const values = columns.map(col => escapeValue(row[col])).join(', ');
      sql += `INSERT INTO ${tableName} (${columnNames}) VALUES (${values});\n`;
    }
    sql += '\n';

    return sql;
  } catch (error) {
    console.error(`  Error exporting ${tableName}:`, error.message);
    return `-- Table ${tableName}: Error - ${error.message}\n\n`;
  }
}

async function main() {
  let client;
  
  // Try using the pooler URL with session mode
  let connectionString = DB_URL;
  if (DB_URL?.includes('pooler')) {
    // Add session mode for pooler
    connectionString = DB_URL.replace('postgres://', 'postgres://postgres:pooler@');
  }

  try {
    client = new Client({
      connectionString,
    });

    await client.connect();
    console.log('Connected to Supabase database');
    console.log(`Using URL: ${connectionString.replace(/:[^:]*@/, ':****@')}`);
    console.log('Exporting data...\n');

    let fullExport = `-- Battle Arena Data Export\n`;
    fullExport += `-- Source: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`;
    fullExport += `-- Generated: ${new Date().toISOString()}\n`;
    fullExport += `-- \n`;
    fullExport += `SET session_replication_role = 'replica';\n\n`;

    for (const table of TABLES) {
      const tableData = await exportTable(client, table);
      fullExport += tableData;
    }

    fullExport += `SET session_replication_role = 'origin';\n`;

    // Write to file
    const filename = 'battle-arena-full-data.sql';
    const fs = await import('fs');
    fs.writeFileSync(filename, fullExport, 'utf8');
    console.log(`\n✅ Data exported to ${filename}`);
    console.log(`File size: ${(fullExport.length / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('Export failed:', error.message);
    process.exit(1);
  } finally {
    if (client) await client.end();
  }
}

main();

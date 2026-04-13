import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Supabase credentials not found in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Tables to export
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
  return 'NULL';
}

async function exportTable(tableName) {
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    
    if (error) {
      console.log(`  Table ${tableName}: Error - ${error.message}`);
      return `-- Table ${tableName}: Error - ${error.message}\n\n`;
    }

    if (!data || data.length === 0) {
      console.log(`  Table ${tableName}: 0 rows`);
      return `-- Table ${tableName}: No data\n\n`;
    }

    console.log(`  Table ${tableName}: ${data.length} rows`);

    const columns = Object.keys(data[0]);
    const columnNames = columns.join(', ');

    let sql = `-- Table: ${tableName}\n-- Rows: ${data.length}\n`;
    
    for (const row of data) {
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
  try {
    console.log('Connected to Supabase via REST API');
    console.log(`Project: ${SUPABASE_URL}`);
    console.log('Exporting data...\n');

    let fullExport = `-- Battle Arena Data Export\n`;
    fullExport += `-- Source: ${SUPABASE_URL}\n`;
    fullExport += `-- Generated: ${new Date().toISOString()}\n`;
    fullExport += `-- \n`;
    fullExport += `SET session_replication_role = 'replica';\n\n`;

    for (const table of TABLES) {
      const tableData = await exportTable(table);
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
    console.error('Export failed:', error);
    process.exit(1);
  }
}

main();

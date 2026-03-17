import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env.production" });
config();

const { Client } = pg;

async function checkTables() {
  const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing SUPABASE_DB_URL or DATABASE_URL");
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    console.log("Checking database tables...");

    const result = await client.query(`
      select table_schema, table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name;
    `);

    for (const row of result.rows) {
      console.log(`  ${row.table_schema}.${row.table_name}`);
    }
  } finally {
    await client.end();
  }
}

checkTables().catch((error) => {
  console.error(`check_failed:${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

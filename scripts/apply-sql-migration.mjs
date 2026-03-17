#!/usr/bin/env node

import fs from "fs";
import path from "path";
import pg from "pg";

const { Client } = pg;

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing_env:${name}`);
  }
  return value;
}

async function main() {
  const migrationFile = process.argv[2];
  if (!migrationFile) {
    throw new Error("usage: node scripts/apply-sql-migration.mjs <migration-file>");
  }

  const sqlPath = path.resolve(migrationFile);
  const sql = fs.readFileSync(sqlPath, "utf8");

  const connectionString = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  const client = connectionString
    ? new Client({
        connectionString,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
        query_timeout: 120000,
      })
    : new Client({
        host: required("SUPABASE_DB_HOST"),
        port: Number(process.env.SUPABASE_DB_PORT ?? "6543"),
        database: process.env.SUPABASE_DB_NAME ?? "postgres",
        user: required("SUPABASE_DB_USER"),
        password: required("SUPABASE_DB_PASSWORD"),
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
        query_timeout: 120000,
      });

  await client.connect();
  console.log(`connected:${path.basename(sqlPath)}`);

  try {
    await client.query(sql);
    console.log(`applied:${path.basename(sqlPath)}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`migration_failed:${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

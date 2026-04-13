import pg from "pg";

const { Client } = pg;

export function createSupabasePgClient(overrides = {}) {
  const {
    DATABASE_URL,
    SUPABASE_DB_HOST,
    SUPABASE_DB_PORT,
    SUPABASE_DB_NAME,
    SUPABASE_DB_USER,
    SUPABASE_DB_PASSWORD,
    PGHOST,
    PGPORT,
    PGDATABASE,
    PGUSER,
    PGPASSWORD,
  } = process.env;

  if (DATABASE_URL) {
    return new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      ...overrides,
    });
  }

  const host = SUPABASE_DB_HOST ?? PGHOST;
  const port = Number(SUPABASE_DB_PORT ?? PGPORT ?? 6543);
  const database = SUPABASE_DB_NAME ?? PGDATABASE ?? "postgres";
  const user = SUPABASE_DB_USER ?? PGUSER;
  const password = SUPABASE_DB_PASSWORD ?? PGPASSWORD;

  if (!host || !user || !password) {
    throw new Error(
      "Missing database connection environment. Set DATABASE_URL or SUPABASE_DB_HOST, SUPABASE_DB_USER, and SUPABASE_DB_PASSWORD.",
    );
  }

  return new Client({
    host,
    port,
    database,
    user,
    password,
    ssl: { rejectUnauthorized: false },
    ...overrides,
  });
}

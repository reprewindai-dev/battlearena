import { Pool } from 'pg';

let pool: Pool | null = null;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || databaseUrl === 'mock') {
    throw new Error('DATABASE_URL is required for content-service');
  }

  return databaseUrl;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }

  return pool;
}

export const query = async (text: string, params?: any[]) => {
  return getPool().query(text, params);
};

export const connectDB = async () => {
  try {
    await getPool().query('SELECT NOW()');
    console.log('Connected to PostgreSQL database');
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
    throw error;
  }
};

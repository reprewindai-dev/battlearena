const { Pool } = require('pg');
const Redis = require('redis');
const logger = require('./logger');

// PostgreSQL configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'arena',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis configuration
const redis = Redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      logger.error('Redis server connection refused');
      return new Error('Redis server connection refused');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      logger.error('Redis retry time exhausted');
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      logger.error('Redis retry attempts exhausted');
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

redis.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redis.on('connect', () => {
  logger.info('Redis Client Connected');
});

// Database connection test
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('PostgreSQL Client Error:', err);
});

// Initialize connections
const initializeConnections = async () => {
  try {
    // Test PostgreSQL connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('PostgreSQL connection verified');

    // Test Redis connection
    await redis.connect();
    await redis.ping();
    logger.info('Redis connection verified');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
};

// Graceful shutdown
const closeConnections = async () => {
  try {
    await pool.end();
    await redis.quit();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
};

module.exports = {
  pool,
  redis,
  initializeConnections,
  closeConnections
};

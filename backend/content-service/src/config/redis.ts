import { createClient } from 'redis';

// Mock Redis for local development without Docker
const mockRedis = {
  get: async (key: string) => null,
  set: async (key: string, value: string, ttl?: number) => 'OK',
  del: async (key: string) => 1,
  exists: async (key: string) => 0,
  flushAll: async () => 'OK'
};

// Real Redis connection (when available)
let client: any = null;

export const getCache = async (key: string) => {
  if (process.env.REDIS_URL === 'mock' || !process.env.REDIS_URL) {
    return mockRedis.get(key);
  }
  
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    await client.connect();
  }
  
  return client.get(key);
};

export const setCache = async (key: string, value: string, ttl?: number) => {
  if (process.env.REDIS_URL === 'mock' || !process.env.REDIS_URL) {
    return mockRedis.set(key, value, ttl);
  }
  
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    await client.connect();
  }
  
  if (ttl) {
    return client.setEx(key, ttl, value);
  }
  
  return client.set(key, value);
};

export const deleteCache = async (key: string) => {
  if (process.env.REDIS_URL === 'mock' || !process.env.REDIS_URL) {
    return mockRedis.del(key);
  }
  
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    await client.connect();
  }
  
  return client.del(key);
};

export const connectRedis = async () => {
  if (process.env.REDIS_URL === 'mock' || !process.env.REDIS_URL) {
    console.log('🔌 Using mock Redis (no Redis connection)');
    return;
  }
  
  try {
    if (!client) {
      client = createClient({ url: process.env.REDIS_URL });
    }
    
    await client.connect();
    await client.ping();
    console.log('✅ Connected to Redis');
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    throw error;
  }
};

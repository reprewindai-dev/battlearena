import { createClient, type RedisClientType } from 'redis';

let client: RedisClientType | null = null;

function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl || redisUrl === 'mock') {
    throw new Error('REDIS_URL is required for content-service');
  }

  return redisUrl;
}

async function getClient() {
  if (!client) {
    client = createClient({ url: getRedisUrl() });
  }

  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}

export const getCache = async (key: string) => {
  return (await getClient()).get(key);
};

export const setCache = async (key: string, value: string, ttl?: number) => {
  const redisClient = await getClient();

  if (ttl) {
    return redisClient.setEx(key, ttl, value);
  }

  return redisClient.set(key, value);
};

export const deleteCache = async (key: string) => {
  return (await getClient()).del(key);
};

export const connectRedis = async () => {
  try {
    await (await getClient()).ping();
    console.log('Connected to Redis');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
};

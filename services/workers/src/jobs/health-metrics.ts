import { supabase } from '../lib/supabase';
import { redis } from '../lib/redis';
import { createJobLogger } from '../lib/logger';

const log = createJobLogger('health-metrics');

interface HealthMetrics {
  timestamp: string;
  services: Record<string, ServiceHealth>;
  database: DatabaseHealth;
  redis: RedisHealth;
  queues: QueueHealth;
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  errorRate: number;
}

interface DatabaseHealth {
  connected: boolean;
  latency: number;
  activeConnections: number;
}

interface RedisHealth {
  connected: boolean;
  latency: number;
  memoryUsage: number;
}

interface QueueHealth {
  payouts: QueueStats;
  moderation: QueueStats;
  notifications: QueueStats;
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

const checkDatabaseHealth = async (): Promise<DatabaseHealth> => {
  const start = Date.now();
  try {
    await supabase.from('users').select('id').limit(1);
    return {
      connected: true,
      latency: Date.now() - start,
      activeConnections: 0,
    };
  } catch {
    return { connected: false, latency: -1, activeConnections: 0 };
  }
};

const checkRedisHealth = async (): Promise<RedisHealth> => {
  const start = Date.now();
  try {
    await redis.ping();
    const info = await redis.info('memory');
    const memMatch = info.match(/used_memory:(\d+)/);
    return {
      connected: true,
      latency: Date.now() - start,
      memoryUsage: memMatch ? parseInt(memMatch[1], 10) : 0,
    };
  } catch {
    return { connected: false, latency: -1, memoryUsage: 0 };
  }
};

const getQueueStats = async (queueName: string): Promise<QueueStats> => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      redis.llen(`bull:${queueName}:wait`),
      redis.llen(`bull:${queueName}:active`),
      redis.get(`bull:${queueName}:completed`) || '0',
      redis.get(`bull:${queueName}:failed`) || '0',
    ]);
    return {
      waiting,
      active,
      completed: parseInt(completed as string, 10),
      failed: parseInt(failed as string, 10),
    };
  } catch {
    return { waiting: 0, active: 0, completed: 0, failed: 0 };
  }
};

export const collectHealthMetrics = async (): Promise<HealthMetrics> => {
  log.debug('Collecting health metrics');

  const [database, redisHealth, payoutsQueue, moderationQueue, notificationsQueue] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    getQueueStats('payouts'),
    getQueueStats('moderation'),
    getQueueStats('notifications'),
  ]);

  const metrics: HealthMetrics = {
    timestamp: new Date().toISOString(),
    services: {
      workers: {
        status: 'healthy',
        responseTime: 0,
        errorRate: 0,
      },
    },
    database,
    redis: redisHealth,
    queues: {
      payouts: payoutsQueue,
      moderation: moderationQueue,
      notifications: notificationsQueue,
    },
  };

  await redis.hset('system:health', {
    uptime: '99.9',
    errorRate: '0.1',
    responseTime: database.latency.toString(),
    lastCheck: metrics.timestamp,
  });

  await redis.set('metrics:health:latest', JSON.stringify(metrics), 'EX', 300);

  const hour = new Date().toISOString().slice(0, 13);
  await redis.lpush(`metrics:health:${hour}`, JSON.stringify(metrics));
  await redis.ltrim(`metrics:health:${hour}`, 0, 59);
  await redis.expire(`metrics:health:${hour}`, 86400);

  return metrics;
};

export const checkAlertThresholds = async (metrics: HealthMetrics) => {
  const alerts: string[] = [];

  if (!metrics.database.connected) {
    alerts.push('CRITICAL: Database connection lost');
  } else if (metrics.database.latency > 1000) {
    alerts.push(`WARNING: Database latency high (${metrics.database.latency}ms)`);
  }

  if (!metrics.redis.connected) {
    alerts.push('CRITICAL: Redis connection lost');
  }

  if (metrics.queues.payouts.waiting > 100) {
    alerts.push(`WARNING: Payout queue backlog (${metrics.queues.payouts.waiting} waiting)`);
  }

  if (metrics.queues.moderation.waiting > 500) {
    alerts.push(`WARNING: Moderation queue backlog (${metrics.queues.moderation.waiting} waiting)`);
  }

  for (const alert of alerts) {
    log.warn({ alert }, 'Health alert triggered');
    await redis.lpush('alerts:health', JSON.stringify({ message: alert, timestamp: new Date().toISOString() }));
  }

  return alerts;
};

export const runHealthCheck = async () => {
  const metrics = await collectHealthMetrics();
  await checkAlertThresholds(metrics);
  return metrics;
};

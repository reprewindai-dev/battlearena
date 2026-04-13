"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runHealthCheck = exports.checkAlertThresholds = exports.collectHealthMetrics = void 0;
const supabase_1 = require("../lib/supabase");
const redis_1 = require("../lib/redis");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createJobLogger)('health-metrics');
const checkDatabaseHealth = async () => {
    const start = Date.now();
    try {
        await supabase_1.supabase.from('users').select('id').limit(1);
        return {
            connected: true,
            latency: Date.now() - start,
            activeConnections: 0,
        };
    }
    catch {
        return { connected: false, latency: -1, activeConnections: 0 };
    }
};
const checkRedisHealth = async () => {
    const start = Date.now();
    try {
        await redis_1.redis.ping();
        const info = await redis_1.redis.info('memory');
        const memMatch = info.match(/used_memory:(\d+)/);
        return {
            connected: true,
            latency: Date.now() - start,
            memoryUsage: memMatch ? parseInt(memMatch[1], 10) : 0,
        };
    }
    catch {
        return { connected: false, latency: -1, memoryUsage: 0 };
    }
};
const getQueueStats = async (queueName) => {
    try {
        const [waiting, active, completed, failed] = await Promise.all([
            redis_1.redis.llen(`bull:${queueName}:wait`),
            redis_1.redis.llen(`bull:${queueName}:active`),
            redis_1.redis.get(`bull:${queueName}:completed`) || '0',
            redis_1.redis.get(`bull:${queueName}:failed`) || '0',
        ]);
        return {
            waiting,
            active,
            completed: parseInt(completed, 10),
            failed: parseInt(failed, 10),
        };
    }
    catch {
        return { waiting: 0, active: 0, completed: 0, failed: 0 };
    }
};
const collectHealthMetrics = async () => {
    log.debug('Collecting health metrics');
    const [database, redisHealth, payoutsQueue, moderationQueue, notificationsQueue] = await Promise.all([
        checkDatabaseHealth(),
        checkRedisHealth(),
        getQueueStats('payouts'),
        getQueueStats('moderation'),
        getQueueStats('notifications'),
    ]);
    const metrics = {
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
    await redis_1.redis.hset('system:health', {
        uptime: '99.9',
        errorRate: '0.1',
        responseTime: database.latency.toString(),
        lastCheck: metrics.timestamp,
    });
    await redis_1.redis.set('metrics:health:latest', JSON.stringify(metrics), 'EX', 300);
    const hour = new Date().toISOString().slice(0, 13);
    await redis_1.redis.lpush(`metrics:health:${hour}`, JSON.stringify(metrics));
    await redis_1.redis.ltrim(`metrics:health:${hour}`, 0, 59);
    await redis_1.redis.expire(`metrics:health:${hour}`, 86400);
    return metrics;
};
exports.collectHealthMetrics = collectHealthMetrics;
const checkAlertThresholds = async (metrics) => {
    const alerts = [];
    if (!metrics.database.connected) {
        alerts.push('CRITICAL: Database connection lost');
    }
    else if (metrics.database.latency > 1000) {
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
        await redis_1.redis.lpush('alerts:health', JSON.stringify({ message: alert, timestamp: new Date().toISOString() }));
    }
    return alerts;
};
exports.checkAlertThresholds = checkAlertThresholds;
const runHealthCheck = async () => {
    const metrics = await (0, exports.collectHealthMetrics)();
    await (0, exports.checkAlertThresholds)(metrics);
    return metrics;
};
exports.runHealthCheck = runHealthCheck;
//# sourceMappingURL=health-metrics.js.map
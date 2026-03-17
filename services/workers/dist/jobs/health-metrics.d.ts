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
export declare const collectHealthMetrics: () => Promise<HealthMetrics>;
export declare const checkAlertThresholds: (metrics: HealthMetrics) => Promise<string[]>;
export declare const runHealthCheck: () => Promise<HealthMetrics>;
export {};
//# sourceMappingURL=health-metrics.d.ts.map
import { Queue, Worker, Job } from 'bullmq';
export declare const payoutQueue: Queue<any, any, string, any, any, string>;
export declare const moderationQueue: Queue<any, any, string, any, any, string>;
export declare const notificationQueue: Queue<any, any, string, any, any, string>;
export declare const analyticsQueue: Queue<any, any, string, any, any, string>;
export declare const cleanupQueue: Queue<any, any, string, any, any, string>;
export declare const createWorker: <T>(queueName: string, processor: (job: Job<T>) => Promise<void>, concurrency?: number) => Worker<T, any, string>;
//# sourceMappingURL=queue.d.ts.map
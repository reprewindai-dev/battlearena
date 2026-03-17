import { Queue, Worker, Job } from 'bullmq';
import { logger } from './logger';
import { config } from '../config';

const connection = { connection: { host: config.redis.host, port: config.redis.port, maxRetriesPerRequest: null } };

export const payoutQueue = new Queue('payouts', connection);
export const moderationQueue = new Queue('moderation', connection);
export const notificationQueue = new Queue('notifications', connection);
export const analyticsQueue = new Queue('analytics', connection);
export const cleanupQueue = new Queue('cleanup', connection);

export const createWorker = <T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>,
  concurrency = 5
) => {
  const worker = new Worker<T>(queueName, processor, { ...connection, concurrency });
  worker.on('completed', (job: Job<T>) => logger.info({ jobId: job.id, queue: queueName }, 'Job completed'));
  worker.on('failed', (job: Job<T> | undefined, err: Error) => logger.error({ jobId: job?.id, queue: queueName, err }, 'Job failed'));
  return worker;
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorker = exports.cleanupQueue = exports.analyticsQueue = exports.notificationQueue = exports.moderationQueue = exports.payoutQueue = void 0;
const bullmq_1 = require("bullmq");
const logger_1 = require("./logger");
const config_1 = require("../config");
const connection = { connection: { host: config_1.config.redis.host, port: config_1.config.redis.port, maxRetriesPerRequest: null } };
exports.payoutQueue = new bullmq_1.Queue('payouts', connection);
exports.moderationQueue = new bullmq_1.Queue('moderation', connection);
exports.notificationQueue = new bullmq_1.Queue('notifications', connection);
exports.analyticsQueue = new bullmq_1.Queue('analytics', connection);
exports.cleanupQueue = new bullmq_1.Queue('cleanup', connection);
const createWorker = (queueName, processor, concurrency = 5) => {
    const worker = new bullmq_1.Worker(queueName, processor, { ...connection, concurrency });
    worker.on('completed', (job) => logger_1.logger.info({ jobId: job.id, queue: queueName }, 'Job completed'));
    worker.on('failed', (job, err) => logger_1.logger.error({ jobId: job?.id, queue: queueName, err }, 'Job failed'));
    return worker;
};
exports.createWorker = createWorker;
//# sourceMappingURL=queue.js.map
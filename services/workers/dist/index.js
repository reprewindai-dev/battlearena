"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const node_cron_1 = __importDefault(require("node-cron"));
const config_1 = require("./config");
const logger_1 = require("./lib/logger");
const redis_1 = require("./lib/redis");
const payout_processor_1 = require("./jobs/payout-processor");
const moderation_processor_1 = require("./jobs/moderation-processor");
const daily_report_1 = require("./jobs/daily-report");
const fraud_detection_1 = require("./jobs/fraud-detection");
const cleanup_1 = require("./jobs/cleanup");
const rating_recalculation_1 = require("./jobs/rating-recalculation");
const crf_allocation_1 = require("./jobs/crf-allocation");
const tournament_processor_1 = require("./jobs/tournament-processor");
const health_metrics_1 = require("./jobs/health-metrics");
const user_engagement_1 = require("./jobs/user-engagement");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/health', async (_req, res) => {
    try {
        await redis_1.redis.ping();
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    }
    catch (error) {
        res.status(503).json({ status: 'unhealthy', error: String(error) });
    }
});
app.get('/metrics', async (_req, res) => {
    const metrics = await (0, health_metrics_1.runHealthCheck)();
    res.json(metrics);
});
app.post('/jobs/trigger/:jobName', async (req, res) => {
    const { jobName } = req.params;
    const jobs = {
        payouts: payout_processor_1.scheduleDailyPayouts,
        moderation: moderation_processor_1.processQueuedContent,
        report: daily_report_1.generateDailyReport,
        fraud: fraud_detection_1.runFraudDetection,
        cleanup: cleanup_1.runAllCleanupTasks,
        ratings: rating_recalculation_1.recalculateRatings,
        crf: crf_allocation_1.calculateMonthlyCRF,
        prizes: crf_allocation_1.distributeTournamentPrizes,
        grants: crf_allocation_1.processGrantApplications,
        tournaments: tournament_processor_1.progressTournaments,
        health: health_metrics_1.runHealthCheck,
        engagement: user_engagement_1.runEngagementAnalysis,
    };
    if (!jobs[jobName]) {
        return res.status(404).json({ error: 'Job not found' });
    }
    try {
        logger_1.logger.info({ jobName }, 'Manually triggering job');
        const result = await jobs[jobName]();
        res.json({ success: true, jobName, result });
    }
    catch (error) {
        logger_1.logger.error({ jobName, error }, 'Job execution failed');
        res.status(500).json({ error: String(error) });
    }
});
const initCronJobs = () => {
    logger_1.logger.info('Initializing cron jobs');
    node_cron_1.default.schedule(config_1.config.jobs.healthMetrics, async () => {
        try {
            await (0, health_metrics_1.runHealthCheck)();
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Health metrics job failed');
        }
    });
    node_cron_1.default.schedule(config_1.config.jobs.moderationQueue, async () => {
        try {
            await (0, moderation_processor_1.processQueuedContent)();
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Moderation queue job failed');
        }
    });
    node_cron_1.default.schedule(config_1.config.jobs.fraudDetection, async () => {
        try {
            await (0, fraud_detection_1.runFraudDetection)();
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Fraud detection job failed');
        }
    });
    node_cron_1.default.schedule(config_1.config.jobs.tournamentProgression, async () => {
        try {
            await (0, tournament_processor_1.progressTournaments)();
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Tournament progression job failed');
        }
    });
    node_cron_1.default.schedule(config_1.config.jobs.payoutProcessing, async () => {
        try {
            await (0, payout_processor_1.scheduleDailyPayouts)();
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Payout processing job failed');
        }
    });
    node_cron_1.default.schedule(config_1.config.jobs.dailyReport, async () => {
        try {
            await (0, daily_report_1.generateDailyReport)();
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Daily report job failed');
        }
    });
    node_cron_1.default.schedule(config_1.config.jobs.staleRecordingCleanup, async () => {
        try {
            await (0, cleanup_1.runAllCleanupTasks)();
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Cleanup job failed');
        }
    });
    node_cron_1.default.schedule(config_1.config.jobs.ratingRecalculation, async () => {
        try {
            await (0, rating_recalculation_1.recalculateRatings)();
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Rating recalculation job failed');
        }
    });
    node_cron_1.default.schedule(config_1.config.jobs.userEngagement, async () => {
        try {
            await (0, user_engagement_1.runEngagementAnalysis)();
        }
        catch (error) {
            logger_1.logger.error({ error }, 'User engagement job failed');
        }
    });
    node_cron_1.default.schedule(config_1.config.jobs.crfAllocation, async () => {
        try {
            await (0, crf_allocation_1.calculateMonthlyCRF)();
            await (0, crf_allocation_1.distributeTournamentPrizes)();
            await (0, crf_allocation_1.processGrantApplications)();
        }
        catch (error) {
            logger_1.logger.error({ error }, 'CRF allocation job failed');
        }
    });
    logger_1.logger.info('All cron jobs initialized');
};
const startWorkers = () => {
    logger_1.logger.info('Starting queue workers');
    payout_processor_1.payoutWorker.on('ready', () => logger_1.logger.info('Payout worker ready'));
    moderation_processor_1.moderationWorker.on('ready', () => logger_1.logger.info('Moderation worker ready'));
};
const shutdown = async () => {
    logger_1.logger.info('Shutting down workers service');
    await payout_processor_1.payoutWorker.close();
    await moderation_processor_1.moderationWorker.close();
    await redis_1.redis.quit();
    process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
app.listen(config_1.config.port, () => {
    logger_1.logger.info({ port: config_1.config.port }, 'Workers service started');
    initCronJobs();
    startWorkers();
});
//# sourceMappingURL=index.js.map
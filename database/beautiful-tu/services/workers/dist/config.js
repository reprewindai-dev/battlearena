"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    port: parseInt(process.env.PORT || '3010', 10),
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
        port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379', 10),
    },
    supabase: {
        url: process.env.SUPABASE_URL || '',
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    },
    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || '',
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
    },
    jobs: {
        payoutProcessing: process.env.PAYOUT_CRON || '0 9 * * *',
        dailyReport: process.env.DAILY_REPORT_CRON || '0 18 * * *',
        moderationQueue: process.env.MODERATION_CRON || '*/5 * * * *',
        staleRecordingCleanup: process.env.CLEANUP_CRON || '0 3 * * *',
        ratingRecalculation: process.env.RATING_CRON || '0 4 * * *',
        crfAllocation: process.env.CRF_CRON || '0 0 1 * *',
        fraudDetection: process.env.FRAUD_CRON || '*/15 * * * *',
        healthMetrics: process.env.HEALTH_CRON || '* * * * *',
        tournamentProgression: process.env.TOURNAMENT_CRON || '*/10 * * * *',
        userEngagement: process.env.ENGAGEMENT_CRON || '0 10 * * *',
    },
    thresholds: {
        minPayoutCents: 1000,
        maxDailySpendCents: 5000,
        fraudScoreThreshold: 0.75,
        moderationConfidenceThreshold: 0.85,
        staleRecordingDays: 30,
    },
};
//# sourceMappingURL=config.js.map
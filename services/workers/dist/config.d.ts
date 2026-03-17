export declare const config: {
    port: number;
    redis: {
        url: string;
        host: string;
        port: number;
    };
    supabase: {
        url: string;
        serviceKey: string;
    };
    stripe: {
        secretKey: string;
    };
    openai: {
        apiKey: string;
    };
    jobs: {
        payoutProcessing: string;
        dailyReport: string;
        moderationQueue: string;
        staleRecordingCleanup: string;
        ratingRecalculation: string;
        crfAllocation: string;
        fraudDetection: string;
        healthMetrics: string;
        tournamentProgression: string;
        userEngagement: string;
    };
    thresholds: {
        minPayoutCents: number;
        maxDailySpendCents: number;
        fraudScoreThreshold: number;
        moderationConfidenceThreshold: number;
        staleRecordingDays: number;
    };
};
//# sourceMappingURL=config.d.ts.map
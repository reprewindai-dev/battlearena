interface DailyReport {
    date: string;
    systemHealth: {
        uptime: number;
        errorRate: number;
        responseTime: number;
    };
    businessMetrics: {
        dailyActiveUsers: number;
        battlesCompleted: number;
        tokenPurchases: number;
        tokenSpending: number;
        creatorPayouts: number;
        newUsers: number;
    };
    moderationSummary: {
        reportsReceived: number;
        reportsResolved: number;
        averageResponseTime: number;
        criticalIncidents: number;
    };
    economyMetrics: {
        totalRevenue: number;
        crfBalance: number;
        pendingPayouts: number;
        activeCreators: number;
    };
}
export declare const generateDailyReport: () => Promise<DailyReport>;
export {};
//# sourceMappingURL=daily-report.d.ts.map
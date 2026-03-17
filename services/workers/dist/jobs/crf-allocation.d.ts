export declare const calculateMonthlyCRF: () => Promise<{
    month: string;
    totalRevenue: number;
    platformShare: number;
    crfContribution: number;
    breakdown: {
        tournamentPrizes: number;
        educationGrants: number;
        emergencyAssistance: number;
        infrastructure: number;
        rollover: number;
    };
}>;
export declare const distributeTournamentPrizes: () => Promise<void>;
export declare const processGrantApplications: () => Promise<void>;
//# sourceMappingURL=crf-allocation.d.ts.map
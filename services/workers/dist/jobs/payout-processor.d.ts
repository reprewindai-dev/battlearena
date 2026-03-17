import { Job } from 'bullmq';
interface PayoutJob {
    payoutId: string;
    userId: string;
    amountCents: number;
    currency: string;
    method: string;
    stripeAccountId?: string;
}
export declare const processPayoutJob: (job: Job<PayoutJob>) => Promise<void>;
export declare const payoutWorker: import("bullmq").Worker<PayoutJob, any, string>;
export declare const scheduleDailyPayouts: () => Promise<void>;
export {};
//# sourceMappingURL=payout-processor.d.ts.map
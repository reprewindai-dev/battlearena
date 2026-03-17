import { Job } from 'bullmq';
interface ModerationJob {
    contentId: string;
    contentType: 'battle' | 'chat' | 'profile' | 'beat';
    content: string;
    userId: string;
}
export declare const processModerationJob: (job: Job<ModerationJob>) => Promise<void>;
export declare const moderationWorker: import("bullmq").Worker<ModerationJob, any, string>;
export declare const processQueuedContent: () => Promise<void>;
export declare const queueContentForModeration: (contentId: string, contentType: ModerationJob["contentType"], content: string, userId: string) => Promise<void>;
export {};
//# sourceMappingURL=moderation-processor.d.ts.map
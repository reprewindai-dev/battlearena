"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueContentForModeration = exports.processQueuedContent = exports.moderationWorker = exports.processModerationJob = void 0;
const supabase_1 = require("../lib/supabase");
const logger_1 = require("../lib/logger");
const config_1 = require("../config");
const queue_1 = require("../lib/queue");
const openai_1 = __importDefault(require("openai"));
const log = (0, logger_1.createJobLogger)('moderation-processor');
const openai = new openai_1.default({ apiKey: config_1.config.openai.apiKey });
const analyzeContent = async (content) => {
    try {
        const response = await openai.moderations.create({ input: content });
        const result = response.results[0];
        return {
            flagged: result.flagged,
            categories: result.categories,
            scores: result.category_scores,
        };
    }
    catch (error) {
        log.error({ error }, 'OpenAI moderation failed');
        return { flagged: false, categories: {}, scores: {} };
    }
};
const determineSeverity = (scores) => {
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore > 0.9)
        return 'critical';
    if (maxScore > 0.7)
        return 'high';
    if (maxScore > 0.5)
        return 'medium';
    return 'low';
};
const processModerationJob = async (job) => {
    const { contentId, contentType, content, userId } = job.data;
    log.info({ contentId, contentType }, 'Processing moderation');
    const result = await analyzeContent(content);
    if (result.flagged) {
        const severity = determineSeverity(result.scores);
        const flaggedCategories = Object.entries(result.categories)
            .filter(([, flagged]) => flagged)
            .map(([category]) => category);
        await supabase_1.supabase.from('ai_moderation_flags').insert({
            content_type: contentType,
            content_id: contentId,
            user_id: userId,
            flag_type: flaggedCategories[0] || 'unknown',
            confidence_score: Math.max(...Object.values(result.scores)),
            analysis_data: { categories: result.categories, scores: result.scores },
            status: severity === 'critical' ? 'reviewing' : 'flagged',
        });
        if (severity === 'critical') {
            await supabase_1.supabase.from('moderation_reports').insert({
                reported_user_id: userId,
                reported_content_type: contentType,
                reported_content_id: contentId,
                reason: `AI detected: ${flaggedCategories.join(', ')}`,
                severity: 'critical',
                status: 'pending',
            });
        }
        log.warn({ contentId, severity, categories: flaggedCategories }, 'Content flagged');
    }
};
exports.processModerationJob = processModerationJob;
exports.moderationWorker = (0, queue_1.createWorker)('moderation', exports.processModerationJob, 10);
const processQueuedContent = async () => {
    log.info('Processing moderation queue');
    const { data: pendingFlags } = await supabase_1.supabase
        .from('ai_moderation_flags')
        .select('*')
        .eq('status', 'flagged')
        .gte('confidence_score', config_1.config.thresholds.moderationConfidenceThreshold)
        .limit(100);
    for (const flag of pendingFlags || []) {
        await supabase_1.supabase.from('moderation_reports').insert({
            reported_user_id: flag.user_id,
            reported_content_type: flag.content_type,
            reported_content_id: flag.content_id,
            reason: `AI flagged: ${flag.flag_type}`,
            severity: flag.confidence_score > 0.9 ? 'high' : 'medium',
            status: 'pending',
        });
        await supabase_1.supabase.from('ai_moderation_flags').update({ status: 'reviewing' }).eq('id', flag.id);
    }
    log.info({ count: pendingFlags?.length || 0 }, 'Escalated flags to human review');
};
exports.processQueuedContent = processQueuedContent;
const queueContentForModeration = async (contentId, contentType, content, userId) => {
    await queue_1.moderationQueue.add('moderate-content', { contentId, contentType, content, userId });
};
exports.queueContentForModeration = queueContentForModeration;
//# sourceMappingURL=moderation-processor.js.map
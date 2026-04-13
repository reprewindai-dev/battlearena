import { Job } from 'bullmq';
import { supabase } from '../lib/supabase';
import { createJobLogger } from '../lib/logger';
import { config } from '../config';
import { createWorker, moderationQueue } from '../lib/queue';
import OpenAI from 'openai';

const log = createJobLogger('moderation-processor');
const openai = new OpenAI({ apiKey: config.openai.apiKey });

interface ModerationJob {
  contentId: string;
  contentType: 'battle' | 'chat' | 'profile' | 'beat';
  content: string;
  userId: string;
}

interface ModerationResult {
  flagged: boolean;
  categories: Record<string, boolean>;
  scores: Record<string, number>;
}

const analyzeContent = async (content: string): Promise<ModerationResult> => {
  try {
    const response = await openai.moderations.create({ input: content });
    const result = response.results[0];
    return {
      flagged: result.flagged,
      categories: result.categories as unknown as Record<string, boolean>,
      scores: result.category_scores as unknown as Record<string, number>,
    };
  } catch (error) {
    log.error({ error }, 'OpenAI moderation failed');
    return { flagged: false, categories: {}, scores: {} };
  }
};

const determineSeverity = (scores: Record<string, number>): string => {
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore > 0.9) return 'critical';
  if (maxScore > 0.7) return 'high';
  if (maxScore > 0.5) return 'medium';
  return 'low';
};

export const processModerationJob = async (job: Job<ModerationJob>) => {
  const { contentId, contentType, content, userId } = job.data;
  log.info({ contentId, contentType }, 'Processing moderation');

  const result = await analyzeContent(content);

  if (result.flagged) {
    const severity = determineSeverity(result.scores);
    const flaggedCategories = Object.entries(result.categories)
      .filter(([, flagged]) => flagged)
      .map(([category]) => category);

    await supabase.from('ai_moderation_flags').insert({
      content_type: contentType,
      content_id: contentId,
      user_id: userId,
      flag_type: flaggedCategories[0] || 'unknown',
      confidence_score: Math.max(...Object.values(result.scores)),
      analysis_data: { categories: result.categories, scores: result.scores },
      status: severity === 'critical' ? 'reviewing' : 'flagged',
    });

    if (severity === 'critical') {
      await supabase.from('moderation_reports').insert({
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

export const moderationWorker = createWorker<ModerationJob>('moderation', processModerationJob, 10);

export const processQueuedContent = async () => {
  log.info('Processing moderation queue');

  const { data: pendingFlags } = await supabase
    .from('ai_moderation_flags')
    .select('*')
    .eq('status', 'flagged')
    .gte('confidence_score', config.thresholds.moderationConfidenceThreshold)
    .limit(100);

  for (const flag of pendingFlags || []) {
    await supabase.from('moderation_reports').insert({
      reported_user_id: flag.user_id,
      reported_content_type: flag.content_type,
      reported_content_id: flag.content_id,
      reason: `AI flagged: ${flag.flag_type}`,
      severity: flag.confidence_score > 0.9 ? 'high' : 'medium',
      status: 'pending',
    });

    await supabase.from('ai_moderation_flags').update({ status: 'reviewing' }).eq('id', flag.id);
  }

  log.info({ count: pendingFlags?.length || 0 }, 'Escalated flags to human review');
};

export const queueContentForModeration = async (
  contentId: string,
  contentType: ModerationJob['contentType'],
  content: string,
  userId: string
) => {
  await moderationQueue.add('moderate-content', { contentId, contentType, content, userId });
};

import { supabase } from '../lib/supabase';
import { redis } from '../lib/redis';
import { createJobLogger } from '../lib/logger';
import { config } from '../config';

const log = createJobLogger('fraud-detection');

interface FraudSignal {
  userId: string;
  signalType: string;
  score: number;
  details: Record<string, unknown>;
}

const detectUnusualSpending = async (): Promise<FraudSignal[]> => {
  const signals: FraudSignal[] = [];
  const yesterday = new Date(Date.now() - 86400000).toISOString();

  const { data: highSpenders } = await supabase
    .from('token_purchases')
    .select('user_id, amount_cents')
    .gte('created_at', yesterday)
    .eq('status', 'completed');

  const userSpending = new Map<string, number>();
  for (const purchase of highSpenders || []) {
    const current = userSpending.get(purchase.user_id) || 0;
    userSpending.set(purchase.user_id, current + purchase.amount_cents);
  }

  for (const [userId, totalSpent] of userSpending) {
    if (totalSpent > config.thresholds.maxDailySpendCents) {
      signals.push({
        userId,
        signalType: 'high_spending',
        score: Math.min(totalSpent / config.thresholds.maxDailySpendCents, 1),
        details: { totalSpent, threshold: config.thresholds.maxDailySpendCents },
      });
    }
  }

  return signals;
};

const detectRapidTransactions = async (): Promise<FraudSignal[]> => {
  const signals: FraudSignal[] = [];
  const lastHour = new Date(Date.now() - 3600000).toISOString();

  const { data: recentTxns } = await supabase
    .from('token_transactions')
    .select('user_id, created_at')
    .gte('created_at', lastHour);

  const userTxnCounts = new Map<string, number>();
  for (const txn of recentTxns || []) {
    const count = userTxnCounts.get(txn.user_id) || 0;
    userTxnCounts.set(txn.user_id, count + 1);
  }

  for (const [userId, count] of userTxnCounts) {
    if (count > 50) {
      signals.push({
        userId,
        signalType: 'rapid_transactions',
        score: Math.min(count / 100, 1),
        details: { transactionCount: count, period: '1h' },
      });
    }
  }

  return signals;
};

const detectSelfTipping = async (): Promise<FraudSignal[]> => {
  const signals: FraudSignal[] = [];
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data: tips } = await supabase
    .from('token_transactions')
    .select('user_id, recipient_id, tokens_spent')
    .eq('transaction_type', 'tip')
    .gte('created_at', lastWeek);

  const suspiciousPatterns = new Map<string, { total: number; recipients: Set<string> }>();

  for (const tip of tips || []) {
    if (!tip.recipient_id) continue;
    const key = tip.user_id;
    const existing = suspiciousPatterns.get(key) || { total: 0, recipients: new Set() };
    existing.total += tip.tokens_spent;
    existing.recipients.add(tip.recipient_id);
    suspiciousPatterns.set(key, existing);
  }

  for (const [userId, data] of suspiciousPatterns) {
    if (data.recipients.size === 1 && data.total > 1000) {
      signals.push({
        userId,
        signalType: 'potential_self_tipping',
        score: 0.8,
        details: { totalTipped: data.total, uniqueRecipients: data.recipients.size },
      });
    }
  }

  return signals;
};

export const runFraudDetection = async () => {
  log.info('Running fraud detection scan');

  const [spendingSignals, rapidSignals, selfTipSignals] = await Promise.all([
    detectUnusualSpending(),
    detectRapidTransactions(),
    detectSelfTipping(),
  ]);

  const allSignals = [...spendingSignals, ...rapidSignals, ...selfTipSignals];

  const userScores = new Map<string, number>();
  for (const signal of allSignals) {
    const current = userScores.get(signal.userId) || 0;
    userScores.set(signal.userId, Math.min(current + signal.score * 0.5, 1));
  }

  for (const [userId, score] of userScores) {
    if (score >= config.thresholds.fraudScoreThreshold) {
      await supabase.from('fraud_alerts').insert({
        user_id: userId,
        fraud_score: score,
        signals: allSignals.filter(s => s.userId === userId),
        status: 'pending_review',
      });

      await redis.sadd('fraud:flagged_users', userId);
      log.warn({ userId, score }, 'User flagged for fraud review');
    }
  }

  log.info({ signalsDetected: allSignals.length, usersFlagged: userScores.size }, 'Fraud detection complete');
};

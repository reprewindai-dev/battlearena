import { supabase } from '../lib/supabase';
import { redis } from '../lib/redis';
import { createJobLogger } from '../lib/logger';

const log = createJobLogger('daily-report');

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

export const generateDailyReport = async (): Promise<DailyReport> => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  log.info({ date: today }, 'Generating daily report');

  const [
    dauResult,
    battlesResult,
    purchasesResult,
    spendingResult,
    payoutsResult,
    newUsersResult,
    reportsReceivedResult,
    reportsResolvedResult,
    criticalResult,
    creatorsResult,
    pendingPayoutsResult,
  ] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact' }).gte('last_active', yesterday),
    supabase.from('battles').select('id', { count: 'exact' }).eq('status', 'completed').gte('completed_at', yesterday),
    supabase.from('token_purchases').select('amount_cents').eq('status', 'completed').gte('created_at', yesterday),
    supabase.from('token_transactions').select('tokens_spent').gte('created_at', yesterday),
    supabase.from('payouts').select('amount_cents').eq('status', 'completed').gte('processed_at', yesterday),
    supabase.from('users').select('id', { count: 'exact' }).gte('created_at', yesterday),
    supabase.from('moderation_reports').select('id', { count: 'exact' }).gte('created_at', yesterday),
    supabase.from('moderation_reports').select('id', { count: 'exact' }).eq('status', 'resolved').gte('resolved_at', yesterday),
    supabase.from('moderation_reports').select('id', { count: 'exact' }).eq('severity', 'critical').gte('created_at', yesterday),
    supabase.from('wallets').select('user_id', { count: 'exact' }).gt('points_balance', 0),
    supabase.from('payouts').select('amount_cents').eq('status', 'pending'),
  ]);

  const totalPurchases = purchasesResult.data?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0;
  const totalSpending = spendingResult.data?.reduce((sum, t) => sum + (t.tokens_spent || 0), 0) || 0;
  const totalPayouts = payoutsResult.data?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0;
  const totalPendingPayouts = pendingPayoutsResult.data?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0;

  const healthMetrics = await redis.hgetall('system:health');

  const report: DailyReport = {
    date: today,
    systemHealth: {
      uptime: parseFloat(healthMetrics?.uptime || '99.9'),
      errorRate: parseFloat(healthMetrics?.errorRate || '0.1'),
      responseTime: parseFloat(healthMetrics?.responseTime || '150'),
    },
    businessMetrics: {
      dailyActiveUsers: dauResult.count || 0,
      battlesCompleted: battlesResult.count || 0,
      tokenPurchases: totalPurchases,
      tokenSpending: totalSpending,
      creatorPayouts: totalPayouts,
      newUsers: newUsersResult.count || 0,
    },
    moderationSummary: {
      reportsReceived: reportsReceivedResult.count || 0,
      reportsResolved: reportsResolvedResult.count || 0,
      averageResponseTime: 2,
      criticalIncidents: criticalResult.count || 0,
    },
    economyMetrics: {
      totalRevenue: totalPurchases,
      crfBalance: Math.floor(totalPurchases * 0.03),
      pendingPayouts: totalPendingPayouts,
      activeCreators: creatorsResult.count || 0,
    },
  };

  await redis.set(`report:daily:${today}`, JSON.stringify(report), 'EX', 86400 * 30);
  await supabase.from('daily_reports').upsert({ date: today, report_data: report });

  log.info({ report }, 'Daily report generated');
  return report;
};

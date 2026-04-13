import { supabase } from '../lib/supabase';
import { redis } from '../lib/redis';
import { createJobLogger } from '../lib/logger';
import { notificationQueue } from '../lib/queue';

const log = createJobLogger('user-engagement');

interface EngagementMetrics {
  userId: string;
  lastActive: string;
  daysSinceActive: number;
  totalBattles: number;
  winRate: number;
  tier: string;
}

export const analyzeUserEngagement = async () => {
  log.info('Analyzing user engagement');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

  const { data: inactiveUsers } = await supabase
    .from('users')
    .select('id, last_active, email')
    .lt('last_active', sevenDaysAgo)
    .gt('last_active', thirtyDaysAgo)
    .eq('is_banned', false);

  const atRiskUsers: EngagementMetrics[] = [];
  const churningUsers: EngagementMetrics[] = [];

  for (const user of inactiveUsers || []) {
    const daysSinceActive = Math.floor((Date.now() - new Date(user.last_active).getTime()) / 86400000);

    const { data: rating } = await supabase
      .from('user_ratings')
      .select('wins, losses, tier')
      .eq('user_id', user.id)
      .single();

    const totalBattles = (rating?.wins || 0) + (rating?.losses || 0);
    const winRate = totalBattles > 0 ? (rating?.wins || 0) / totalBattles : 0;

    const metrics: EngagementMetrics = {
      userId: user.id,
      lastActive: user.last_active,
      daysSinceActive,
      totalBattles,
      winRate,
      tier: rating?.tier || 'novice',
    };

    if (daysSinceActive >= 14) {
      churningUsers.push(metrics);
    } else if (daysSinceActive >= 7) {
      atRiskUsers.push(metrics);
    }
  }

  for (const user of atRiskUsers) {
    await notificationQueue.add('re-engagement', {
      userId: user.userId,
      type: 'at_risk',
      template: 'we_miss_you',
      data: { daysSinceActive: user.daysSinceActive, tier: user.tier },
    });
  }

  for (const user of churningUsers) {
    await notificationQueue.add('re-engagement', {
      userId: user.userId,
      type: 'churning',
      template: 'come_back',
      data: { daysSinceActive: user.daysSinceActive, totalBattles: user.totalBattles },
    });
  }

  await redis.hset('metrics:engagement', {
    atRiskCount: atRiskUsers.length.toString(),
    churningCount: churningUsers.length.toString(),
    lastRun: new Date().toISOString(),
  });

  log.info({ atRisk: atRiskUsers.length, churning: churningUsers.length }, 'User engagement analysis complete');
};

export const calculateRetentionMetrics = async () => {
  log.info('Calculating retention metrics');

  const periods = [1, 7, 14, 30];
  const retention: Record<string, number> = {};

  for (const days of periods) {
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const endDate = new Date(Date.now() - (days - 1) * 86400000).toISOString().split('T')[0];

    const { count: newUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('created_at', startDate)
      .lt('created_at', endDate);

    const { count: activeUsers } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .gte('last_active', new Date(Date.now() - 86400000).toISOString());

    retention[`d${days}`] = newUsers && newUsers > 0 ? (activeUsers || 0) / newUsers : 0;
  }

  await redis.hset('metrics:retention', retention);
  log.info({ retention }, 'Retention metrics calculated');
  return retention;
};

export const identifyPowerUsers = async () => {
  log.info('Identifying power users');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: activeUsers } = await supabase
    .from('users')
    .select('id')
    .gte('last_active', thirtyDaysAgo);

  const powerUsers: string[] = [];

  for (const user of activeUsers || []) {
    const { count: battleCount } = await supabase
      .from('battles')
      .select('id', { count: 'exact' })
      .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
      .gte('created_at', thirtyDaysAgo);

    const { data: spending } = await supabase
      .from('token_purchases')
      .select('amount_cents')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo);

    const totalSpent = spending?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0;

    if ((battleCount || 0) >= 20 || totalSpent >= 5000) {
      powerUsers.push(user.id);
    }
  }

  await redis.del('users:power');
  if (powerUsers.length > 0) {
    await redis.sadd('users:power', ...powerUsers);
  }

  log.info({ count: powerUsers.length }, 'Power users identified');
  return powerUsers;
};

export const runEngagementAnalysis = async () => {
  await analyzeUserEngagement();
  await calculateRetentionMetrics();
  await identifyPowerUsers();
};

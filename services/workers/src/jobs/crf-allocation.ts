import { supabase } from '../lib/supabase';
import { createJobLogger } from '../lib/logger';

const log = createJobLogger('crf-allocation');

const CRF_PERCENTAGE = 0.10;
const ALLOCATION = {
  tournamentPrizes: 0.60,
  educationGrants: 0.20,
  emergencyAssistance: 0.10,
  infrastructure: 0.05,
  rollover: 0.05,
};

export const calculateMonthlyCRF = async () => {
  log.info('Running monthly CRF allocation');

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfLastMonth = new Date(startOfMonth);
  startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

  const { data: monthlyRevenue } = await supabase
    .from('token_purchases')
    .select('amount_cents')
    .eq('status', 'completed')
    .gte('created_at', startOfLastMonth.toISOString())
    .lt('created_at', startOfMonth.toISOString());

  const totalRevenue = monthlyRevenue?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0;
  const platformShare = Math.floor(totalRevenue * 0.10);
  const crfContribution = Math.floor(platformShare * CRF_PERCENTAGE * 10);

  const allocation = {
    month: startOfLastMonth.toISOString().slice(0, 7),
    totalRevenue,
    platformShare,
    crfContribution,
    breakdown: {
      tournamentPrizes: Math.floor(crfContribution * ALLOCATION.tournamentPrizes),
      educationGrants: Math.floor(crfContribution * ALLOCATION.educationGrants),
      emergencyAssistance: Math.floor(crfContribution * ALLOCATION.emergencyAssistance),
      infrastructure: Math.floor(crfContribution * ALLOCATION.infrastructure),
      rollover: Math.floor(crfContribution * ALLOCATION.rollover),
    },
  };

  await supabase.from('crf_allocations').insert({
    month: allocation.month,
    total_revenue_cents: totalRevenue,
    crf_contribution_cents: crfContribution,
    allocation_breakdown: allocation.breakdown,
    status: 'pending_approval',
  });

  log.info({ allocation }, 'CRF allocation calculated');
  return allocation;
};

export const distributeTournamentPrizes = async () => {
  log.info('Distributing tournament prizes from CRF');

  const { data: pendingPrizes } = await supabase
    .from('tournament_prizes')
    .select('id, user_id, amount_cents, tournament_id')
    .eq('status', 'pending')
    .eq('source', 'crf');

  for (const prize of pendingPrizes || []) {
    await supabase.from('wallets').update({
      points_balance: supabase.rpc('increment_points', { amount: prize.amount_cents }),
    }).eq('user_id', prize.user_id);

    await supabase.from('tournament_prizes').update({
      status: 'distributed',
      distributed_at: new Date().toISOString(),
    }).eq('id', prize.id);

    await supabase.from('token_transactions').insert({
      user_id: prize.user_id,
      tokens_spent: 0,
      points_earned: prize.amount_cents,
      platform_share: 0,
      transaction_type: 'tournament_prize',
      reference_id: prize.tournament_id,
    });
  }

  log.info({ count: pendingPrizes?.length || 0 }, 'Tournament prizes distributed');
};

export const processGrantApplications = async () => {
  log.info('Processing grant applications');

  const { data: approvedGrants } = await supabase
    .from('grant_applications')
    .select('id, user_id, amount_cents, grant_type')
    .eq('status', 'approved')
    .eq('disbursed', false);

  for (const grant of approvedGrants || []) {
    await supabase.from('wallets').update({
      points_balance: supabase.rpc('increment_points', { amount: grant.amount_cents }),
    }).eq('user_id', grant.user_id);

    await supabase.from('grant_applications').update({
      disbursed: true,
      disbursed_at: new Date().toISOString(),
    }).eq('id', grant.id);
  }

  log.info({ count: approvedGrants?.length || 0 }, 'Grants disbursed');
};

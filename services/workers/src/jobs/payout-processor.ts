import { Job } from 'bullmq';
import { supabase } from '../lib/supabase';
import { stripe } from '../lib/stripe';
import { createJobLogger } from '../lib/logger';
import { config } from '../config';
import { createWorker, payoutQueue } from '../lib/queue';

const log = createJobLogger('payout-processor');

interface PayoutJob {
  payoutId: string;
  userId: string;
  amountCents: number;
  currency: string;
  method: string;
  stripeAccountId?: string;
}

export const processPayoutJob = async (job: Job<PayoutJob>) => {
  const { payoutId, userId, amountCents, currency, method, stripeAccountId } = job.data;
  log.info({ payoutId, userId, amountCents }, 'Processing payout');

  try {
    await supabase.from('payouts').update({ status: 'processing' }).eq('id', payoutId);

    if (method === 'stripe' && stripeAccountId) {
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        destination: stripeAccountId,
        metadata: { payoutId, userId },
      });
      log.info({ transferId: transfer.id }, 'Stripe transfer created');
    }

    await supabase.from('payouts').update({
      status: 'completed',
      processed_at: new Date().toISOString(),
    }).eq('id', payoutId);

    await supabase.from('wallets').update({
      points_balance: supabase.rpc('decrement_points', { amount: amountCents }),
    }).eq('user_id', userId);

    log.info({ payoutId }, 'Payout completed');
  } catch (error) {
    log.error({ payoutId, error }, 'Payout failed');
    await supabase.from('payouts').update({ status: 'failed' }).eq('id', payoutId);
    throw error;
  }
};

export const payoutWorker = createWorker<PayoutJob>('payouts', processPayoutJob, 3);

export const scheduleDailyPayouts = async () => {
  log.info('Running daily payout processing');

  const { data: pendingPayouts, error } = await supabase
    .from('payouts')
    .select('id, user_id, amount_cents, currency, payout_details')
    .eq('status', 'pending')
    .gte('amount_cents', config.thresholds.minPayoutCents);

  if (error) {
    log.error({ error }, 'Failed to fetch pending payouts');
    return;
  }

  for (const payout of pendingPayouts || []) {
    const { data: user } = await supabase
      .from('users')
      .select('kyc_status')
      .eq('id', payout.user_id)
      .single();

    if (user?.kyc_status !== 'verified') {
      log.warn({ userId: payout.user_id }, 'Skipping payout - KYC not verified');
      continue;
    }

    await payoutQueue.add('process-payout', {
      payoutId: payout.id,
      userId: payout.user_id,
      amountCents: payout.amount_cents,
      currency: payout.currency,
      method: payout.payout_details?.method || 'stripe',
      stripeAccountId: payout.payout_details?.stripe_account_id,
    });
  }

  log.info({ count: pendingPayouts?.length || 0 }, 'Queued payouts for processing');
};

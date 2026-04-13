"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleDailyPayouts = exports.payoutWorker = exports.processPayoutJob = void 0;
const supabase_1 = require("../lib/supabase");
const stripe_1 = require("../lib/stripe");
const logger_1 = require("../lib/logger");
const config_1 = require("../config");
const queue_1 = require("../lib/queue");
const log = (0, logger_1.createJobLogger)('payout-processor');
const processPayoutJob = async (job) => {
    const { payoutId, userId, amountCents, currency, method, stripeAccountId } = job.data;
    log.info({ payoutId, userId, amountCents }, 'Processing payout');
    try {
        await supabase_1.supabase.from('payouts').update({ status: 'processing' }).eq('id', payoutId);
        if (method === 'stripe' && stripeAccountId) {
            const transfer = await stripe_1.stripe.transfers.create({
                amount: amountCents,
                currency: currency.toLowerCase(),
                destination: stripeAccountId,
                metadata: { payoutId, userId },
            });
            log.info({ transferId: transfer.id }, 'Stripe transfer created');
        }
        await supabase_1.supabase.from('payouts').update({
            status: 'completed',
            processed_at: new Date().toISOString(),
        }).eq('id', payoutId);
        await supabase_1.supabase.from('wallets').update({
            points_balance: supabase_1.supabase.rpc('decrement_points', { amount: amountCents }),
        }).eq('user_id', userId);
        log.info({ payoutId }, 'Payout completed');
    }
    catch (error) {
        log.error({ payoutId, error }, 'Payout failed');
        await supabase_1.supabase.from('payouts').update({ status: 'failed' }).eq('id', payoutId);
        throw error;
    }
};
exports.processPayoutJob = processPayoutJob;
exports.payoutWorker = (0, queue_1.createWorker)('payouts', exports.processPayoutJob, 3);
const scheduleDailyPayouts = async () => {
    log.info('Running daily payout processing');
    const { data: pendingPayouts, error } = await supabase_1.supabase
        .from('payouts')
        .select('id, user_id, amount_cents, currency, payout_details')
        .eq('status', 'pending')
        .gte('amount_cents', config_1.config.thresholds.minPayoutCents);
    if (error) {
        log.error({ error }, 'Failed to fetch pending payouts');
        return;
    }
    for (const payout of pendingPayouts || []) {
        const { data: user } = await supabase_1.supabase
            .from('users')
            .select('kyc_status')
            .eq('id', payout.user_id)
            .single();
        if (user?.kyc_status !== 'verified') {
            log.warn({ userId: payout.user_id }, 'Skipping payout - KYC not verified');
            continue;
        }
        await queue_1.payoutQueue.add('process-payout', {
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
exports.scheduleDailyPayouts = scheduleDailyPayouts;
//# sourceMappingURL=payout-processor.js.map
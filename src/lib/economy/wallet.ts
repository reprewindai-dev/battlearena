/**
 * Wallet utility functions for the dual-currency economy.
 * Crowns = reputation currency (earned, not bought)
 * Tokens = purchasable currency (via Stripe)
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/service";

export type CurrencyType = 'tokens' | 'crowns';

export type TransactionType =
  | 'purchase'
  | 'battle_win'
  | 'battle_participation'
  | 'tournament_prize'
  | 'tournament_entry'
  | 'admin_grant'
  | 'refund'
  | 'spend'
  | 'crown_battle_win'
  | 'crown_tournament_win'
  | 'crown_daily_login'
  | 'crown_referral';

export interface WalletBalance {
  token_balance: number;
  crown_balance: number;
  lifetime_tokens_earned: number;
  lifetime_crowns_earned: number;
}

export interface TransactionRecord {
  id: string;
  user_id: string;
  currency: CurrencyType;
  amount: number;
  balance_after: number;
  type: TransactionType;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  created_at: string;
}

/**
 * Get or initialize a user's wallet.
 */
export async function getWallet(userId: string): Promise<WalletBalance> {
  const client = createSupabaseServiceRoleClient();
  const { data, error } = await client
    .from('user_wallets')
    .select('token_balance,crown_balance,lifetime_tokens_earned,lifetime_crowns_earned')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const { data: newWallet, error: createError } = await client
      .from('user_wallets')
      .insert({ user_id: userId, token_balance: 0, crown_balance: 0 })
      .select('token_balance,crown_balance,lifetime_tokens_earned,lifetime_crowns_earned')
      .single();
    if (createError) throw createError;
    return newWallet as WalletBalance;
  }

  return data as WalletBalance;
}

/**
 * Credit or debit a user's wallet in one atomic step.
 * Returns the new balance after the transaction.
 */
export async function transact(params: {
  userId: string;
  currency: CurrencyType;
  amount: number;           // positive = credit, negative = debit
  type: TransactionType;
  description?: string;
  referenceId?: string;
  referenceType?: string;
}): Promise<{ newBalance: number; transactionId: string }> {
  const { userId, currency, amount, type, description, referenceId, referenceType } = params;
  const client = createSupabaseServiceRoleClient();

  // Ensure wallet exists
  await client
    .from('user_wallets')
    .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });

  const balanceField = currency === 'tokens' ? 'token_balance' : 'crown_balance';
  const lifetimeField = currency === 'tokens' ? 'lifetime_tokens_earned' : 'lifetime_crowns_earned';

  // Fetch current balance
  const { data: wallet, error: fetchError } = await client
    .from('user_wallets')
    .select(`${balanceField},${lifetimeField}`)
    .eq('user_id', userId)
    .single();

  if (fetchError) throw fetchError;

  const currentBalance = (wallet as Record<string, number>)[balanceField] ?? 0;
  const newBalance = Math.max(0, currentBalance + amount);

  const updates: Record<string, number | string> = {
    [balanceField]: newBalance,
    updated_at: new Date().toISOString(),
  };

  if (amount > 0) {
    const currentLifetime = (wallet as Record<string, number>)[lifetimeField] ?? 0;
    updates[lifetimeField] = currentLifetime + amount;
  }

  const { error: updateError } = await client
    .from('user_wallets')
    .update(updates)
    .eq('user_id', userId);

  if (updateError) throw updateError;

  const { data: tx, error: txError } = await client
    .from('wallet_transactions')
    .insert({
      user_id: userId,
      currency,
      amount,
      balance_after: newBalance,
      type,
      description: description ?? null,
      reference_id: referenceId ?? null,
      reference_type: referenceType ?? null,
    })
    .select('id')
    .single();

  if (txError) throw txError;

  return { newBalance, transactionId: (tx as { id: string }).id };
}

/**
 * Award Crowns for a battle win.
 */
export async function awardBattleCrowns(userId: string, battleId: string): Promise<void> {
  const CROWNS_PER_WIN = 10;
  await transact({
    userId,
    currency: 'crowns',
    amount: CROWNS_PER_WIN,
    type: 'crown_battle_win',
    description: `Battle win reward`,
    referenceId: battleId,
    referenceType: 'battle',
  });
}

/**
 * Award participation tokens after any battle.
 */
export async function awardParticipationTokens(userId: string, battleId: string): Promise<void> {
  const TOKENS_PER_BATTLE = 2;
  await transact({
    userId,
    currency: 'tokens',
    amount: TOKENS_PER_BATTLE,
    type: 'battle_participation',
    description: `Battle participation reward`,
    referenceId: battleId,
    referenceType: 'battle',
  });
}

/**
 * Deduct tournament entry fee from tokens.
 * Returns false if insufficient balance.
 */
export async function deductTournamentEntryFee(
  userId: string,
  tournamentId: string,
  entryFeeTokens: number
): Promise<boolean> {
  if (entryFeeTokens <= 0) return true;
  const wallet = await getWallet(userId);
  if (wallet.token_balance < entryFeeTokens) return false;

  await transact({
    userId,
    currency: 'tokens',
    amount: -entryFeeTokens,
    type: 'tournament_entry',
    description: `Tournament entry fee`,
    referenceId: tournamentId,
    referenceType: 'tournament',
  });
  return true;
}

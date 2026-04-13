alter table public.user_profiles
  add column if not exists token_balance integer not null default 0;

insert into public.user_profiles (user_id, display_name, tier, token_balance)
select
  u.id,
  u.username,
  'bronze',
  greatest(
    coalesce((
      select sum(coalesce(pl.tokens, 0) + coalesce(pl.bonus_tokens, 0))
      from public.payment_ledger pl
      where pl.user_id = u.id
        and pl.status in ('completed', 'succeeded', 'paid')
    ), 0) -
    coalesce((
      select sum(coalesce(tt.tokens_spent, 0))
      from public.token_transactions tt
      where tt.user_id = u.id
    ), 0),
    0
  )
from public.users u
on conflict (user_id) do update
set
  display_name = coalesce(public.user_profiles.display_name, excluded.display_name),
  tier = coalesce(public.user_profiles.tier, excluded.tier),
  token_balance = case
    when public.user_profiles.token_balance = 0 then excluded.token_balance
    else public.user_profiles.token_balance
  end,
  updated_at = now();

insert into public.user_ratings (
  user_id,
  rating,
  deviation,
  volatility,
  tier,
  tier_progress,
  wins,
  losses,
  streak
)
select
  u.id,
  1000,
  350,
  0.06,
  'bronze',
  0,
  coalesce(u.wins, 0),
  coalesce(u.losses, 0),
  0
from public.users u
on conflict (user_id) do nothing;

insert into public.wallets (user_id, crowns_balance, points_balance)
select
  u.id,
  0,
  0
from public.users u
on conflict (user_id) do nothing;

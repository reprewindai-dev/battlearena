-- Production billing runtime tables/functions for Stripe-backed token purchases and subscriptions.

begin;

create table if not exists public.user_billing_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  default_payment_method text,
  active_subscription_plan text,
  active_subscription_status text,
  stripe_subscription_id text,
  subscription_current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_kind text not null check (payment_kind in ('token_purchase','subscription')),
  status text not null default 'pending' check (status in ('pending','succeeded','failed','canceled')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null,
  tokens integer not null default 0 check (tokens >= 0),
  token_package integer,
  bonus_tokens integer not null default 0,
  subscription_plan text,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  stripe_invoice_id text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists idx_payment_ledger_idempotency_key
  on public.payment_ledger(idempotency_key)
  where idempotency_key is not null;

create unique index if not exists idx_payment_ledger_payment_intent
  on public.payment_ledger(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists idx_payment_ledger_subscription
  on public.payment_ledger(stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists idx_payment_ledger_user_created
  on public.payment_ledger(user_id, created_at desc);

create index if not exists idx_payment_ledger_kind_status_created
  on public.payment_ledger(payment_kind, status, created_at desc);

alter table public.user_billing_profiles enable row level security;
alter table public.payment_ledger enable row level security;

revoke all on public.user_billing_profiles from anon;
revoke all on public.user_billing_profiles from authenticated;
revoke all on public.payment_ledger from anon;
revoke all on public.payment_ledger from authenticated;

drop policy if exists payment_ledger_select_own on public.payment_ledger;
create policy payment_ledger_select_own
  on public.payment_ledger
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists billing_profile_select_own on public.user_billing_profiles;
create policy billing_profile_select_own
  on public.user_billing_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.increment_user_token_balance(
  p_user_id uuid,
  p_delta integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance integer;
begin
  if p_delta = 0 then
    select token_balance into v_new_balance
    from public.user_profiles
    where id = p_user_id;

    return coalesce(v_new_balance, 0);
  end if;

  update public.user_profiles
  set token_balance = coalesce(token_balance, 0) + p_delta,
      updated_at = now()
  where id = p_user_id
  returning token_balance into v_new_balance;

  if not found then
    insert into public.user_profiles (id, token_balance)
    values (p_user_id, greatest(p_delta, 0))
    on conflict (id) do update
      set token_balance = coalesce(public.user_profiles.token_balance, 0) + p_delta,
          updated_at = now()
    returning token_balance into v_new_balance;
  end if;

  return coalesce(v_new_balance, 0);
end;
$$;

grant execute on function public.increment_user_token_balance(uuid, integer) to authenticated;
grant execute on function public.increment_user_token_balance(uuid, integer) to service_role;

create or replace function public.finalize_token_purchase_ledger(
  p_ledger_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.payment_ledger%rowtype;
  v_new_balance integer;
begin
  select *
  into v_row
  from public.payment_ledger
  where id = p_ledger_id
  for update;

  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'ledger_not_found');
  end if;

  if v_row.payment_kind <> 'token_purchase' then
    return jsonb_build_object('ok', false, 'error', 'invalid_payment_kind');
  end if;

  if v_row.status = 'succeeded' then
    select token_balance
    into v_new_balance
    from public.user_profiles
    where id = v_row.user_id;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'new_balance', coalesce(v_new_balance, 0),
      'tokens_granted', coalesce(v_row.tokens, 0)
    );
  end if;

  if v_row.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'ledger_not_pending', 'status', v_row.status);
  end if;

  v_new_balance := public.increment_user_token_balance(v_row.user_id, coalesce(v_row.tokens, 0));

  update public.payment_ledger
  set status = 'succeeded',
      completed_at = now(),
      updated_at = now()
  where id = v_row.id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'new_balance', v_new_balance,
    'tokens_granted', coalesce(v_row.tokens, 0)
  );
end;
$$;

grant execute on function public.finalize_token_purchase_ledger(uuid) to service_role;

commit;

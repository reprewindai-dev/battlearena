-- Reconcile production runtime schema with the current API contracts.

begin;

create extension if not exists pgcrypto;

alter table if exists public.matchmaking_queue
  add column if not exists mode text,
  add column if not exists battle_id uuid,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists expires_at timestamptz not null default (now() + interval '10 minutes'),
  add column if not exists idempotency_key text,
  add column if not exists matched_at timestamptz;

update public.matchmaking_queue
set mode = case
  when queue_type = 'ranked' then 'ranked'
  when queue_type = 'tournament' then 'tournament'
  else 'freestyle'
end
where mode is null;

alter table if exists public.matchmaking_queue
  alter column mode set default 'freestyle';

create index if not exists idx_matchmaking_queue_mode_status_created
  on public.matchmaking_queue (mode, status, created_at);

create index if not exists idx_matchmaking_queue_queue_type_status_created
  on public.matchmaking_queue (queue_type, status, created_at);

create unique index if not exists idx_matchmaking_queue_idempotency_key
  on public.matchmaking_queue(idempotency_key)
  where idempotency_key is not null;

alter table if exists public.battles
  add column if not exists queue_type text,
  add column if not exists mode text,
  add column if not exists battle_format text,
  add column if not exists room_id text,
  add column if not exists expires_at timestamptz not null default (now() + interval '30 minutes'),
  add column if not exists ended_at timestamptz,
  add column if not exists result jsonb,
  add column if not exists fallback_reason text not null default 'none',
  add column if not exists wait_time_ms integer not null default 0,
  add column if not exists mmr_neutral boolean not null default false,
  add column if not exists entry_fee integer not null default 0,
  add column if not exists prize_pool integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

update public.battles
set mode = case
  when battle_type = 'ranked' then 'ranked'
  when battle_type = 'tournament' then 'tournament'
  else 'freestyle'
end
where mode is null;

update public.battles
set queue_type = case
  when mode = 'ranked' then 'ranked'
  when mode = 'tournament' then 'tournament'
  else 'freestyle'
end
where queue_type is null;

update public.battles
set battle_format = coalesce("format", '60s')
where battle_format is null;

update public.battles
set room_id = room_code
where room_id is null and room_code is not null;

do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'battles_room_id_unique'
  ) then
    create unique index battles_room_id_unique
      on public.battles(room_id)
      where room_id is not null;
  end if;
end $$;

create table if not exists public.battle_participants (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  slot integer not null check (slot in (1, 2)),
  status text not null default 'connected',
  score integer not null default 0,
  created_at timestamptz not null default now(),
  unique (battle_id, slot),
  unique (battle_id, user_id)
);

create index if not exists idx_battle_participants_battle_user
  on public.battle_participants (battle_id, user_id);

create table if not exists public.idempotency_keys (
  key text primary key,
  scope text not null default 'default',
  user_id uuid,
  status_code integer not null default 200,
  response jsonb,
  created_at timestamptz not null default now()
);

alter table if exists public.idempotency_keys
  add column if not exists scope text not null default 'default',
  add column if not exists user_id uuid,
  add column if not exists status_code integer not null default 200,
  add column if not exists response jsonb;

create table if not exists public.user_billing_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
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
  user_id uuid not null references public.users(id) on delete cascade,
  payment_kind text not null check (payment_kind in ('token_purchase','subscription')),
  status text not null default 'pending' check (status in ('pending','succeeded','failed','canceled')),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
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

drop function if exists public.cleanup_expired_queue();

create function public.cleanup_expired_queue()
returns integer
language plpgsql
set search_path = public
as $$
declare
  cleaned_count integer := 0;
begin
  delete from public.matchmaking_queue
  where expires_at < now()
     or status = 'expired';

  get diagnostics cleaned_count = row_count;
  return cleaned_count;
end;
$$;

commit;

-- Arena Community Foundation (v1)

begin;

create extension if not exists pgcrypto;

-- ============
-- Core tables
-- ============

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);

-- Battles
do $$
begin
  if not exists (select 1 from pg_type where typname = 'battle_status' and typnamespace = 'public'::regnamespace) then
    create type public.battle_status as enum ('draft','queued','live','complete','canceled');
  end if;
end
$$;

create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  status public.battle_status not null default 'draft',
  mode text not null default 'freestyle',
  started_at timestamptz,
  ended_at timestamptz,
  current_round int,
  voting_opened_at timestamptz,
  voting_closes_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.battles
add column if not exists current_round int;

alter table public.battles
add column if not exists voting_opened_at timestamptz;

alter table public.battles
add column if not exists voting_closes_at timestamptz;

create table if not exists public.battle_participants (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot int not null,
  score numeric,
  created_at timestamptz not null default now(),
  unique (battle_id, user_id),
  unique (battle_id, slot)
);

create table if not exists public.battle_messages (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists battle_messages_battle_created_at_idx
  on public.battle_messages (battle_id, created_at);

create table if not exists public.battle_votes (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  slot int not null,
  created_at timestamptz not null default now(),
  unique (battle_id, voter_user_id)
);

create index if not exists battle_votes_battle_slot_idx
  on public.battle_votes (battle_id, slot);

create table if not exists public.battle_recordings (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  storage_bucket text,
  storage_path text,
  mime_type text,
  duration_seconds int,
  bytes int,
  note text,
  uploaded_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at);

alter table public.battle_recordings
add column if not exists uploaded_at timestamptz;

create index if not exists battle_recordings_battle_created_at_idx
  on public.battle_recordings (battle_id, created_at);

-- Storage bucket for recordings
insert into storage.buckets (id, name, public)
values ('battle-recordings', 'battle-recordings', false)
on conflict (id) do nothing;

-- Ratings (Glicko placeholders)
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  rating numeric not null default 1500,
  rd numeric not null default 350,
  vol numeric not null default 0.06,
  updated_at timestamptz not null default now()
);

-- Economy (double-entry style)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ledger_currency' and typnamespace = 'public'::regnamespace) then
    create type public.ledger_currency as enum ('token','creator_point');
  end if;
  if not exists (select 1 from pg_type where typname = 'ledger_entry_type' and typnamespace = 'public'::regnamespace) then
    create type public.ledger_entry_type as enum ('debit','credit');
  end if;
  if not exists (select 1 from pg_type where typname = 'ledger_tx_status' and typnamespace = 'public'::regnamespace) then
    create type public.ledger_tx_status as enum ('pending','posted','reversed','canceled');
  end if;
end
$$;

create table if not exists public.economy_transactions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  actor_user_id uuid references auth.users(id),
  memo text,
  status public.ledger_tx_status not null default 'pending',
  created_at timestamptz not null default now(),
  posted_at timestamptz
);

create table if not exists public.economy_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tx_id uuid not null references public.economy_transactions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  currency public.ledger_currency not null,
  entry_type public.ledger_entry_type not null,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

-- Moderation
do $$
begin
  if not exists (select 1 from pg_type where typname = 'moderation_status' and typnamespace = 'public'::regnamespace) then
    create type public.moderation_status as enum ('open','in_review','resolved','escalated','closed');
  end if;
end
$$;

create table if not exists public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id),
  subject_user_id uuid references auth.users(id),
  battle_id uuid references public.battles(id),
  reason text,
  status public.moderation_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.moderation_cases(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  action_type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.appeals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.moderation_cases(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  message text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- Tournaments (stub)
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

-- PPV events (stub)
create table if not exists public.ppv_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

-- Audit log (security events)
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  ip inet,
  user_agent text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============
-- RBAC helpers
-- ============

create or replace function public.has_role(role_name text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.role_assignments ra
    join public.roles r on r.id = ra.role_id
    where ra.user_id = auth.uid()
      and r.name = role_name
  );
$$;

-- Seed roles
insert into public.roles (name)
values ('user'), ('mod'), ('admin')
on conflict (name) do nothing;

-- ============
-- RLS
-- ============

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.role_assignments enable row level security;
alter table public.battles enable row level security;
alter table public.battle_participants enable row level security;
alter table public.battle_messages enable row level security;
alter table public.battle_votes enable row level security;
alter table public.battle_recordings enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.ratings enable row level security;
alter table public.economy_transactions enable row level security;
alter table public.economy_ledger_entries enable row level security;
alter table public.moderation_cases enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.appeals enable row level security;
alter table public.tournaments enable row level security;
alter table public.ppv_events enable row level security;
alter table public.audit_log enable row level security;

-- Profiles: user can read/update own profile
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "profiles_select_battle_participants" on public.profiles;
create policy "profiles_select_battle_participants" on public.profiles
for select
to authenticated
using (
  public.has_role('admin')
  or public.has_role('mod')
  or user_id = auth.uid()
  or exists (
    select 1
    from public.battle_participants them
    join public.battle_participants me
      on me.battle_id = them.battle_id
    where them.user_id = profiles.user_id
      and me.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.battle_participants them
    join public.battles b
      on b.id = them.battle_id
    where them.user_id = profiles.user_id
      and b.created_by = auth.uid()
  )
);

-- Storage objects: protect battle recordings bucket
alter table storage.objects enable row level security;

drop policy if exists "storage_battle_recordings_select" on storage.objects;
create policy "storage_battle_recordings_select" on storage.objects
for select
to authenticated
using (
  bucket_id = 'battle-recordings'
  and (
    public.has_role('admin')
    or public.has_role('mod')
    or exists (
      select 1
      from public.battles b
      where b.id::text = split_part(storage.objects.name, '/', 1)
        and (
          b.created_by = auth.uid()
          or exists (
            select 1 from public.battle_participants bp
            where bp.battle_id = b.id
              and bp.user_id = auth.uid()
          )
        )
    )
  )
);

drop policy if exists "storage_battle_recordings_insert" on storage.objects;
create policy "storage_battle_recordings_insert" on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'battle-recordings'
  and (
    public.has_role('admin')
    or public.has_role('mod')
    or exists (
      select 1
      from public.battles b
      where b.id::text = split_part(storage.objects.name, '/', 1)
        and (
          b.created_by = auth.uid()
          or exists (
            select 1 from public.battle_participants bp
            where bp.battle_id = b.id
              and bp.user_id = auth.uid()
          )
        )
    )
  )
);

drop policy if exists "storage_battle_recordings_delete" on storage.objects;
create policy "storage_battle_recordings_delete" on storage.objects
for delete
to authenticated
using (
  bucket_id = 'battle-recordings'
  and (
    public.has_role('admin')
    or public.has_role('mod')
    or exists (
      select 1
      from public.battles b
      where b.id::text = split_part(storage.objects.name, '/', 1)
        and (
          b.created_by = auth.uid()
          or exists (
            select 1
            from public.battle_participants bp
            where bp.battle_id = b.id
              and bp.user_id = auth.uid()
          )
        )
    )
  )
);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Roles: admin only
drop policy if exists "roles_admin_select" on public.roles;
create policy "roles_admin_select" on public.roles
for select
to authenticated
using (public.has_role('admin'));

drop policy if exists "role_assignments_admin_all" on public.role_assignments;
create policy "role_assignments_admin_all" on public.role_assignments
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

-- Battles: safe pattern (client read limited; server RPC preferred)
drop policy if exists "battles_select_participant" on public.battles;
create policy "battles_select_participant" on public.battles
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.battle_participants bp
    where bp.battle_id = battles.id and bp.user_id = auth.uid()
  )
  or public.has_role('admin')
  or public.has_role('mod')
);

drop policy if exists "battles_insert_own" on public.battles;
create policy "battles_insert_own" on public.battles
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "battles_update_owner_or_mod" on public.battles;
create policy "battles_update_owner_or_mod" on public.battles
for update
to authenticated
using (
  created_by = auth.uid()
  or public.has_role('admin')
  or public.has_role('mod')
)
with check (
  created_by = auth.uid()
  or public.has_role('admin')
  or public.has_role('mod')
);

drop policy if exists "battle_participants_select_participant" on public.battle_participants;
create policy "battle_participants_select_participant" on public.battle_participants
for select
to authenticated
using (
  public.has_role('admin')
  or public.has_role('mod')
  or user_id = auth.uid()
  or exists (
    select 1
    from public.battles b
    where b.id = battle_participants.battle_id
      and b.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.battle_participants me
    where me.battle_id = battle_participants.battle_id
      and me.user_id = auth.uid()
  )
);

drop policy if exists "battle_participants_insert_self" on public.battle_participants;
create policy "battle_participants_insert_self" on public.battle_participants
for insert
to authenticated
with check (user_id = auth.uid());

-- Battle messages: participants/creator/mod/admin can read; participants can write
drop policy if exists "battle_messages_select_participant" on public.battle_messages;
create policy "battle_messages_select_participant" on public.battle_messages
for select
to authenticated
using (
  public.has_role('admin')
  or public.has_role('mod')
  or exists (
    select 1 from public.battles b
    where b.id = battle_messages.battle_id
      and b.created_by = auth.uid()
  )
  or exists (
    select 1 from public.battle_participants bp
    where bp.battle_id = battle_messages.battle_id
      and bp.user_id = auth.uid()
  )
);

drop policy if exists "battle_messages_insert_participant" on public.battle_messages;
create policy "battle_messages_insert_participant" on public.battle_messages
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    exists (
      select 1 from public.battles b
      where b.id = battle_messages.battle_id
        and b.created_by = auth.uid()
    )
    or exists (
      select 1 from public.battle_participants bp
      where bp.battle_id = battle_messages.battle_id
        and bp.user_id = auth.uid()
    )
    or public.has_role('admin')
    or public.has_role('mod')
  )
);

-- Battle votes: participants/creator/mod/admin can read; any authenticated can vote once per battle
drop policy if exists "battle_votes_select_participant" on public.battle_votes;
create policy "battle_votes_select_participant" on public.battle_votes
for select
to authenticated
using (
  public.has_role('admin')
  or public.has_role('mod')
  or voter_user_id = auth.uid()
  or exists (
    select 1 from public.battles b
    where b.id = battle_votes.battle_id
      and b.created_by = auth.uid()
  )
  or exists (
    select 1 from public.battle_participants bp
    where bp.battle_id = battle_votes.battle_id
      and bp.user_id = auth.uid()
  )
);

drop policy if exists "battle_votes_insert_self" on public.battle_votes;
create policy "battle_votes_insert_self" on public.battle_votes
for insert
to authenticated
with check (
  voter_user_id = auth.uid()
  and slot in (1, 2)
  and (
    public.has_role('admin')
    or public.has_role('mod')
    or exists (
      select 1 from public.battles b
      where b.id = battle_votes.battle_id
        and b.created_by = auth.uid()
    )
    or exists (
      select 1 from public.battle_participants bp
      where bp.battle_id = battle_votes.battle_id
        and bp.user_id = auth.uid()
    )
  )
);

-- Battle recordings metadata: participants/creator/mod/admin can read; participants can write
drop policy if exists "battle_recordings_select_participant" on public.battle_recordings;
create policy "battle_recordings_select_participant" on public.battle_recordings
for select
to authenticated
using (
  public.has_role('admin')
  or public.has_role('mod')
  or created_by = auth.uid()
  or exists (
    select 1 from public.battles b
    where b.id = battle_recordings.battle_id
      and b.created_by = auth.uid()
  )
  or exists (
    select 1 from public.battle_participants bp
    where bp.battle_id = battle_recordings.battle_id
      and bp.user_id = auth.uid()
  )
);

drop policy if exists "battle_recordings_insert_participant" on public.battle_recordings;
create policy "battle_recordings_insert_participant" on public.battle_recordings
for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    public.has_role('admin')
    or public.has_role('mod')
    or exists (
      select 1 from public.battles b
      where b.id = battle_recordings.battle_id
        and b.created_by = auth.uid()
    )
    or exists (
      select 1 from public.battle_participants bp
      where bp.battle_id = battle_recordings.battle_id
        and bp.user_id = auth.uid()
    )
  )
);

drop policy if exists "battle_recordings_update_participant" on public.battle_recordings;
create policy "battle_recordings_update_participant" on public.battle_recordings
for update
to authenticated
using (
  public.has_role('admin')
  or public.has_role('mod')
  or created_by = auth.uid()
  or exists (
    select 1 from public.battles b
    where b.id = battle_recordings.battle_id
      and b.created_by = auth.uid()
  )
  or exists (
    select 1 from public.battle_participants bp
    where bp.battle_id = battle_recordings.battle_id
      and bp.user_id = auth.uid()
  )
)
with check (
  public.has_role('admin')
  or public.has_role('mod')
  or created_by = auth.uid()
  or exists (
    select 1 from public.battles b
    where b.id = battle_recordings.battle_id
      and b.created_by = auth.uid()
  )
  or exists (
    select 1 from public.battle_participants bp
    where bp.battle_id = battle_recordings.battle_id
      and bp.user_id = auth.uid()
  )
);

drop policy if exists "battle_recordings_delete_participant" on public.battle_recordings;
create policy "battle_recordings_delete_participant" on public.battle_recordings
for delete
to authenticated
using (
  public.has_role('admin')
  or public.has_role('mod')
  or (
    uploaded_at is null
    and (
      created_by = auth.uid()
      or exists (
        select 1 from public.battles b
        where b.id = battle_recordings.battle_id
          and b.created_by = auth.uid()
      )
      or exists (
        select 1 from public.battle_participants bp
        where bp.battle_id = battle_recordings.battle_id
          and bp.user_id = auth.uid()
      )
    )
  )
);

-- Admin audit log: mod/admin can read; mod/admin can insert their own entries
drop policy if exists "admin_audit_log_select_mod" on public.admin_audit_log;
create policy "admin_audit_log_select_mod" on public.admin_audit_log
for select
to authenticated
using (public.has_role('admin') or public.has_role('mod'));

drop policy if exists "admin_audit_log_insert_mod" on public.admin_audit_log;
create policy "admin_audit_log_insert_mod" on public.admin_audit_log
for insert
to authenticated
with check (
  (public.has_role('admin') or public.has_role('mod'))
  and (actor_user_id is null or actor_user_id = auth.uid())
);

-- RPC: list stale recordings for cleanup jobs
create or replace function public.list_stale_recordings(
  cutoff timestamptz,
  after_created_at timestamptz default null,
  batch_size int default 200
)
returns table (
  id uuid,
  storage_bucket text,
  storage_path text,
  created_at timestamptz
)
language sql
stable
as $$
  select br.id, br.storage_bucket, br.storage_path, br.created_at
  from public.battle_recordings br
  where br.uploaded_at is null
    and br.created_at < cutoff
    and (after_created_at is null or br.created_at > after_created_at)
  order by br.created_at asc
  limit greatest(1, least(batch_size, 1000));
$$;

-- Ratings: user can read own
drop policy if exists "ratings_select_own" on public.ratings;
create policy "ratings_select_own" on public.ratings
for select
to authenticated
using (user_id = auth.uid());

-- Economy: locked down (no direct client writes)
drop policy if exists "economy_transactions_select_own" on public.economy_transactions;
create policy "economy_transactions_select_own" on public.economy_transactions
for select
to authenticated
using (actor_user_id = auth.uid() or public.has_role('admin'));

drop policy if exists "economy_transactions_no_client_writes" on public.economy_transactions;
create policy "economy_transactions_no_client_writes" on public.economy_transactions
for insert
to authenticated
with check (false);

drop policy if exists "economy_entries_select_own" on public.economy_ledger_entries;
create policy "economy_entries_select_own" on public.economy_ledger_entries
for select
to authenticated
using (user_id = auth.uid() or public.has_role('admin'));

drop policy if exists "economy_entries_no_client_writes" on public.economy_ledger_entries;
create policy "economy_entries_no_client_writes" on public.economy_ledger_entries
for insert
to authenticated
with check (false);

-- Moderation: mods/admins can view queue
drop policy if exists "moderation_cases_select_mod" on public.moderation_cases;
create policy "moderation_cases_select_mod" on public.moderation_cases
for select
to authenticated
using (public.has_role('admin') or public.has_role('mod'));

drop policy if exists "moderation_actions_select_mod" on public.moderation_actions;
create policy "moderation_actions_select_mod" on public.moderation_actions
for select
to authenticated
using (public.has_role('admin') or public.has_role('mod'));

drop policy if exists "appeals_select_own" on public.appeals;
create policy "appeals_select_own" on public.appeals
for select
to authenticated
using (created_by = auth.uid() or public.has_role('admin') or public.has_role('mod'));

-- Stubs: admin only
drop policy if exists "tournaments_admin" on public.tournaments;
create policy "tournaments_admin" on public.tournaments
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

drop policy if exists "ppv_admin" on public.ppv_events;
create policy "ppv_admin" on public.ppv_events
for all
to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

drop policy if exists "audit_admin" on public.audit_log;
create policy "audit_admin" on public.audit_log
for select
to authenticated
using (public.has_role('admin'));

-- ============
-- RPC stubs (security definer)
-- ============

create table if not exists public.idempotency_keys (
  key text primary key,
  created_at timestamptz not null default now()
);

alter table public.idempotency_keys enable row level security;
drop policy if exists "idempotency_no_client" on public.idempotency_keys;
create policy "idempotency_no_client" on public.idempotency_keys
for all
to authenticated
using (false)
with check (false);

create or replace function public.record_battle_result(
  p_idempotency_key text,
  p_battle_id uuid,
  p_result jsonb
) returns jsonb
language plpgsql
security definer
as $$
begin
  if exists (select 1 from public.idempotency_keys where key = p_idempotency_key) then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;

  insert into public.idempotency_keys(key) values (p_idempotency_key);

  update public.battles
  set status = 'complete', result = p_result, ended_at = now(), updated_at = now()
  where id = p_battle_id;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'record_battle_result', 'battle', p_battle_id, jsonb_build_object('result', p_result));

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.create_economy_transaction(
  p_idempotency_key text,
  p_currency public.ledger_currency,
  p_amount numeric,
  p_memo text
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_tx_id uuid;
begin
  if exists (select 1 from public.idempotency_keys where key = p_idempotency_key) then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;

  insert into public.idempotency_keys(key) values (p_idempotency_key);

  insert into public.economy_transactions(idempotency_key, actor_user_id, memo, status, posted_at)
  values (p_idempotency_key, auth.uid(), p_memo, 'posted', now())
  returning id into v_tx_id;

  -- Placeholder: real system will enforce balanced debits/credits.
  insert into public.economy_ledger_entries(tx_id, user_id, currency, entry_type, amount)
  values (v_tx_id, auth.uid(), p_currency, 'credit', p_amount);

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'economy_transaction', 'economy_transaction', v_tx_id, jsonb_build_object('currency', p_currency, 'amount', p_amount));

  return jsonb_build_object('ok', true, 'tx_id', v_tx_id);
end;
$$;

create or replace function public.moderation_take_action(
  p_idempotency_key text,
  p_case_id uuid,
  p_action_type text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_action_id uuid;
begin
  if not (public.has_role('admin') or public.has_role('mod')) then
    raise exception 'not_authorized';
  end if;

  if exists (select 1 from public.idempotency_keys where key = p_idempotency_key) then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;

  insert into public.idempotency_keys(key) values (p_idempotency_key);

  insert into public.moderation_actions(case_id, actor_user_id, action_type, payload)
  values (p_case_id, auth.uid(), p_action_type, p_payload)
  returning id into v_action_id;

  insert into public.audit_log(actor_user_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'moderation_action', 'moderation_case', p_case_id, jsonb_build_object('action_id', v_action_id, 'type', p_action_type));

  return jsonb_build_object('ok', true, 'action_id', v_action_id);
end;
$$;

commit;

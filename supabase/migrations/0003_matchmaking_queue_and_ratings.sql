-- Matchmaking queue + rating update RPCs

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'matchmaking_status' and typnamespace = 'public'::regnamespace) then
    create type public.matchmaking_status as enum ('queued','matched','canceled');
  end if;
end
$$;

create table if not exists public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'freestyle',
  status public.matchmaking_status not null default 'queued',
  battle_id uuid references public.battles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, mode, status)
);

create index if not exists matchmaking_queue_status_created_at_idx
  on public.matchmaking_queue (status, created_at);

alter table public.matchmaking_queue enable row level security;

drop policy if exists "matchmaking_queue_select_own" on public.matchmaking_queue;
create policy "matchmaking_queue_select_own" on public.matchmaking_queue
for select
to authenticated
using (user_id = auth.uid() or public.has_role('admin') or public.has_role('mod'));

drop policy if exists "matchmaking_queue_insert_own" on public.matchmaking_queue;
create policy "matchmaking_queue_insert_own" on public.matchmaking_queue
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "matchmaking_queue_update_own" on public.matchmaking_queue;
create policy "matchmaking_queue_update_own" on public.matchmaking_queue
for update
to authenticated
using (user_id = auth.uid() or public.has_role('admin') or public.has_role('mod'))
with check (user_id = auth.uid() or public.has_role('admin') or public.has_role('mod'));

-- RPC: enqueue for matchmaking and attempt to match immediately.
create or replace function public.matchmake_enqueue(
  p_idempotency_key text,
  p_mode text default 'freestyle'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self_id uuid;
  v_self_row public.matchmaking_queue%rowtype;
  v_other_row public.matchmaking_queue%rowtype;
  v_battle_id uuid;
  v_existing jsonb;
begin
  v_self_id := auth.uid();
  if v_self_id is null then
    raise exception 'unauthorized';
  end if;

  if exists (select 1 from public.idempotency_keys where key = p_idempotency_key) then
    select jsonb_build_object('ok', true, 'idempotent', true) into v_existing;
    return v_existing;
  end if;

  insert into public.idempotency_keys(key) values (p_idempotency_key);

  -- Ensure we have a queued row
  insert into public.matchmaking_queue(user_id, mode, status)
  values (v_self_id, p_mode, 'queued')
  on conflict (user_id, mode, status) do update
    set updated_at = now()
  returning * into v_self_row;

  -- Try find opponent
  select * into v_other_row
  from public.matchmaking_queue
  where status = 'queued'
    and mode = p_mode
    and user_id <> v_self_id
  order by created_at asc
  limit 1
  for update skip locked;

  if v_other_row.id is null then
    return jsonb_build_object('ok', true, 'matched', false, 'queue_id', v_self_row.id);
  end if;

  -- Create battle
  insert into public.battles(created_by, status, mode, started_at, current_round, voting_opened_at, voting_closes_at)
  values (v_self_id, 'live', p_mode, now(), 1, now(), now() + interval '2 minutes')
  returning id into v_battle_id;

  insert into public.battle_participants(battle_id, user_id, slot)
  values (v_battle_id, v_self_id, 1);

  insert into public.battle_participants(battle_id, user_id, slot)
  values (v_battle_id, v_other_row.user_id, 2);

  update public.matchmaking_queue
  set status = 'matched', battle_id = v_battle_id, updated_at = now()
  where id in (v_self_row.id, v_other_row.id);

  return jsonb_build_object(
    'ok', true,
    'matched', true,
    'battle_id', v_battle_id,
    'opponent_user_id', v_other_row.user_id
  );
end;
$$;

create or replace function public.matchmaking_status(p_mode text default 'freestyle')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self_id uuid;
  v_row public.matchmaking_queue%rowtype;
begin
  v_self_id := auth.uid();
  if v_self_id is null then
    raise exception 'unauthorized';
  end if;

  select * into v_row
  from public.matchmaking_queue
  where user_id = v_self_id
    and mode = p_mode
    and status in ('queued','matched')
  order by created_at desc
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('ok', true, 'status', 'none');
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', v_row.status,
    'battle_id', v_row.battle_id,
    'queue_id', v_row.id
  );
end;
$$;

-- RPC: apply Elo rating update for a completed battle
create or replace function public.apply_battle_elo_ratings(
  p_idempotency_key text,
  p_battle_id uuid,
  p_winner_slot int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_ra numeric;
  v_rb numeric;
  v_k numeric := 32;
  v_ea numeric;
  v_eb numeric;
  v_sa numeric;
  v_sb numeric;
  v_new_a numeric;
  v_new_b numeric;
  v_tx jsonb;
begin
  if exists (select 1 from public.idempotency_keys where key = p_idempotency_key) then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;

  insert into public.idempotency_keys(key) values (p_idempotency_key);

  select user_id into v_user_a from public.battle_participants where battle_id = p_battle_id and slot = 1 limit 1;
  select user_id into v_user_b from public.battle_participants where battle_id = p_battle_id and slot = 2 limit 1;

  if v_user_a is null or v_user_b is null then
    return jsonb_build_object('ok', false, 'error', 'missing_participants');
  end if;

  select rating into v_ra from public.ratings where user_id = v_user_a;
  select rating into v_rb from public.ratings where user_id = v_user_b;

  v_ra := coalesce(v_ra, 1500);
  v_rb := coalesce(v_rb, 1500);

  if p_winner_slot = 1 then
    v_sa := 1; v_sb := 0;
  elsif p_winner_slot = 2 then
    v_sa := 0; v_sb := 1;
  else
    v_sa := 0.5; v_sb := 0.5;
  end if;

  v_ea := 1 / (1 + power(10, (v_rb - v_ra) / 400));
  v_eb := 1 / (1 + power(10, (v_ra - v_rb) / 400));

  v_new_a := v_ra + v_k * (v_sa - v_ea);
  v_new_b := v_rb + v_k * (v_sb - v_eb);

  update public.ratings set rating = v_new_a, updated_at = now() where user_id = v_user_a;
  update public.ratings set rating = v_new_b, updated_at = now() where user_id = v_user_b;

  v_tx := jsonb_build_object(
    'user_a', v_user_a,
    'user_b', v_user_b,
    'before', jsonb_build_object('a', v_ra, 'b', v_rb),
    'after', jsonb_build_object('a', v_new_a, 'b', v_new_b)
  );

  return jsonb_build_object('ok', true, 'elo', v_tx);
end;
$$;

commit;

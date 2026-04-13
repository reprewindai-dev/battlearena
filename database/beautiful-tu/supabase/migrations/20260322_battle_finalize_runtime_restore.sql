create table if not exists public.battle_votes (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  slot int not null check (slot in (1, 2)),
  created_at timestamptz not null default now(),
  unique (battle_id, voter_user_id)
);

create index if not exists battle_votes_battle_slot_idx
  on public.battle_votes (battle_id, slot);

alter table public.battle_votes enable row level security;

drop policy if exists "battle_votes_select_participant" on public.battle_votes;
create policy "battle_votes_select_participant" on public.battle_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.battles b
    where b.id = battle_votes.battle_id
      and b.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.battle_participants bp
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
  and (
    exists (
      select 1
      from public.battles b
      where b.id = battle_votes.battle_id
        and b.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.battle_participants bp
      where bp.battle_id = battle_votes.battle_id
        and bp.user_id = auth.uid()
    )
  )
);

create or replace function public.record_battle_result(
  p_idempotency_key text,
  p_battle_id uuid,
  p_result jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.idempotency_keys where key = p_idempotency_key) then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;

  insert into public.idempotency_keys(key, scope, user_id, status_code, response)
  values (
    p_idempotency_key,
    'battle_result',
    auth.uid(),
    200,
    jsonb_build_object('ok', true, 'idempotent', false)
  );

  update public.battles
  set status = 'complete',
      result = p_result,
      ended_at = coalesce(ended_at, now()),
      updated_at = now()
  where id = p_battle_id;

  return jsonb_build_object('ok', true);
end;
$$;

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
  v_wins_a integer;
  v_losses_a integer;
  v_streak_a integer;
  v_wins_b integer;
  v_losses_b integer;
  v_streak_b integer;
  v_tx jsonb;
begin
  if exists (select 1 from public.idempotency_keys where key = p_idempotency_key) then
    return jsonb_build_object('ok', true, 'idempotent', true);
  end if;

  insert into public.idempotency_keys(key, scope, user_id, status_code, response)
  values (
    p_idempotency_key,
    'battle_elo',
    auth.uid(),
    200,
    jsonb_build_object('ok', true, 'idempotent', false)
  );

  select user_id into v_user_a
  from public.battle_participants
  where battle_id = p_battle_id and slot = 1
  limit 1;

  select user_id into v_user_b
  from public.battle_participants
  where battle_id = p_battle_id and slot = 2
  limit 1;

  if v_user_a is null or v_user_b is null then
    return jsonb_build_object('ok', false, 'error', 'missing_participants');
  end if;

  insert into public.user_ratings (user_id) values (v_user_a) on conflict (user_id) do nothing;
  insert into public.user_ratings (user_id) values (v_user_b) on conflict (user_id) do nothing;

  select
    coalesce(rating, 1000),
    coalesce(wins, 0),
    coalesce(losses, 0),
    coalesce(streak, 0)
  into v_ra, v_wins_a, v_losses_a, v_streak_a
  from public.user_ratings
  where user_id = v_user_a;

  select
    coalesce(rating, 1000),
    coalesce(wins, 0),
    coalesce(losses, 0),
    coalesce(streak, 0)
  into v_rb, v_wins_b, v_losses_b, v_streak_b
  from public.user_ratings
  where user_id = v_user_b;

  if p_winner_slot = 1 then
    v_sa := 1; v_sb := 0;
    v_wins_a := v_wins_a + 1;
    v_losses_b := v_losses_b + 1;
    v_streak_a := case when v_streak_a >= 0 then v_streak_a + 1 else 1 end;
    v_streak_b := case when v_streak_b <= 0 then v_streak_b - 1 else -1 end;
  elsif p_winner_slot = 2 then
    v_sa := 0; v_sb := 1;
    v_losses_a := v_losses_a + 1;
    v_wins_b := v_wins_b + 1;
    v_streak_a := case when v_streak_a <= 0 then v_streak_a - 1 else -1 end;
    v_streak_b := case when v_streak_b >= 0 then v_streak_b + 1 else 1 end;
  else
    v_sa := 0.5; v_sb := 0.5;
    v_streak_a := 0;
    v_streak_b := 0;
  end if;

  v_ea := 1 / (1 + power(10, (v_rb - v_ra) / 400));
  v_eb := 1 / (1 + power(10, (v_ra - v_rb) / 400));

  v_new_a := v_ra + v_k * (v_sa - v_ea);
  v_new_b := v_rb + v_k * (v_sb - v_eb);

  update public.user_ratings
  set rating = v_new_a,
      wins = v_wins_a,
      losses = v_losses_a,
      streak = v_streak_a,
      last_calculated = now(),
      updated_at = now()
  where user_id = v_user_a;

  update public.user_ratings
  set rating = v_new_b,
      wins = v_wins_b,
      losses = v_losses_b,
      streak = v_streak_b,
      last_calculated = now(),
      updated_at = now()
  where user_id = v_user_b;

  v_tx := jsonb_build_object(
    'user_a', v_user_a,
    'user_b', v_user_b,
    'before', jsonb_build_object('a', v_ra, 'b', v_rb),
    'after', jsonb_build_object('a', v_new_a, 'b', v_new_b)
  );

  return jsonb_build_object('ok', true, 'elo', v_tx);
end;
$$;

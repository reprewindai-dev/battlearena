-- Runtime RLS hardening for battles, participants, and queue contracts.
-- This migration is additive and safe to apply on drifted environments.

begin;

alter table if exists public.battles enable row level security;
alter table if exists public.battle_participants enable row level security;
alter table if exists public.matchmaking_queue enable row level security;
alter table if exists public.idempotency_keys enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'battles'
      and policyname = 'battles_select_participant_or_creator'
  ) then
    create policy battles_select_participant_or_creator
      on public.battles
      for select
      to authenticated
      using (
        created_by = auth.uid()
        or exists (
          select 1
          from public.battle_participants bp
          where bp.battle_id = battles.id
            and bp.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'battles'
      and policyname = 'battles_insert_non_bot_self'
  ) then
    create policy battles_insert_non_bot_self
      on public.battles
      for insert
      to authenticated
      with check (
        created_by = auth.uid()
        and coalesce(is_bot_battle, false) = false
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'battles'
      and policyname = 'battles_update_creator_or_staff'
  ) then
    create policy battles_update_creator_or_staff
      on public.battles
      for update
      to authenticated
      using (
        created_by = auth.uid()
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role') in ('admin','mod')
      )
      with check (
        (
          created_by = auth.uid()
          or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role') in ('admin','mod')
        )
        and (
          coalesce(is_bot_battle, false) = false
          or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role') in ('admin','mod')
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'battle_participants'
      and policyname = 'battle_participants_select_participants_only'
  ) then
    create policy battle_participants_select_participants_only
      on public.battle_participants
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.battle_participants bp
          where bp.battle_id = battle_participants.battle_id
            and bp.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'battle_participants'
      and policyname = 'battle_participants_insert_self_only'
  ) then
    create policy battle_participants_insert_self_only
      on public.battle_participants
      for insert
      to authenticated
      with check (
        user_id = auth.uid()
        and exists (
          select 1
          from public.battles b
          where b.id = battle_participants.battle_id
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'battle_participants'
      and policyname = 'battle_participants_update_self_or_staff'
  ) then
    create policy battle_participants_update_self_or_staff
      on public.battle_participants
      for update
      to authenticated
      using (
        user_id = auth.uid()
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role') in ('admin','mod')
      )
      with check (
        user_id = auth.uid()
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role') in ('admin','mod')
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'matchmaking_queue'
      and policyname = 'matchmaking_queue_select_own'
  ) then
    create policy matchmaking_queue_select_own
      on public.matchmaking_queue
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'matchmaking_queue'
      and policyname = 'matchmaking_queue_insert_own'
  ) then
    create policy matchmaking_queue_insert_own
      on public.matchmaking_queue
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'matchmaking_queue'
      and policyname = 'matchmaking_queue_update_own'
  ) then
    create policy matchmaking_queue_update_own
      on public.matchmaking_queue
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'matchmaking_queue'
      and policyname = 'matchmaking_queue_delete_own'
  ) then
    create policy matchmaking_queue_delete_own
      on public.matchmaking_queue
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

revoke all on table public.idempotency_keys from anon, authenticated;

commit;

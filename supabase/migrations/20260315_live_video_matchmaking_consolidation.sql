-- Consolidation migration for production live video + matchmaking bot fallback metadata.

begin;

alter table if exists public.battles
  add column if not exists is_bot_battle boolean not null default false,
  add column if not exists bot_personality_id text,
  add column if not exists bot_difficulty text,
  add column if not exists fallback_reason text not null default 'none',
  add column if not exists wait_time_ms integer not null default 0,
  add column if not exists mmr_neutral boolean not null default false;

alter table if exists public.matchmaking_queue
  add column if not exists idempotency_key text,
  add column if not exists matched_at timestamptz;

create unique index if not exists idx_matchmaking_queue_idempotency_key
  on public.matchmaking_queue(idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_matchmaking_queue_queue_type_status_created
  on public.matchmaking_queue(queue_type, status, created_at);

create index if not exists idx_matchmaking_queue_mode_status_created
  on public.matchmaking_queue(mode, status, created_at);

create index if not exists idx_battle_participants_battle_user
  on public.battle_participants(battle_id, user_id);

create index if not exists idx_battles_is_bot_battle
  on public.battles(is_bot_battle, created_at desc);

create table if not exists public.idempotency_keys (
  key text primary key,
  created_at timestamptz not null default now()
);

alter table if exists public.idempotency_keys enable row level security;

-- service-role only write/read
revoke all on table public.idempotency_keys from anon, authenticated;

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

commit;

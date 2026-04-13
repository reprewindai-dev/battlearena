-- Add missing challenge + notification runtime tables aligned to users schema.

begin;

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.users(id) on delete cascade,
  challenged_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired','completed')),
  battle_mode text not null default 'freestyle' check (battle_mode in ('freestyle','ranked','wager')),
  wager_tokens integer null check (wager_tokens is null or wager_tokens > 0),
  message text null,
  battle_id uuid null references public.battles(id) on delete set null,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (challenger_id <> challenged_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (
    type in (
      'battle_invite',
      'battle_result',
      'follow',
      'vote_result',
      'challenge',
      'tournament_start',
      'tournament_result',
      'achievement',
      'system',
      'moderation'
    )
  ),
  title text not null,
  body text null,
  link text null,
  actor_id uuid null references public.users(id) on delete set null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_challenges_challenger on public.challenges(challenger_id, status, created_at desc);
create index if not exists idx_challenges_challenged on public.challenges(challenged_id, status, created_at desc);
create index if not exists idx_challenges_expires on public.challenges(expires_at);
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, created_at desc) where read_at is null;

alter table if exists public.challenges enable row level security;
alter table if exists public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'challenges' and policyname = 'challenges_select_participants'
  ) then
    create policy challenges_select_participants
      on public.challenges for select to authenticated
      using (auth.uid() = challenger_id or auth.uid() = challenged_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'challenges' and policyname = 'challenges_insert_own'
  ) then
    create policy challenges_insert_own
      on public.challenges for insert to authenticated
      with check (auth.uid() = challenger_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'challenges' and policyname = 'challenges_update_participants'
  ) then
    create policy challenges_update_participants
      on public.challenges for update to authenticated
      using (auth.uid() = challenger_id or auth.uid() = challenged_id)
      with check (auth.uid() = challenger_id or auth.uid() = challenged_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_select_own'
  ) then
    create policy notifications_select_own
      on public.notifications for select to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_update_own'
  ) then
    create policy notifications_update_own
      on public.notifications for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_insert_authenticated'
  ) then
    create policy notifications_insert_authenticated
      on public.notifications for insert to authenticated
      with check (true);
  end if;
end $$;

grant select, insert, update on public.challenges to authenticated;
grant select, insert, update on public.notifications to authenticated;

commit;

-- Community feed/follows/leaderboard runtime objects aligned to users + user_profiles(user_id).

begin;

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.activity_feed (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id) on delete cascade,
  type text not null check (
    type in (
      'battle_win',
      'battle_complete',
      'achievement_earned',
      'joined_tournament',
      'challenge_issued',
      'rank_up',
      'first_battle'
    )
  ),
  subject_id uuid,
  subject_type text,
  meta jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_follows_follower on public.follows(follower_id, created_at desc);
create index if not exists idx_follows_following on public.follows(following_id, created_at desc);
create index if not exists idx_activity_feed_created on public.activity_feed(created_at desc);
create index if not exists idx_activity_feed_actor on public.activity_feed(actor_id, created_at desc);
create index if not exists idx_activity_feed_type on public.activity_feed(type, created_at desc);

create or replace view public.leaderboard as
select
  row_number() over (
    order by coalesce(ur.rating, 1000)::numeric desc, coalesce(ur.wins, u.wins, 0) desc
  )::bigint as rank,
  u.id,
  u.username as handle,
  up.display_name,
  up.avatar_url,
  coalesce(ur.rating, 1000)::integer as elo_rating,
  coalesce(ur.wins, u.wins, 0)::integer as wins,
  coalesce(ur.losses, u.losses, 0)::integer as losses,
  coalesce(ur.wins, u.wins, 0)::integer + coalesce(ur.losses, u.losses, 0)::integer as total_battles,
  coalesce(ur.tier, up.tier, 'bronze')::text as tier,
  coalesce(u.is_verified, false) as is_verified,
  coalesce(
    round(
      (
        coalesce(ur.wins, u.wins, 0)::numeric
        / nullif((coalesce(ur.wins, u.wins, 0) + coalesce(ur.losses, u.losses, 0))::numeric, 0)
      ) * 100,
      1
    ),
    0
  ) as win_rate
from public.users u
left join public.user_profiles up on up.user_id = u.id
left join public.user_ratings ur on ur.user_id = u.id
where coalesce(u.is_banned, false) = false
  and (coalesce(ur.wins, u.wins, 0) + coalesce(ur.losses, u.losses, 0)) > 0
order by coalesce(ur.rating, 1000)::numeric desc, coalesce(ur.wins, u.wins, 0) desc;

alter table if exists public.follows enable row level security;
alter table if exists public.activity_feed enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'follows' and policyname = 'follows_select_authenticated'
  ) then
    create policy follows_select_authenticated
      on public.follows for select to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'follows' and policyname = 'follows_insert_own'
  ) then
    create policy follows_insert_own
      on public.follows for insert to authenticated
      with check (follower_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'follows' and policyname = 'follows_delete_own'
  ) then
    create policy follows_delete_own
      on public.follows for delete to authenticated
      using (follower_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'activity_feed' and policyname = 'activity_feed_select_public_or_actor'
  ) then
    create policy activity_feed_select_public_or_actor
      on public.activity_feed for select to authenticated
      using (is_public = true or actor_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'activity_feed' and policyname = 'activity_feed_insert_own'
  ) then
    create policy activity_feed_insert_own
      on public.activity_feed for insert to authenticated
      with check (actor_id = auth.uid());
  end if;
end $$;

grant select on public.follows to authenticated;
grant insert, delete on public.follows to authenticated;
grant select on public.activity_feed to authenticated;
grant insert on public.activity_feed to authenticated;
grant select on public.leaderboard to authenticated;

commit;

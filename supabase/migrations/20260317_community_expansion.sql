-- Community expansion aligned to runtime schema (users + existing community tables).

begin;

create table if not exists public.community_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'scheduled' check (status in ('scheduled','live','completed','cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  host_user_id uuid not null references public.users(id) on delete cascade,
  is_public boolean not null default true,
  max_attendees integer not null default 200 check (max_attendees > 0 and max_attendees <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.community_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'registered' check (status in ('registered','attended','cancelled')),
  registered_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists idx_crews_created_at on public.crews(created_at desc);
create index if not exists idx_crew_members_crew on public.crew_members(crew_id);
create index if not exists idx_crew_members_user on public.crew_members(user_id);
create index if not exists idx_mentorships_mentor on public.mentorships(mentor_id, started_at desc);
create index if not exists idx_mentorships_mentee on public.mentorships(mentee_id, started_at desc);
create index if not exists idx_community_events_starts on public.community_events(starts_at, status);
create index if not exists idx_event_attendees_event on public.community_event_attendees(event_id, status);
create index if not exists idx_event_attendees_user on public.community_event_attendees(user_id, status);

alter table if exists public.crews enable row level security;
alter table if exists public.crew_members enable row level security;
alter table if exists public.mentorships enable row level security;
alter table if exists public.community_events enable row level security;
alter table if exists public.community_event_attendees enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'crews' and policyname = 'crews_select_authenticated'
  ) then
    create policy crews_select_authenticated
      on public.crews for select to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'crews' and policyname = 'crews_insert_leader'
  ) then
    create policy crews_insert_leader
      on public.crews for insert to authenticated
      with check (leader_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'crews' and policyname = 'crews_update_leader'
  ) then
    create policy crews_update_leader
      on public.crews for update to authenticated
      using (leader_id = auth.uid())
      with check (leader_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'crew_members' and policyname = 'crew_members_select_authenticated'
  ) then
    create policy crew_members_select_authenticated
      on public.crew_members for select to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'crew_members' and policyname = 'crew_members_insert_self_or_leader'
  ) then
    create policy crew_members_insert_self_or_leader
      on public.crew_members for insert to authenticated
      with check (
        user_id = auth.uid()
        or exists (
          select 1
          from public.crews c
          where c.id = crew_members.crew_id
            and c.leader_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'crew_members' and policyname = 'crew_members_delete_self_or_leader'
  ) then
    create policy crew_members_delete_self_or_leader
      on public.crew_members for delete to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.crews c
          where c.id = crew_members.crew_id
            and c.leader_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'mentorships' and policyname = 'mentorships_select_participants'
  ) then
    create policy mentorships_select_participants
      on public.mentorships for select to authenticated
      using (mentor_id = auth.uid() or mentee_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'mentorships' and policyname = 'mentorships_insert_mentee'
  ) then
    create policy mentorships_insert_mentee
      on public.mentorships for insert to authenticated
      with check (mentee_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'mentorships' and policyname = 'mentorships_update_participants'
  ) then
    create policy mentorships_update_participants
      on public.mentorships for update to authenticated
      using (mentor_id = auth.uid() or mentee_id = auth.uid())
      with check (mentor_id = auth.uid() or mentee_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'community_events' and policyname = 'community_events_select_public_or_host'
  ) then
    create policy community_events_select_public_or_host
      on public.community_events for select to authenticated
      using (is_public = true or host_user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'community_events' and policyname = 'community_events_insert_host'
  ) then
    create policy community_events_insert_host
      on public.community_events for insert to authenticated
      with check (host_user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'community_events' and policyname = 'community_events_update_host'
  ) then
    create policy community_events_update_host
      on public.community_events for update to authenticated
      using (host_user_id = auth.uid())
      with check (host_user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'community_event_attendees' and policyname = 'event_attendees_select_self_or_host'
  ) then
    create policy event_attendees_select_self_or_host
      on public.community_event_attendees for select to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.community_events e
          where e.id = community_event_attendees.event_id
            and e.host_user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'community_event_attendees' and policyname = 'event_attendees_insert_self'
  ) then
    create policy event_attendees_insert_self
      on public.community_event_attendees for insert to authenticated
      with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'community_event_attendees' and policyname = 'event_attendees_delete_self_or_host'
  ) then
    create policy event_attendees_delete_self_or_host
      on public.community_event_attendees for delete to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.community_events e
          where e.id = community_event_attendees.event_id
            and e.host_user_id = auth.uid()
        )
      );
  end if;
end $$;

grant select on public.crews to authenticated;
grant select on public.crew_members to authenticated;
grant select on public.mentorships to authenticated;
grant select on public.community_events to authenticated;
grant select on public.community_event_attendees to authenticated;
grant insert, update, delete on public.crews to authenticated;
grant insert, delete on public.crew_members to authenticated;
grant insert, update on public.mentorships to authenticated;
grant insert, update on public.community_events to authenticated;
grant insert, delete on public.community_event_attendees to authenticated;

commit;

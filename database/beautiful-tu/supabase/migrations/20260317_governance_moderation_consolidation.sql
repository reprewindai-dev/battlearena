-- Consolidate governance + moderation runtime tables required by admin/live APIs.
create extension if not exists pgcrypto;

create table if not exists public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  player_id uuid references auth.users(id) on delete set null,
  match_id text,
  event_data jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists telemetry_events_type_ts_idx
  on public.telemetry_events(event_type, timestamp desc);
create index if not exists telemetry_events_match_idx
  on public.telemetry_events(match_id);

create table if not exists public.match_opponent_plans (
  id uuid primary key default gen_random_uuid(),
  match_id text not null,
  plan_id text not null,
  governance_tier text not null default 'FALLBACK',
  risk_scores jsonb not null default '{}'::jsonb,
  persona text not null default 'Aggro',
  drama_archetype text not null default 'control_win',
  difficulty_band text not null default 'mid',
  cost_per_plan numeric not null default 0,
  latency_ms integer not null default 0,
  model_version text not null default 'fallback',
  threshold_version text not null default '1.0',
  validation_results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists match_opponent_plans_created_idx
  on public.match_opponent_plans(created_at desc);
create index if not exists match_opponent_plans_tier_idx
  on public.match_opponent_plans(governance_tier);
create index if not exists match_opponent_plans_match_id_idx
  on public.match_opponent_plans(match_id);

create table if not exists public.fairness_monitoring (
  id uuid primary key default gen_random_uuid(),
  monitoring_window timestamptz not null default now(),
  total_matches integer not null default 0,
  win_rate numeric not null default 0.5,
  close_match_rate numeric not null default 0,
  win_rate_violation boolean not null default false,
  close_match_violation boolean not null default false,
  circuit_breaker_triggered boolean not null default false,
  dynamic_drama_disabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fairness_monitoring_window_idx
  on public.fairness_monitoring(monitoring_window desc);

create table if not exists public.red_team_simulations (
  id uuid primary key default gen_random_uuid(),
  simulation_type text not null,
  run_date timestamptz not null default now(),
  test_parameters jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  vulnerabilities_found integer not null default 0,
  policy_updates_required integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists red_team_simulations_run_date_idx
  on public.red_team_simulations(run_date desc);

create table if not exists public.governance_circuit_breaker_state (
  id text primary key default 'global',
  state text not null default 'CLOSED'
    check (state in ('CLOSED', 'OPEN', 'HALF_OPEN')),
  failures integer not null default 0,
  last_failure_time timestamptz,
  reset_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.governance_circuit_breaker_state (id, state, failures)
values ('global', 'CLOSED', 0)
on conflict (id) do nothing;

create table if not exists public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  battle_id uuid references public.battles(id) on delete set null,
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'in_review', 'resolved', 'escalated', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists moderation_cases_status_idx
  on public.moderation_cases(status, created_at desc);
create index if not exists moderation_cases_subject_idx
  on public.moderation_cases(subject_user_id, created_at desc);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.moderation_cases(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  action_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists moderation_actions_case_idx
  on public.moderation_actions(case_id, created_at desc);

alter table if exists public.telemetry_events enable row level security;
alter table if exists public.match_opponent_plans enable row level security;
alter table if exists public.fairness_monitoring enable row level security;
alter table if exists public.red_team_simulations enable row level security;
alter table if exists public.governance_circuit_breaker_state enable row level security;
alter table if exists public.moderation_cases enable row level security;
alter table if exists public.moderation_actions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'telemetry_events' and policyname = 'telemetry_events_select_staff'
  ) then
    create policy telemetry_events_select_staff
      on public.telemetry_events
      for select
      using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'mod')
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'telemetry_events' and policyname = 'telemetry_events_insert_service'
  ) then
    create policy telemetry_events_insert_service
      on public.telemetry_events
      for insert
      with check (auth.role() = 'service_role');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'match_opponent_plans' and policyname = 'match_opponent_plans_select_staff'
  ) then
    create policy match_opponent_plans_select_staff
      on public.match_opponent_plans
      for select
      using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'mod')
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'match_opponent_plans' and policyname = 'match_opponent_plans_insert_service'
  ) then
    create policy match_opponent_plans_insert_service
      on public.match_opponent_plans
      for insert
      with check (auth.role() = 'service_role');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fairness_monitoring' and policyname = 'fairness_monitoring_select_staff'
  ) then
    create policy fairness_monitoring_select_staff
      on public.fairness_monitoring
      for select
      using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'mod')
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fairness_monitoring' and policyname = 'fairness_monitoring_write_service'
  ) then
    create policy fairness_monitoring_write_service
      on public.fairness_monitoring
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'red_team_simulations' and policyname = 'red_team_simulations_select_staff'
  ) then
    create policy red_team_simulations_select_staff
      on public.red_team_simulations
      for select
      using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'mod')
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'red_team_simulations' and policyname = 'red_team_simulations_insert_service'
  ) then
    create policy red_team_simulations_insert_service
      on public.red_team_simulations
      for insert
      with check (auth.role() = 'service_role');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'governance_circuit_breaker_state' and policyname = 'circuit_state_select_staff'
  ) then
    create policy circuit_state_select_staff
      on public.governance_circuit_breaker_state
      for select
      using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'mod')
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'governance_circuit_breaker_state' and policyname = 'circuit_state_write_service'
  ) then
    create policy circuit_state_write_service
      on public.governance_circuit_breaker_state
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'moderation_cases' and policyname = 'moderation_cases_select_staff_or_owner'
  ) then
    create policy moderation_cases_select_staff_or_owner
      on public.moderation_cases
      for select
      using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'mod')
        or auth.uid() = created_by
        or auth.uid() = subject_user_id
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'moderation_cases' and policyname = 'moderation_cases_insert_reporter'
  ) then
    create policy moderation_cases_insert_reporter
      on public.moderation_cases
      for insert
      with check (auth.uid() = created_by);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'moderation_cases' and policyname = 'moderation_cases_update_staff'
  ) then
    create policy moderation_cases_update_staff
      on public.moderation_cases
      for update
      using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'mod')
      )
      with check (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'mod')
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'moderation_actions' and policyname = 'moderation_actions_select_staff'
  ) then
    create policy moderation_actions_select_staff
      on public.moderation_actions
      for select
      using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'mod')
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'moderation_actions' and policyname = 'moderation_actions_insert_staff'
  ) then
    create policy moderation_actions_insert_staff
      on public.moderation_actions
      for insert
      with check (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'mod')
      );
  end if;
end
$$;

grant select on public.telemetry_events to authenticated;
grant select, insert on public.match_opponent_plans to authenticated;
grant select on public.fairness_monitoring to authenticated;
grant select on public.red_team_simulations to authenticated;
grant select on public.governance_circuit_breaker_state to authenticated;
grant select, insert, update on public.moderation_cases to authenticated;
grant select, insert on public.moderation_actions to authenticated;

grant all on public.telemetry_events to service_role;
grant all on public.match_opponent_plans to service_role;
grant all on public.fairness_monitoring to service_role;
grant all on public.red_team_simulations to service_role;
grant all on public.governance_circuit_breaker_state to service_role;
grant all on public.moderation_cases to service_role;
grant all on public.moderation_actions to service_role;

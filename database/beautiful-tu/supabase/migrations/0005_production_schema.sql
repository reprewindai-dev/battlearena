-- Production-ready schema for Battle Arena
-- Includes monetization, analytics, and enterprise features

-- Extend profiles for monetization
alter table public.profiles add column if not exists subscription_tier text default 'free' check (subscription_tier in ('free', 'pro', 'enterprise'));
alter table public.profiles add column if not exists stripe_customer_id text unique;
alter table public.profiles add column if not exists subscription_id text unique;
alter table public.profiles add column if not exists subscription_status text default null check (subscription_status in ('active', 'canceled', 'past_due', 'unpaid'));
alter table public.profiles add column if not exists subscription_ends_at timestamptz;
alter table public.profiles add column if not exists battles_used_this_month int default 0;
alter table public.profiles add column if not exists api_key text unique;
alter table public.profiles add column if not exists api_usage_count int default 0;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Subscription plans
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  stripe_price_id text not null unique,
  price_amount_cents int not null,
  price_currency text not null default 'usd',
  billing_interval text not null check (billing_interval in ('month', 'year')),
  features jsonb not null default '{}',
  battles_per_month int default 3,
  api_calls_per_month int default 1000,
  video_audio_enabled boolean default false,
  analytics_enabled boolean default false,
  tournaments_enabled boolean default false,
  white_label_enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Usage tracking
create table if not exists public.usage_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  event_type text not null check (event_type in ('battle_created', 'battle_participated', 'api_call', 'video_session', 'tournament_created')),
  event_data jsonb default '{}',
  created_at timestamptz default now()
);

-- Payment events
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  stripe_event_id text unique not null,
  event_type text not null,
  event_data jsonb not null,
  processed_at timestamptz default now()
);

-- Analytics
create table if not exists public.battle_analytics (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles(id) on delete cascade,
  participant_id uuid not null references public.profiles(user_id) on delete cascade,
  viewer_count int default 0,
  engagement_score decimal(5,2) default 0.00,
  audio_quality_score decimal(5,2) default 0.00,
  video_quality_score decimal(5,2) default 0.00,
  session_duration_seconds int default 0,
  created_at timestamptz default now()
);

-- Tournaments
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles(user_id) on delete cascade,
  entry_fee_cents int default 0,
  prize_pool_cents int default 0,
  max_participants int default 16,
  status text default 'upcoming' check (status in ('upcoming', 'active', 'completed', 'canceled')),
  starts_at timestamptz,
  ends_at timestamptz,
  rules jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tournament participants
create table if not exists public.tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  bracket_position int,
  status text default 'registered' check (status in ('registered', 'eliminated', 'winner')),
  eliminated_at timestamptz,
  unique(tournament_id, user_id)
);

-- Enterprise white-label configs
create table if not exists public.white_label_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  domain text not null unique,
  branding jsonb default '{}',
  custom_css text,
  enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Insert default subscription plans
insert into public.subscription_plans (name, stripe_price_id, price_amount_cents, billing_interval, features, battles_per_month, api_calls_per_month, video_audio_enabled, analytics_enabled, tournaments_enabled, white_label_enabled)
values 
  ('Free', 'price_free', 0, 'month', '{"basic_features": true}', 3, 1000, false, false, false, false),
  ('Pro', 'price_pro_monthly', 999, 'month', '{"video_audio": true, "analytics": true, "unlimited_battles": true}', -1, 10000, true, true, false, false),
  ('Enterprise', 'price_enterprise_monthly', 4999, 'month', '{"video_audio": true, "analytics": true, "unlimited_battles": true, "tournaments": true, "white_label": true, "api_access": true}', -1, -1, true, true, true, true)
on conflict (name) do nothing;

-- RLS policies for monetization
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = user_id);

create policy "Users can view own usage" on public.usage_tracking for select using (auth.uid() = user_id);
create policy "Users can insert own usage" on public.usage_tracking for insert with check (auth.uid() = user_id);

create policy "Users can view own payment events" on public.payment_events for select using (auth.uid() = user_id);

create policy "Users can view analytics for their battles" on public.battle_analytics for select using (
  exists (select 1 from public.battle_participants bp where bp.battle_id = battle_analytics.battle_id and bp.user_id = auth.uid())
);

-- Indexes for performance
create index if not exists idx_profiles_subscription_tier on public.profiles(subscription_tier);
create index if not exists idx_profiles_stripe_customer_id on public.profiles(stripe_customer_id);
create index if not exists idx_usage_tracking_user_event on public.usage_tracking(user_id, event_type, created_at);
create index if not exists idx_payment_events_user on public.payment_events(user_id, event_type);
create index if not exists idx_battle_analytics_battle on public.battle_analytics(battle_id);
create index if not exists idx_tournaments_status on public.tournaments(status);
create index if not exists idx_tournament_participants_tournament on public.tournament_participants(tournament_id);

-- Functions for subscription management
create or replace function public.check_subscription_limit(p_user_id uuid, p_action text) returns boolean
language plpgsql
security definer
as $$
declare
  v_profile public.profiles%rowtype;
  v_usage_count int;
begin
  select * into v_profile from public.profiles where user_id = p_user_id;
  
  if v_profile.subscription_tier = 'enterprise' then
    return true;
  end if;
  
  if v_profile.subscription_tier = 'pro' and p_action in ('battle_created', 'video_session', 'analytics') then
    return true;
  end if;
  
  if p_action = 'battle_created' then
    select count(*) into v_usage_count 
    from public.usage_tracking 
    where user_id = p_user_id 
      and event_type = 'battle_created' 
      and created_at >= date_trunc('month', now());
    
    return v_usage_count < 3;
  end if;
  
  if p_action = 'api_call' then
    select count(*) into v_usage_count 
    from public.usage_tracking 
    where user_id = p_user_id 
      and event_type = 'api_call' 
      and created_at >= date_trunc('month', now());
    
    return v_usage_count < 1000;
  end if;
  
  return false;
end;
$$;

-- Function to track usage
create or replace function public.track_usage(p_user_id uuid, p_event_type text, p_event_data jsonb default '{}')
returns void
language plpgsql
security definer
as $$
begin
  insert into public.usage_tracking(user_id, event_type, event_data)
  values (p_user_id, p_event_type, p_event_data);
end;
$$;

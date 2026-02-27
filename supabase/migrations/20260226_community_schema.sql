-- ============================================================
-- BATTLE ARENA: COMMUNITY SCHEMA MIGRATION
-- 2026-02-26 | Production
-- ============================================================

-- ── 1. USER PROFILES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle        TEXT UNIQUE,
  display_name  TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  elo_rating    INTEGER NOT NULL DEFAULT 1000,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  total_battles INTEGER NOT NULL DEFAULT 0,
  token_balance INTEGER NOT NULL DEFAULT 0,
  total_earnings DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tier          TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum','diamond','legend')),
  is_verified   BOOLEAN NOT NULL DEFAULT false,
  is_banned     BOOLEAN NOT NULL DEFAULT false,
  last_active_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all" ON public.user_profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, handle, display_name)
  VALUES (
    NEW.id,
    LOWER(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', '_')) || '_' || SUBSTR(NEW.id::TEXT, 1, 6),
    SPLIT_PART(NEW.email, '@', 1)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. FOLLOWS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows_select_all" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_own" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ── 3. NOTIFICATIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
    'battle_invite','battle_result','follow','vote_result',
    'challenge','tournament_start','tournament_result',
    'achievement','system','moderation'
  )),
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  actor_id    UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_service" ON public.notifications
  FOR INSERT WITH CHECK (true); -- service role only in practice

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

-- ── 4. ACHIEVEMENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  achievement_id  TEXT NOT NULL,
  label           TEXT NOT NULL,
  description     TEXT,
  icon            TEXT DEFAULT '🏆',
  rarity          TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  earned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements_select_all" ON public.user_achievements FOR SELECT USING (true);
CREATE POLICY "achievements_insert_service" ON public.user_achievements FOR INSERT WITH CHECK (true);

-- ── 5. CHALLENGES ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  challenged_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired','completed')),
  battle_mode     TEXT NOT NULL DEFAULT 'freestyle' CHECK (battle_mode IN ('freestyle','ranked','wager')),
  wager_tokens    INTEGER,
  message         TEXT,
  battle_id       UUID,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (challenger_id != challenged_id)
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges_select_participant" ON public.challenges
  FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);
CREATE POLICY "challenges_insert_own" ON public.challenges
  FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "challenges_update_participant" ON public.challenges
  FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

-- ── 6. TOURNAMENTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournaments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  description       TEXT,
  status            TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','registration','live','completed','cancelled')),
  format            TEXT NOT NULL DEFAULT 'single_elimination' CHECK (format IN ('single_elimination','double_elimination','round_robin')),
  max_participants  INTEGER NOT NULL DEFAULT 16,
  entry_fee_tokens  INTEGER NOT NULL DEFAULT 0,
  prize_pool_tokens INTEGER NOT NULL DEFAULT 0,
  starts_at         TIMESTAMPTZ NOT NULL,
  registration_ends_at TIMESTAMPTZ NOT NULL,
  created_by        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tournaments_select_all" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_insert_admin" ON public.tournaments FOR INSERT WITH CHECK (true);
CREATE POLICY "tournaments_update_admin" ON public.tournaments FOR UPDATE USING (true);

-- ── 7. TOURNAMENT PARTICIPANTS ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id   UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  seed            INTEGER,
  placement       INTEGER,
  is_eliminated   BOOLEAN NOT NULL DEFAULT false,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tp_select_all" ON public.tournament_participants FOR SELECT USING (true);
CREATE POLICY "tp_insert_own" ON public.tournament_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── 8. COMMUNITY ACTIVITY FEED ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
    'battle_win','battle_complete','achievement_earned',
    'joined_tournament','challenge_issued','rank_up','first_battle'
  )),
  subject_id  UUID,
  subject_type TEXT,
  meta        JSONB DEFAULT '{}',
  is_public   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_select_public" ON public.activity_feed FOR SELECT USING (is_public = true);
CREATE POLICY "feed_insert_service" ON public.activity_feed FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON public.activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_actor ON public.activity_feed(actor_id, created_at DESC);

-- ── 9. PROFILE STATS VIEW ─────────────────────────────────────
CREATE OR REPLACE VIEW public.player_stats AS
SELECT
  p.id,
  p.handle,
  p.display_name,
  p.avatar_url,
  p.elo_rating,
  p.wins,
  p.losses,
  p.total_battles,
  p.tier,
  p.is_verified,
  p.token_balance,
  p.total_earnings,
  p.created_at,
  COALESCE(
    ROUND(p.wins::numeric / NULLIF(p.total_battles, 0) * 100, 1), 0
  ) AS win_rate,
  (SELECT COUNT(*) FROM public.follows WHERE following_id = p.id) AS follower_count,
  (SELECT COUNT(*) FROM public.follows WHERE follower_id = p.id) AS following_count,
  (SELECT COUNT(*) FROM public.user_achievements WHERE user_id = p.id) AS achievement_count
FROM public.user_profiles p
WHERE p.is_banned = false;

-- ── 10. LEADERBOARD VIEW ──────────────────────────────────────
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  ROW_NUMBER() OVER (ORDER BY elo_rating DESC, wins DESC) AS rank,
  id,
  handle,
  display_name,
  avatar_url,
  elo_rating,
  wins,
  losses,
  total_battles,
  tier,
  is_verified,
  COALESCE(
    ROUND(wins::numeric / NULLIF(total_battles, 0) * 100, 1), 0
  ) AS win_rate
FROM public.user_profiles
WHERE is_banned = false
  AND total_battles > 0
ORDER BY elo_rating DESC, wins DESC;

-- ── 11. HELPER FUNCTIONS ──────────────────────────────────────

-- Update ELO after battle
CREATE OR REPLACE FUNCTION public.update_elo_after_battle(
  winner_id UUID,
  loser_id UUID,
  k_factor INTEGER DEFAULT 32
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  winner_elo INTEGER;
  loser_elo INTEGER;
  expected_win DECIMAL;
  elo_change INTEGER;
BEGIN
  SELECT elo_rating INTO winner_elo FROM public.user_profiles WHERE id = winner_id;
  SELECT elo_rating INTO loser_elo FROM public.user_profiles WHERE id = loser_id;

  expected_win := 1.0 / (1.0 + POWER(10, (loser_elo - winner_elo)::DECIMAL / 400));
  elo_change := ROUND(k_factor * (1 - expected_win));

  UPDATE public.user_profiles SET
    elo_rating = elo_rating + elo_change,
    wins = wins + 1,
    total_battles = total_battles + 1,
    tier = CASE
      WHEN elo_rating + elo_change >= 2200 THEN 'legend'
      WHEN elo_rating + elo_change >= 1800 THEN 'diamond'
      WHEN elo_rating + elo_change >= 1500 THEN 'platinum'
      WHEN elo_rating + elo_change >= 1200 THEN 'gold'
      WHEN elo_rating + elo_change >= 1000 THEN 'silver'
      ELSE 'bronze'
    END,
    updated_at = NOW()
  WHERE id = winner_id;

  UPDATE public.user_profiles SET
    elo_rating = GREATEST(100, elo_rating - elo_change),
    losses = losses + 1,
    total_battles = total_battles + 1,
    updated_at = NOW()
  WHERE id = loser_id;
END;
$$;

-- Grant read to anon for public views
GRANT SELECT ON public.player_stats TO anon, authenticated;
GRANT SELECT ON public.leaderboard TO anon, authenticated;
GRANT SELECT ON public.user_profiles TO anon, authenticated;
GRANT SELECT ON public.follows TO anon, authenticated;
GRANT SELECT ON public.tournaments TO anon, authenticated;
GRANT SELECT ON public.tournament_participants TO anon, authenticated;
GRANT SELECT ON public.user_achievements TO anon, authenticated;
GRANT SELECT ON public.activity_feed TO anon, authenticated;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.follows TO authenticated;
GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.challenges TO authenticated;
GRANT ALL ON public.tournament_participants TO authenticated;

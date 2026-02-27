import pg from 'pg';

const { Client } = pg;

async function implementBlueprintSchema() {
  const client = new Client({
    host: 'aws-1-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.xjnxrkdtdfvusofiwshu',
    password: 'kys48wlXoYWDbOEL',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    query_timeout: 30000
  });

  try {
    await client.connect();
    console.log('🔌 Connected to Supabase PostgreSQL');

    // Implement complete blueprint schema
    const schema = `
-- Drop existing tables if they exist (for clean implementation)
DROP TABLE IF EXISTS public.crew_members CASCADE;
DROP TABLE IF EXISTS public.crews CASCADE;
DROP TABLE IF EXISTS public.mentorships CASCADE;
DROP TABLE IF EXISTS public.user_moderation_history CASCADE;
DROP TABLE IF EXISTS public.ai_moderation_flags CASCADE;
DROP TABLE IF EXISTS public.moderation_reports CASCADE;
DROP TABLE IF EXISTS public.tournament_brackets CASCADE;
DROP TABLE IF EXISTS public.tournament_participants CASCADE;
DROP TABLE IF EXISTS public.tournaments CASCADE;
DROP TABLE IF EXISTS public.beat_reviews CASCADE;
DROP TABLE IF EXISTS public.beats CASCADE;
DROP TABLE IF EXISTS public.token_transactions CASCADE;
DROP TABLE IF EXISTS public.payouts CASCADE;
DROP TABLE IF EXISTS public.token_purchases CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.user_ratings CASCADE;
DROP TABLE IF EXISTS public.battle_rounds CASCADE;
DROP TABLE IF EXISTS public.battles CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Core Users & Authentication
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    phone VARCHAR(20),
    date_of_birth DATE,
    country_code CHAR(2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    ban_expires_at TIMESTAMP WITH TIME ZONE,
    kyc_status VARCHAR(20) DEFAULT 'none',
    kyc_data JSONB,
    preferences JSONB DEFAULT '{}',
    parental_controls JSONB DEFAULT '{}',
    skill_level INTEGER DEFAULT 50,
    battles_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0
);

-- User profiles
CREATE TABLE public.user_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(500),
    banner_url VARCHAR(500),
    social_links JSONB DEFAULT '{}',
    battle_stats JSONB DEFAULT '{}',
    reputation_score DECIMAL(10,2) DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'novice',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Battle System
CREATE TABLE public.battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID,
    battle_type VARCHAR(20) NOT NULL,
    format VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_by UUID REFERENCES public.users(id),
    participant_1_id UUID REFERENCES public.users(id),
    participant_2_id UUID REFERENCES public.users(id),
    winner_id UUID REFERENCES public.users(id),
    beat_id UUID,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    room_code VARCHAR(10) UNIQUE,
    rating_data JSONB,
    scoring_data JSONB,
    is_bot_battle BOOLEAN DEFAULT FALSE,
    bot_personality_id VARCHAR(50),
    bot_difficulty VARCHAR(10),
    current_round INTEGER DEFAULT 1,
    max_rounds INTEGER DEFAULT 3,
    participant_1_score INTEGER DEFAULT 0,
    participant_2_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Battle rounds
CREATE TABLE public.battle_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    player_id UUID NOT NULL REFERENCES public.users(id),
    audio_url VARCHAR(500),
    duration_seconds INTEGER,
    transcript TEXT,
    ai_analysis JSONB,
    judge_scores JSONB,
    audience_votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Battle sessions (for tracking active battles)
CREATE TABLE public.battle_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id),
    status VARCHAR(20) DEFAULT 'active',
    current_round INTEGER DEFAULT 1,
    is_bot_battle BOOLEAN DEFAULT FALSE,
    bot_personality_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matchmaking queue
CREATE TABLE public.matchmaking_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    queue_type VARCHAR(20) NOT NULL,
    battle_format VARCHAR(20) DEFAULT '60s',
    preferred_genres TEXT[],
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ratings and tiers
CREATE TABLE public.user_ratings (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    rating DECIMAL(10,2) DEFAULT 1500.00,
    deviation DECIMAL(10,2) DEFAULT 350.00,
    volatility DECIMAL(10,2) DEFAULT 0.06,
    tier VARCHAR(20) DEFAULT 'novice',
    tier_progress INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Economy System
CREATE TABLE public.wallets (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    crowns_balance BIGINT DEFAULT 0,
    points_balance BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.token_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    tokens_purchased INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    payment_method VARCHAR(50),
    payment_provider VARCHAR(50),
    transaction_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.token_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    recipient_id UUID REFERENCES public.users(id),
    tokens_spent INTEGER NOT NULL,
    points_earned INTEGER NOT NULL,
    platform_share INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    payment_method VARCHAR(50),
    payout_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Content Management
CREATE TABLE public.beats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    artist VARCHAR(200),
    tempo INTEGER NOT NULL,
    key_signature VARCHAR(10),
    genre VARCHAR(50),
    duration_seconds INTEGER,
    preview_url VARCHAR(500),
    file_url VARCHAR(500),
    license_type VARCHAR(20),
    license_url VARCHAR(500),
    source VARCHAR(50),
    usage_count INTEGER DEFAULT 0,
    rating_average DECIMAL(3,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.beat_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beat_id UUID NOT NULL REFERENCES public.beats(id),
    reviewer_id UUID NOT NULL REFERENCES public.users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(beat_id, reviewer_id)
);

-- Tournament System
CREATE TABLE public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    tournament_type VARCHAR(20) NOT NULL,
    format VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'upcoming',
    max_participants INTEGER,
    entry_fee_tokens INTEGER DEFAULT 0,
    prize_pool_tokens INTEGER,
    prize_structure JSONB,
    registration_opens TIMESTAMP WITH TIME ZONE,
    registration_closes TIMESTAMP WITH TIME ZONE,
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.tournament_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id),
    user_id UUID NOT NULL REFERENCES public.users(id),
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'registered',
    seed_number INTEGER,
    current_bracket_position JSONB,
    UNIQUE(tournament_id, user_id)
);

CREATE TABLE public.tournament_brackets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id),
    round_number INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    player1_id UUID REFERENCES public.users(id),
    player2_id UUID REFERENCES public.users(id),
    winner_id UUID REFERENCES public.users(id),
    battle_id UUID REFERENCES public.battles(id),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Moderation System
CREATE TABLE public.moderation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES public.users(id),
    reported_user_id UUID REFERENCES public.users(id),
    reported_content_type VARCHAR(50),
    reported_content_id UUID,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    assigned_moderator_id UUID REFERENCES public.users(id),
    resolution_action VARCHAR(100),
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.ai_moderation_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    user_id UUID REFERENCES public.users(id),
    flag_type VARCHAR(50) NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL,
    analysis_data JSONB,
    status VARCHAR(20) DEFAULT 'flagged',
    human_reviewer_id UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.user_moderation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    action_type VARCHAR(50) NOT NULL,
    reason VARCHAR(200) NOT NULL,
    duration_days INTEGER,
    applied_by UUID NOT NULL REFERENCES public.users(id),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Community & Social
CREATE TABLE public.crews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    tag VARCHAR(10) UNIQUE,
    description TEXT,
    leader_id UUID NOT NULL REFERENCES public.users(id),
    member_count INTEGER DEFAULT 1,
    crew_level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.crew_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(crew_id, user_id)
);

CREATE TABLE public.mentorships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES public.users(id),
    mentee_id UUID NOT NULL REFERENCES public.users(id),
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    UNIQUE(mentor_id, mentee_id)
);

-- Room System (from earlier implementation)
CREATE TABLE public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    room_type VARCHAR(50) NOT NULL DEFAULT 'general',
    max_participants INTEGER DEFAULT 100,
    current_participants INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_private BOOLEAN DEFAULT FALSE,
    room_code VARCHAR(10) UNIQUE,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tags TEXT[] DEFAULT '{}',
    settings JSONB DEFAULT '{}'
);

CREATE TABLE public.room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'participant',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_online BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    UNIQUE(room_id, user_id)
);

CREATE TABLE public.room_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    message_type VARCHAR(20) DEFAULT 'text',
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    reply_to UUID REFERENCES public.room_messages(id)
);

CREATE TABLE public.lobbies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    lobby_type VARCHAR(50) NOT NULL DEFAULT 'general',
    max_rooms INTEGER DEFAULT 50,
    current_rooms INTEGER DEFAULT 0,
    max_users_per_room INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    settings JSONB DEFAULT '{}'
);

CREATE TABLE public.room_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7) DEFAULT '#000000',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`;

    await client.query(schema);
    console.log('✅ Blueprint schema tables created');

    // Create indexes
    const indexes = `
-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON public.users(last_active);
CREATE INDEX IF NOT EXISTS idx_battles_status ON public.battles(status);
CREATE INDEX IF NOT EXISTS idx_battles_participants ON public.battles(participant_1_id, participant_2_id);
CREATE INDEX IF NOT EXISTS idx_battles_tournament ON public.battles(tournament_id);
CREATE INDEX IF NOT EXISTS idx_user_ratings_tier ON public.user_ratings(tier);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user ON public.token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created ON public.token_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_status ON public.moderation_reports(status);
CREATE INDEX IF NOT EXISTS idx_ai_flags_status ON public.ai_moderation_flags(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments(status);
CREATE INDEX IF NOT EXISTS idx_beats_status ON public.beats(status);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON public.rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_rooms_active ON public.rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_room_participants_room ON public.room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user ON public.room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_room ON public.room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_created ON public.room_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_lobbies_type ON public.lobbies(lobby_type);
CREATE INDEX IF NOT EXISTS idx_lobbies_active ON public.lobbies(is_active);
CREATE INDEX IF NOT EXISTS idx_lobbies_featured ON public.lobbies(is_featured);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_user ON public.matchmaking_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_type ON public.matchmaking_queue(queue_type);
`;

    await client.query(indexes);
    console.log('✅ Performance indexes created');

    // Insert sample data
    await insertSampleData(client);

    await client.end();
    console.log('🔌 Disconnected cleanly');
    
    console.log('\n🎉 Blueprint schema implementation complete!');
    console.log('📊 All tables from original blueprint have been created');
    
  } catch (err) {
    console.error('❌ Schema implementation failed:', err.message);
    process.exit(1);
  }
}

async function insertSampleData(client) {
  console.log('📝 Inserting sample data...');

  // Insert test user
  const testUserId = '93d4e785-678b-4e1e-92fd-1e9d26efc446';
  
  await client.query(`
    INSERT INTO public.users (id, username, email, skill_level, battles_played, wins, losses)
    VALUES ($1, 'TestUser', 'test@battlearena.com', 50, 0, 0, 0)
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      email = EXCLUDED.email,
      updated_at = now()
  `, [testUserId]);

  // Insert user profile
  await client.query(`
    INSERT INTO public.user_profiles (user_id, display_name, bio)
    VALUES ($1, 'Test User', 'Testing the battle arena system')
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      bio = EXCLUDED.bio,
      updated_at = now()
  `, [testUserId]);

  // Insert wallet
  await client.query(`
    INSERT INTO public.wallets (user_id, crowns_balance, points_balance)
    VALUES ($1, 1000, 500)
    ON CONFLICT (user_id) DO NOTHING
  `, [testUserId]);

  // Insert user ratings
  await client.query(`
    INSERT INTO public.user_ratings (user_id, rating, deviation, volatility, tier)
    VALUES ($1, 1500.00, 350.00, 0.06, 'novice')
    ON CONFLICT (user_id) DO NOTHING
  `, [testUserId]);

  // Insert room categories
  await client.query(`
    INSERT INTO public.room_categories (name, description, icon, color, sort_order)
    VALUES 
      ('Battle', 'Competitive rap battles', '⚔️', '#ef4444', 1),
      ('Freestyle', 'Casual freestyle sessions', '🎤', '#3b82f6', 2),
      ('Practice', 'Practice and improvement', '🎯', '#10b981', 3),
      ('Tournament', 'Official tournaments', '🏆', '#f59e0b', 4),
      ('Cypher', 'Group rap sessions', '🔄', '#8b5cf6', 5),
      ('Producer', 'Producer collaborations', '🎧', '#ec4899', 6),
      ('Open Mic', 'Open mic performances', '🎭', '#06b6d4', 7),
      ('Underground', 'Raw underground rap', '🌑', '#6b7280', 8)
    ON CONFLICT (name) DO NOTHING
  `);

  // Insert lobbies
  await client.query(`
    INSERT INTO public.lobbies (name, description, lobby_type, is_featured, sort_order)
    VALUES 
      ('Battle Arena', 'Main lobby for rap battles and competitions', 'battle', true, 1),
      ('Freestyle Zone', 'Casual freestyle rap sessions', 'freestyle', true, 2),
      ('Practice Room', 'Practice your skills with beats', 'practice', false, 3),
      ('Tournament Hall', 'Official tournament battles', 'tournament', true, 4),
      ('Underground', 'Raw underground rap battles', 'underground', false, 5),
      ('Cypher Circle', 'Group rap cyphers and sessions', 'cypher', false, 6),
      ('Producer Lounge', 'Connect with beat producers', 'producer', false, 7),
      ('Open Mic Night', 'Weekly open mic performances', 'openmic', false, 8)
    ON CONFLICT DO NOTHING
  `);

  // Insert sample rooms
  await client.query(`
    INSERT INTO public.rooms (name, description, room_type, max_participants, room_code, created_by, tags, settings)
    VALUES 
      ('Main Stage', 'The main battle arena for epic rap battles', 'battle', 50, 'MAIN001', $1, ARRAY['featured', 'battle'], '{"allow_spectators": true, "auto_record": true}'),
      ('Underground Cypher', 'Raw underground rap sessions', 'cypher', 20, 'CYPH001', $1, ARRAY['underground', 'raw'], '{"explicit_content": true}'),
      ('Practice Booth #1', 'Practice your rap skills', 'practice', 5, 'PRAC001', $1, ARRAY['practice', 'beginner'], '{"has_beats": true}'),
      ('Tournament Room A', 'Official tournament battles', 'tournament', 100, 'TOURNA', $1, ARRAY['tournament', 'ranked'], '{"entry_fee": 10, "prize_pool": 100}'),
      ('Producer Session', 'Collaborate with producers', 'producer', 10, 'PROD001', $1, ARRAY['producer', 'collab'], '{"file_sharing": true}'),
      ('Open Mic Stage', 'Weekly open mic performances', 'openmic', 30, 'OPEN001', $1, ARRAY['openmic', 'weekly'], '{"sign_up_required": true}'),
      ('Freestyle Friday', 'Casual Friday freestyle sessions', 'freestyle', 25, 'FREE01', $1, ARRAY['freestyle', 'casual'], '{"random_beats": true}'),
      ('Battle Royale', 'High-stakes battle royale', 'battle', 40, 'ROYALE', $1, ARRAY['high_stakes', 'elimination'], '{"elimination_style": true}'),
      ('Cypher Circle', 'Group rap cypher sessions', 'cypher', 15, 'CIRCLE', $1, ARRAY['group', 'cypher'], '{"turn_based": true}'),
      ('Studio Session', 'Professional recording sessions', 'studio', 8, 'STUDIO', $1, ARRAY['studio', 'pro'], '{"high_quality": true}')
    ON CONFLICT (room_code) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = now()
  `, [testUserId]);

  // Insert sample beats
  await client.query(`
    INSERT INTO public.beats (title, artist, tempo, key_signature, genre, duration_seconds, preview_url, file_url, license_type, source)
    VALUES 
      ('Boom Bap Classic', 'Vintage Beats', 95, 'C# minor', 'Hip Hop', 180, 'https://example.com/preview1.mp3', 'https://example.com/beat1.mp3', 'royalty_free', 'library'),
      ('Trap Anthem', 'Modern Producer', 140, 'F# minor', 'Trap', 240, 'https://example.com/preview2.mp3', 'https://example.com/beat2.mp3', 'royalty_free', 'library'),
      ('LoFi Study', 'Chill Beats', 85, 'G major', 'LoFi', 200, 'https://example.com/preview3.mp3', 'https://example.com/beat3.mp3', 'royalty_free', 'library'),
      ('Jazz Hop', 'Smooth Producer', 120, 'D major', 'Jazz Hop', 160, 'https://example.com/preview4.mp3', 'https://example.com/beat4.mp3', 'royalty_free', 'library'),
      ('Drill Beat', 'Street Producer', 130, 'B minor', 'Drill', 140, 'https://example.com/preview5.mp3', 'https://example.com/beat5.mp3', 'royalty_free', 'library')
    ON CONFLICT DO NOTHING
  `);

  console.log('✅ Sample data inserted');
}

implementBlueprintSchema();

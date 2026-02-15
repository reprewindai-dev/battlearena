# Database Schema Design

## Core Tables

### Users & Authentication

```sql
-- Users table
CREATE TABLE users (
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
    kyc_status VARCHAR(20) DEFAULT 'none', -- none, pending, verified, rejected
    kyc_data JSONB,
    preferences JSONB DEFAULT '{}',
    parental_controls JSONB DEFAULT '{}'
);

-- User profiles
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(500),
    banner_url VARCHAR(500),
    social_links JSONB DEFAULT '{}',
    battle_stats JSONB DEFAULT '{}',
    reputation_score DECIMAL(10,2) DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'novice', -- novice, bronze, silver, gold, platinum, diamond, master
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Authentication tokens
CREATE TABLE auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_type VARCHAR(20) NOT NULL, -- access, refresh, mfa, reset
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_revoked BOOLEAN DEFAULT FALSE,
    device_info JSONB
);
```

### Battle System

```sql
-- Battle matches
CREATE TABLE battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID REFERENCES tournaments(id),
    battle_type VARCHAR(20) NOT NULL, -- ranked, casual, tournament, practice
    format VARCHAR(20) NOT NULL, -- 30s, 45s, custom
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, completed, cancelled
    player1_id UUID REFERENCES users(id),
    player2_id UUID REFERENCES users(id),
    winner_id UUID REFERENCES users(id),
    beat_id UUID REFERENCES beats(id),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    room_code VARCHAR(10) UNIQUE,
    rating_data JSONB, -- Glicko-2 calculations
    scoring_data JSONB, -- votes, judge scores, AI metrics
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Battle rounds
CREATE TABLE battle_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    player_id UUID NOT NULL REFERENCES users(id),
    audio_url VARCHAR(500),
    duration_seconds INTEGER,
    transcript TEXT,
    ai_analysis JSONB,
    judge_scores JSONB,
    audience_votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ratings and tiers
CREATE TABLE user_ratings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    rating DECIMAL(10,2) DEFAULT 1500.00, -- Glicko-2 rating
    deviation DECIMAL(10,2) DEFAULT 350.00, -- Rating deviation
    volatility DECIMAL(10,2) DEFAULT 0.06, -- Rating volatility
    tier VARCHAR(20) DEFAULT 'novice',
    tier_progress INTEGER DEFAULT 0, -- 0-100 progress within tier
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Economy System

```sql
-- Wallets and balances
CREATE TABLE wallets (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    crowns_balance BIGINT DEFAULT 0, -- Reputation currency
    points_balance BIGINT DEFAULT 0, -- Creator earnings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Token purchases
CREATE TABLE token_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    tokens_purchased INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) NOT NULL,
    payment_method VARCHAR(50),
    payment_provider VARCHAR(50),
    transaction_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed, refunded
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Token transactions (spending)
CREATE TABLE token_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    recipient_id UUID REFERENCES users(id), -- For tips/gifts
    tokens_spent INTEGER NOT NULL,
    points_earned INTEGER NOT NULL, -- 90% of tokens to points
    platform_share INTEGER NOT NULL, -- 10% platform share
    transaction_type VARCHAR(50) NOT NULL, -- tip, purchase, ppv, subscription
    reference_id UUID, -- Battle, tournament, or other reference
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payouts
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    payment_method VARCHAR(50),
    payout_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);
```

### Content Management

```sql
-- Beats library
CREATE TABLE beats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploader_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    artist VARCHAR(200),
    tempo INTEGER NOT NULL,
    key_signature VARCHAR(10),
    genre VARCHAR(50),
    duration_seconds INTEGER,
    file_url VARCHAR(500),
    preview_url VARCHAR(500),
    license_type VARCHAR(20), -- royalty_free, licensed, exclusive
    license_terms TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    approval_notes TEXT,
    usage_count INTEGER DEFAULT 0,
    rating_average DECIMAL(3,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Beat ratings and reviews
CREATE TABLE beat_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beat_id UUID NOT NULL REFERENCES beats(id),
    reviewer_id UUID NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(beat_id, reviewer_id)
);
```

### Tournament System

```sql
-- Tournaments
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    tournament_type VARCHAR(20) NOT NULL, -- weekly, monthly, special, ppv
    format VARCHAR(20) NOT NULL, -- single_elimination, swiss, league
    status VARCHAR(20) DEFAULT 'upcoming', -- upcoming, registration, active, completed
    max_participants INTEGER,
    entry_fee_tokens INTEGER DEFAULT 0,
    prize_pool_tokens INTEGER,
    prize_structure JSONB,
    registration_opens TIMESTAMP WITH TIME ZONE,
    registration_closes TIMESTAMP WITH TIME ZONE,
    starts_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournament participants
CREATE TABLE tournament_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    user_id UUID NOT NULL REFERENCES users(id),
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'registered', -- registered, withdrawn, eliminated, winner
    seed_number INTEGER,
    current_bracket_position JSONB,
    UNIQUE(tournament_id, user_id)
);

-- Tournament brackets
CREATE TABLE tournament_brackets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    round_number INTEGER NOT NULL,
    match_number INTEGER NOT NULL,
    player1_id UUID REFERENCES users(id),
    player2_id UUID REFERENCES users(id),
    winner_id UUID REFERENCES users(id),
    battle_id UUID REFERENCES battles(id),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Moderation System

```sql
-- Moderation reports
CREATE TABLE moderation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(id),
    reported_user_id UUID REFERENCES users(id),
    reported_content_type VARCHAR(50), -- battle, chat, profile, beat
    reported_content_id UUID,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    status VARCHAR(20) DEFAULT 'pending', -- pending, reviewing, resolved, dismissed
    assigned_moderator_id UUID REFERENCES users(id),
    resolution_action VARCHAR(100), -- warning, mute, ban, content_removal
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- AI moderation flags
CREATE TABLE ai_moderation_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    user_id UUID REFERENCES users(id),
    flag_type VARCHAR(50) NOT NULL, -- hate_speech, threat, self_harm, spam
    confidence_score DECIMAL(5,4) NOT NULL,
    analysis_data JSONB,
    status VARCHAR(20) DEFAULT 'flagged', -- flagged, reviewing, approved, dismissed
    human_reviewer_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User moderation history
CREATE TABLE user_moderation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL, -- warning, mute, temporary_ban, permanent_ban
    reason VARCHAR(200) NOT NULL,
    duration_days INTEGER, -- For temporary actions
    applied_by UUID NOT NULL REFERENCES users(id),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);
```

### Community & Social

```sql
-- Crews
CREATE TABLE crews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    tag VARCHAR(10) UNIQUE,
    description TEXT,
    leader_id UUID NOT NULL REFERENCES users(id),
    member_count INTEGER DEFAULT 1,
    crew_level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crew memberships
CREATE TABLE crew_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crew_id UUID NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- leader, officer, member
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(crew_id, user_id)
);

-- Mentorship relationships
CREATE TABLE mentorships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES users(id),
    mentee_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active', -- active, paused, completed
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    UNIQUE(mentor_id, mentee_id)
);
```

## Indexes

```sql
-- Performance indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_last_active ON users(last_active);
CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_battles_players ON battles(player1_id, player2_id);
CREATE INDEX idx_battles_tournament ON battles(tournament_id);
CREATE INDEX idx_user_ratings_tier ON user_ratings(tier);
CREATE INDEX idx_token_transactions_user ON token_transactions(user_id);
CREATE INDEX idx_token_transactions_created ON token_transactions(created_at);
CREATE INDEX idx_moderation_reports_status ON moderation_reports(status);
CREATE INDEX idx_ai_flags_status ON ai_moderation_flags(status);
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_beats_status ON beats(status);
```

## Data Relationships

- Users have one profile, one wallet, and one rating
- Battles involve two users and one beat
- Tournaments contain multiple battles through brackets
- Token transactions create points for creators
- Moderation reports can be filed by any user against any content
- Crews have many members with different roles
- Mentorship connects experienced users with novices

## Scaling Considerations

- **Partitioning**: User data by region for large-scale deployments
- **Read Replicas**: Analytics and reporting queries
- **Time-series Data**: Battle history and moderation logs
- **Caching**: Frequently accessed data like leaderboards and user profiles

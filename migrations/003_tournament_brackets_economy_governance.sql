-- Migration 003: Tournament Brackets, Economy Wallet, and Governance
-- Run this against your Supabase database

-- ============================================================
-- TOURNAMENT MATCHES (bracket system)
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL,
    round INTEGER NOT NULL,           -- 1 = first round, increments
    match_number INTEGER NOT NULL,    -- position in round
    bracket_position VARCHAR(20),     -- e.g. "R1M1", "QF1", "SF1", "F"
    player_a_id UUID,
    player_b_id UUID,
    winner_id UUID,
    score_a INTEGER DEFAULT 0,
    score_b INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',   -- pending|in_progress|completed|walkover
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    battle_session_id UUID,           -- link to actual battle
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT tournament_matches_status_check CHECK (
        status IN ('pending', 'in_progress', 'completed', 'walkover', 'cancelled')
    )
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_players ON tournament_matches(player_a_id, player_b_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_matches_position ON tournament_matches(tournament_id, round, match_number);

-- Prize distribution log
CREATE TABLE IF NOT EXISTS tournament_prize_distributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL,
    user_id UUID NOT NULL,
    placement INTEGER NOT NULL,       -- 1 = 1st, 2 = 2nd, etc.
    prize_tokens INTEGER NOT NULL DEFAULT 0,
    prize_crowns INTEGER NOT NULL DEFAULT 0,
    distributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT prize_placement_positive CHECK (placement > 0)
);

CREATE INDEX IF NOT EXISTS idx_prize_distributions_tournament ON tournament_prize_distributions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_prize_distributions_user ON tournament_prize_distributions(user_id);

-- ============================================================
-- DUAL CURRENCY WALLET (Crowns = reputation, Tokens = purchasable)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_wallets (
    user_id UUID PRIMARY KEY,
    token_balance INTEGER NOT NULL DEFAULT 0,
    crown_balance INTEGER NOT NULL DEFAULT 0,
    lifetime_tokens_earned INTEGER NOT NULL DEFAULT 0,
    lifetime_crowns_earned INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT token_balance_non_negative CHECK (token_balance >= 0),
    CONSTRAINT crown_balance_non_negative CHECK (crown_balance >= 0)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    currency VARCHAR(10) NOT NULL,    -- 'tokens' | 'crowns'
    amount INTEGER NOT NULL,          -- positive = credit, negative = debit
    balance_after INTEGER NOT NULL,
    type VARCHAR(40) NOT NULL,        -- 'purchase','battle_win','battle_participation','tournament_prize','tournament_entry','admin_grant','refund','spend'
    reference_id UUID,                -- battle_id, tournament_id, etc.
    reference_type VARCHAR(30),       -- 'battle','tournament','purchase','admin'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT wallet_tx_currency CHECK (currency IN ('tokens', 'crowns')),
    CONSTRAINT wallet_tx_type_check CHECK (
        type IN ('purchase','battle_win','battle_participation','tournament_prize',
                 'tournament_entry','admin_grant','refund','spend','crown_battle_win',
                 'crown_tournament_win','crown_daily_login','crown_referral')
    )
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_currency ON wallet_transactions(user_id, currency);

-- ============================================================
-- GLICKO-2 RATING HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS rating_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    rating DECIMAL(10,4) NOT NULL DEFAULT 1500,
    rating_deviation DECIMAL(10,4) NOT NULL DEFAULT 350,
    volatility DECIMAL(10,6) NOT NULL DEFAULT 0.06,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    tier VARCHAR(20) NOT NULL DEFAULT 'bronze',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reference_battle_id UUID
);

CREATE INDEX IF NOT EXISTS idx_rating_history_user ON rating_history(user_id, recorded_at DESC);

-- ============================================================
-- COMMUNITY GOVERNANCE (proposals + voting)
-- ============================================================
CREATE TABLE IF NOT EXISTS governance_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'general',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    proposed_by UUID NOT NULL,
    votes_for INTEGER NOT NULL DEFAULT 0,
    votes_against INTEGER NOT NULL DEFAULT 0,
    votes_abstain INTEGER NOT NULL DEFAULT 0,
    quorum_required INTEGER NOT NULL DEFAULT 10,
    voting_ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
    result VARCHAR(20),
    result_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT governance_status_check CHECK (status IN ('open','closed','cancelled','implemented')),
    CONSTRAINT governance_category_check CHECK (
        category IN ('rules','economy','features','moderation','community','tournaments','general')
    ),
    CONSTRAINT governance_result_check CHECK (result IS NULL OR result IN ('passed','failed','tie','no_quorum'))
);

CREATE INDEX IF NOT EXISTS idx_governance_proposals_status ON governance_proposals(status);
CREATE INDEX IF NOT EXISTS idx_governance_proposals_category ON governance_proposals(category);

CREATE TABLE IF NOT EXISTS governance_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES governance_proposals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    vote VARCHAR(10) NOT NULL,        -- 'for' | 'against' | 'abstain'
    weight INTEGER NOT NULL DEFAULT 1,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT governance_vote_value CHECK (vote IN ('for', 'against', 'abstain')),
    CONSTRAINT governance_vote_unique UNIQUE (proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_governance_votes_proposal ON governance_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_governance_votes_user ON governance_votes(user_id);

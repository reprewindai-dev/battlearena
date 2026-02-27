-- Ghost Recording System Database Schema
-- Part 2 of Governed Hybrid Opponent System

-- Match replays table (immutable, append-only)
CREATE TABLE IF NOT EXISTS match_replays (
    match_id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mode VARCHAR(20) NOT NULL,
    region VARCHAR(10) NOT NULL,
    player_a_id UUID NOT NULL,
    player_b_id UUID,
    player_a_mmr INTEGER NOT NULL,
    player_b_mmr INTEGER,
    winner UUID,
    duration_ms BIGINT NOT NULL,
    summary_json JSONB,
    event_stream_hash VARCHAR(64) NOT NULL,
    server_signature VARCHAR(128) NOT NULL,
    is_bot_match BOOLEAN DEFAULT FALSE,
    bot_personality_id VARCHAR(50),
    governance_tier VARCHAR(20),
    opponent_plan_id UUID,
    
    -- Immutable constraints
    CONSTRAINT match_replays_immutable CHECK (created_at = NOW()),
    CONSTRAINT match_replays_hash_required CHECK (event_stream_hash IS NOT NULL),
    CONSTRAINT match_replays_signature_required CHECK (server_signature IS NOT NULL)
);

-- Match replay events table (immutable, append-only)
CREATE TABLE IF NOT EXISTS match_replay_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES match_replays(match_id),
    seq INTEGER NOT NULL,
    t_ms BIGINT NOT NULL,
    actor VARCHAR(20) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    payload_json JSONB NOT NULL,
    
    -- Immutable constraints
    CONSTRAINT replay_events_ordered UNIQUE (match_id, seq),
    CONSTRAINT replay_events_time_check CHECK (t_ms >= 0),
    CONSTRAINT replay_events_actor_check CHECK (actor IN ('player_a', 'player_b', 'server', 'bot')),
    CONSTRAINT replay_events_type_check CHECK (event_type IN (
        'MATCH_START', 'PLAYER_INPUT', 'OPPONENT_ACTION', 'SCORE_CHANGE', 
        'STATE_SNAPSHOT', 'MATCH_END', 'ROUND_START', 'ROUND_END'
    ))
);

-- Match opponent plans table for observability
CREATE TABLE IF NOT EXISTS match_opponent_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES match_replays(match_id),
    plan_id UUID NOT NULL,
    governance_tier VARCHAR(20) NOT NULL,
    risk_scores JSONB NOT NULL,
    validation_results JSONB NOT NULL,
    persona VARCHAR(20) NOT NULL,
    drama_archetype VARCHAR(20) NOT NULL,
    difficulty_band VARCHAR(10) NOT NULL,
    cost_per_plan DECIMAL(10,6) NOT NULL,
    latency_ms INTEGER NOT NULL,
    model_version VARCHAR(20) NOT NULL,
    threshold_version VARCHAR(20) NOT NULL,
    
    -- Plan validation constraints
    CONSTRAINT opponent_plans_tier_check CHECK (governance_tier IN ('TIER1', 'TIER2', 'FALLBACK', 'BLOCKED')),
    CONSTRAINT opponent_plans_persona_check CHECK (persona IN ('Aggro', 'Turtle', 'Counter', 'Gambler')),
    CONSTRAINT opponent_plans_drama_check CHECK (drama_archetype IN ('close_win', 'close_loss', 'comeback', 'control_win', 'stomp_rare')),
    CONSTRAINT opponent_plans_band_check CHECK (difficulty_band IN ('easy', 'mid', 'hard')),
    CONSTRAINT opponent_plans_cost_check CHECK (cost_per_plan >= 0),
    CONSTRAINT opponent_plans_latency_check CHECK (latency_ms >= 0),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ghost library for storing recorded player patterns
CREATE TABLE IF NOT EXISTS ghost_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL,
    recording_match_id UUID NOT NULL REFERENCES match_replays(match_id),
    player_mmr_at_time INTEGER NOT NULL,
    skill_band VARCHAR(10) NOT NULL,
    playstyle_tags TEXT[] DEFAULT '{}',
    reaction_time_avg_ms INTEGER,
    reaction_time_std_ms INTEGER,
    mistake_rate DECIMAL(5,4),
    aggression_score DECIMAL(5,4),
    adaptation_score DECIMAL(5,4),
    
    -- Pattern analysis
    opening_patterns JSONB DEFAULT '[]',
    response_patterns JSONB DEFAULT '[]',
    pressure_responses JSONB DEFAULT '[]',
    
    -- Usage statistics
    used_as_ghost_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Quality metrics
    recording_quality_score DECIMAL(5,4) DEFAULT 1.0,
    is_verified BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT ghost_library_band_check CHECK (skill_band IN ('easy', 'mid', 'hard')),
    CONSTRAINT ghost_library_quality_check CHECK (recording_quality_score >= 0 AND recording_quality_score <= 1)
);

-- Ghost similarity index for fast matching
CREATE TABLE IF NOT EXISTS ghost_similarity_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ghost_id UUID NOT NULL REFERENCES ghost_library(id),
    query_mmr INTEGER NOT NULL,
    query_skill_band VARCHAR(10) NOT NULL,
    similarity_score DECIMAL(5,4) NOT NULL,
    match_reasons TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT ghost_similarity_band_check CHECK (query_skill_band IN ('easy', 'mid', 'hard')),
    CONSTRAINT ghost_similarity_score_check CHECK (similarity_score >= 0 AND similarity_score <= 1)
);

-- Telemetry events table
CREATE TABLE IF NOT EXISTS telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    player_id UUID,
    match_id UUID REFERENCES match_replays(match_id),
    event_data JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Event type constraints
    CONSTRAINT telemetry_type_check CHECK (event_type IN (
        'QUEUE_ENTER', 'QUEUE_MATCH_FOUND', 'MATCH_START', 'MATCH_END',
        'REMATCH_OFFER_SHOWN', 'REMATCH_ACCEPTED', 'PLAYER_DISCONNECT', 'RAGE_QUIT',
        'TTFM', 'GOVERNANCE_BLOCK', 'CIRCUIT_BREAKER_OPEN', 'FAIRNESS_VIOLATION'
    ))
);

-- Fairness monitoring table
CREATE TABLE IF NOT EXISTS fairness_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitoring_window TIMESTAMP WITH TIME ZONE NOT NULL,
    total_matches INTEGER NOT NULL,
    win_rate DECIMAL(5,4) NOT NULL,
    close_match_rate DECIMAL(5,4) NOT NULL,
    comeback_rate DECIMAL(5,4) NOT NULL,
    rage_quit_rate DECIMAL(5,4) NOT NULL,
    rematch_rate DECIMAL(5,4) NOT NULL,
    
    -- Violation flags
    win_rate_violation BOOLEAN DEFAULT FALSE,
    close_match_violation BOOLEAN DEFAULT FALSE,
    comeback_violation BOOLEAN DEFAULT FALSE,
    rage_quit_spike BOOLEAN DEFAULT FALSE,
    
    -- Governance actions taken
    circuit_breaker_triggered BOOLEAN DEFAULT FALSE,
    dynamic_drama_disabled BOOLEAN DEFAULT FALSE,
    governance_review_flagged BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fairness_window_unique UNIQUE (monitoring_window),
    CONSTRAINT fairness_rates_check CHECK (
        win_rate >= 0 AND win_rate <= 1 AND
        close_match_rate >= 0 AND close_match_rate <= 1 AND
        comeback_rate >= 0 AND comeback_rate <= 1 AND
        rage_quit_rate >= 0 AND rage_quit_rate <= 1 AND
        rematch_rate >= 0 AND rematch_rate <= 1
    )
);

-- Red team simulation results
CREATE TABLE IF NOT EXISTS red_team_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_type VARCHAR(50) NOT NULL,
    run_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    test_parameters JSONB NOT NULL,
    results JSONB NOT NULL,
    vulnerabilities_found INTEGER DEFAULT 0,
    policy_updates_required INTEGER DEFAULT 0,
    
    -- Simulation types
    CONSTRAINT red_team_type_check CHECK (simulation_type IN (
        'WIN_SHAPING_DETECTION', 'DRAMA_PATTERN_EXPLOIT', 'COST_SPIKE_DETECTION',
        'ABUSE_SIMULATION', 'DRIFT_ESCALATION', 'SCHEMA_FAILURE_LOOP'
    ))
);

-- Performance indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_match_replays_created_at ON match_replays(created_at);
CREATE INDEX IF NOT EXISTS idx_match_replays_mode ON match_replays(mode);
CREATE INDEX IF NOT EXISTS idx_match_replays_players ON match_replays(player_a_id, player_b_id);
CREATE INDEX IF NOT EXISTS idx_match_replays_mmr_range ON match_replays(player_a_mmr, player_b_mmr);
CREATE INDEX IF NOT EXISTS idx_match_replays_bot_match ON match_replays(is_bot_match);

CREATE INDEX IF NOT EXISTS idx_replay_events_match_seq ON match_replay_events(match_id, seq);
CREATE INDEX IF NOT EXISTS idx_replay_events_time ON match_replay_events(t_ms);
CREATE INDEX IF NOT EXISTS idx_replay_events_actor ON match_replay_events(actor);
CREATE INDEX IF NOT EXISTS idx_replay_events_type ON match_replay_events(event_type);

CREATE INDEX IF NOT EXISTS idx_opponent_plans_created_at ON match_opponent_plans(created_at);
CREATE INDEX IF NOT EXISTS idx_opponent_plans_tier ON match_opponent_plans(governance_tier);
CREATE INDEX IF NOT EXISTS idx_opponent_plans_persona ON match_opponent_plans(persona);
CREATE INDEX IF NOT EXISTS idx_opponent_plans_drama ON match_opponent_plans(drama_archetype);

CREATE INDEX IF NOT EXISTS idx_ghost_library_player ON ghost_library(player_id);
CREATE INDEX IF NOT EXISTS idx_ghost_library_skill_band ON ghost_library(skill_band);
CREATE INDEX IF NOT EXISTS idx_ghost_library_mmr ON ghost_library(player_mmr_at_time);
CREATE INDEX IF NOT EXISTS idx_ghost_library_quality ON ghost_library(recording_quality_score);
CREATE INDEX IF NOT EXISTS idx_ghost_library_verified ON ghost_library(is_verified);

CREATE INDEX IF NOT EXISTS idx_ghost_similarity_ghost ON ghost_similarity_index(ghost_id);
CREATE INDEX IF NOT EXISTS idx_ghost_similarity_mmr ON ghost_similarity_index(query_mmr);
CREATE INDEX IF NOT EXISTS idx_ghost_similarity_score ON ghost_similarity_index(similarity_score);

CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_player ON telemetry_events(player_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_match ON telemetry_events(match_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_type ON telemetry_events(event_type);

CREATE INDEX IF NOT EXISTS idx_fairness_window ON fairness_monitoring(monitoring_window);
CREATE INDEX IF NOT EXISTS idx_fairness_violations ON fairness_monitoring(
    win_rate_violation, close_match_violation, comeback_violation, rage_quit_spike
);

-- Row Level Security policies
ALTER TABLE match_replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_replay_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_opponent_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghost_similarity_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fairness_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE red_team_simulations ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin access only for observability)
CREATE POLICY "Admin full access to match_replays" ON match_replays
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to match_replay_events" ON match_replay_events
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to match_opponent_plans" ON match_opponent_plans
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to ghost_library" ON ghost_library
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to ghost_similarity_index" ON ghost_similarity_index
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to telemetry_events" ON telemetry_events
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to fairness_monitoring" ON fairness_monitoring
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin full access to red_team_simulations" ON red_team_simulations
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Triggers for immutable audit trail
CREATE OR REPLACE FUNCTION prevent_match_replay_updates()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'match_replays table is immutable - updates not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_match_replay_updates
    BEFORE UPDATE ON match_replays
    FOR EACH ROW EXECUTE FUNCTION prevent_match_replay_updates();

CREATE OR REPLACE FUNCTION prevent_replay_events_updates()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'match_replay_events table is immutable - updates not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_replay_events_updates
    BEFORE UPDATE ON match_replay_events
    FOR EACH ROW EXECUTE FUNCTION prevent_replay_events_updates();

-- Ghost library update timestamp trigger
CREATE OR REPLACE FUNCTION update_ghost_library_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ghost_library_timestamp
    BEFORE UPDATE ON ghost_library
    FOR EACH ROW EXECUTE FUNCTION update_ghost_library_timestamp();

-- Comments for documentation
COMMENT ON TABLE match_replays IS 'Immutable match recording data for ghost system and audit trail';
COMMENT ON TABLE match_replay_events IS 'Immutable event stream for match replays - append-only';
COMMENT ON TABLE match_opponent_plans IS 'Governance observability data for opponent plans';
COMMENT ON TABLE ghost_library IS 'Library of recorded player patterns for ghost opponents';
COMMENT ON TABLE ghost_similarity_index IS 'Similarity matching index for fast ghost selection';
COMMENT ON TABLE telemetry_events IS 'Structured telemetry for monitoring and analytics';
COMMENT ON TABLE fairness_monitoring IS 'Automated fairness monitoring and violation detection';
COMMENT ON TABLE red_team_simulations IS 'Weekly red team security simulation results';

COMMENT ON COLUMN match_replays.event_stream_hash IS 'SHA-256 hash of complete event stream for integrity';
COMMENT ON COLUMN match_replays.server_signature IS 'Cryptographic signature from authoritative server';
COMMENT ON COLUMN ghost_library.recording_quality_score IS 'Quality assessment of ghost recording (0-1)';
COMMENT ON COLUMN ghost_library.used_as_ghost_count IS 'Number of times this ghost has been used as opponent';
COMMENT ON COLUMN fairness_monitoring.monitoring_window IS 'Time window for fairness metrics aggregation';

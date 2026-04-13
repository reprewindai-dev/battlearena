-- Matchmaking System Schema
-- Create tables for real-time battle matchmaking

-- Queue types enum
CREATE TYPE queue_type AS ENUM ('freestyle', 'ranked', 'tournament');
CREATE TYPE battle_status AS ENUM ('waiting', 'matched', 'in_progress', 'completed', 'cancelled');
CREATE TYPE battle_format AS ENUM ('30s', '60s', '90s', '120s');

-- Matchmaking queue
CREATE TABLE matchmaking_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    queue_type queue_type NOT NULL,
    battle_format battle_format NOT NULL DEFAULT '60s',
    entry_fee INTEGER DEFAULT 0,
    preferred_genres TEXT[], -- Array of preferred genres
    min_elo INTEGER DEFAULT 0,
    max_elo INTEGER DEFAULT 9999,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 minutes'),
    
    -- Constraints
    CONSTRAINT unique_active_queue UNIQUE (user_id, queue_type, status) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Battles table (updated for matchmaking)
CREATE TABLE battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES users(id),
    participant_1_id UUID REFERENCES users(id),
    participant_2_id UUID REFERENCES users(id),
    
    -- Battle configuration
    queue_type queue_type NOT NULL,
    battle_format battle_format NOT NULL,
    entry_fee INTEGER DEFAULT 0,
    prize_pool INTEGER DEFAULT 0,
    
    -- Beat selection
    beat_id UUID REFERENCES beats(id),
    participant_1_beat_id UUID REFERENCES beats(id),
    participant_2_beat_id UUID REFERENCES beats(id),
    
    -- Status and timing
    status battle_status DEFAULT 'waiting',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 minutes'),
    
    -- Results
    winner_id UUID REFERENCES users(id),
    participant_1_score INTEGER DEFAULT 0,
    participant_2_score INTEGER DEFAULT 0,
    participant_1_votes INTEGER DEFAULT 0,
    participant_2_votes INTEGER DEFAULT 0,
    
    -- Recording and streaming
    room_id TEXT UNIQUE,
    livekit_room_id TEXT,
    recording_url TEXT,
    processed_url TEXT,
    egress_id TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_participants CHECK (
        (participant_1_id IS NOT NULL AND participant_2_id IS NOT NULL) OR
        status = 'waiting'
    ),
    CONSTRAINT valid_winner CHECK (
        winner_id IS NULL OR 
        winner_id = participant_1_id OR 
        winner_id = participant_2_id
    ),
    CONSTRAINT valid_scores CHECK (
        (participant_1_score >= 0 AND participant_2_score >= 0) OR
        status IN ('waiting', 'matched')
    )
);

-- ELO ratings for ranked battles
CREATE TABLE user_elo_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    queue_type queue_type NOT NULL,
    current_elo INTEGER DEFAULT 1000,
    peak_elo INTEGER DEFAULT 1000,
    battles_played INTEGER DEFAULT 0,
    battles_won INTEGER DEFAULT 0,
    battles_lost INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0.00,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE (user_id, queue_type)
);

-- Battle history for ELO calculations
CREATE TABLE battle_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES users(id),
    opponent_id UUID NOT NULL REFERENCES users(id),
    queue_type queue_type NOT NULL,
    battle_format battle_format NOT NULL,
    elo_before INTEGER NOT NULL,
    elo_after INTEGER NOT NULL,
    elo_change INTEGER NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('win', 'loss', 'draw')),
    score INTEGER NOT NULL,
    opponent_score INTEGER NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Queue statistics
CREATE TABLE queue_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_type queue_type NOT NULL,
    battle_format battle_format NOT NULL,
    date DATE NOT NULL,
    total_queued INTEGER DEFAULT 0,
    total_matched INTEGER DEFAULT 0,
    avg_wait_time_seconds INTEGER DEFAULT 0,
    peak_concurrent INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE (queue_type, battle_format, date)
);

-- Indexes for performance
CREATE INDEX idx_matchmaking_queue_user_status ON matchmaking_queue(user_id, status);
CREATE INDEX idx_matchmaking_queue_type_format ON matchmaking_queue(queue_type, battle_format, status);
CREATE INDEX idx_matchmaking_queue_created ON matchmaking_queue(created_at);
CREATE INDEX idx_matchmaking_queue_elo ON matchmaking_queue(min_elo, max_elo);

CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_battles_participants ON battles(participant_1_id, participant_2_id);
CREATE INDEX idx_battles_created ON battles(created_at);
CREATE INDEX idx_battles_queue_type ON battles(queue_type, status);

CREATE INDEX idx_user_elo_user_type ON user_elo_ratings(user_id, queue_type);
CREATE INDEX idx_user_elo_current ON user_elo_ratings(current_elo DESC);

CREATE INDEX idx_battle_history_participant ON battle_history(participant_id, created_at);
CREATE INDEX idx_battle_history_date ON battle_history(created_at);

-- Functions for matchmaking logic

-- Get available opponents for matching
CREATE OR REPLACE FUNCTION get_available_opponents(
    p_user_id UUID,
    p_queue_type queue_type,
    p_battle_format battle_format,
    p_min_elo INTEGER DEFAULT 0,
    p_max_elo INTEGER DEFAULT 9999
)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    current_elo INTEGER,
    queue_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        q.user_id,
        u.username,
        COALESCE(elo.current_elo, 1000) as current_elo,
        q.created_at as queue_time
    FROM matchmaking_queue q
    JOIN users u ON u.id = q.user_id
    LEFT JOIN user_elo_ratings elo ON elo.user_id = q.user_id 
        AND elo.queue_type = p_queue_type
    WHERE 
        q.user_id != p_user_id
        AND q.queue_type = p_queue_type
        AND q.battle_format = p_battle_format
        AND q.status = 'active'
        AND q.expires_at > NOW()
        AND (
            p_min_elo = 0 OR 
            COALESCE(elo.current_elo, 1000) >= p_min_elo
        )
        AND (
            p_max_elo = 9999 OR 
            COALESCE(elo.current_elo, 1000) <= p_max_elo
        )
    ORDER BY 
        q.created_at ASC,
        ABS(COALESCE(elo.current_elo, 1000) - (
            SELECT COALESCE(user_elo.current_elo, 1000)
            FROM user_elo_ratings user_elo
            WHERE user_elo.user_id = p_user_id 
            AND user_elo.queue_type = p_queue_type
        )) ASC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Update ELO ratings after battle
CREATE OR REPLACE FUNCTION update_elo_ratings(
    p_battle_id UUID,
    p_winner_id UUID,
    p_participant_1_id UUID,
    p_participant_2_id UUID,
    p_queue_type queue_type
)
RETURNS VOID AS $$
DECLARE
    p1_elo_before INTEGER;
    p2_elo_before INTEGER;
    p1_elo_after INTEGER;
    p2_elo_after INTEGER;
    k_factor INTEGER := 32;
BEGIN
    -- Get current ELO ratings
    SELECT COALESCE(current_elo, 1000) INTO p1_elo_before
    FROM user_elo_ratings 
    WHERE user_id = p_participant_1_id AND queue_type = p_queue_type;
    
    SELECT COALESCE(current_elo, 1000) INTO p2_elo_before
    FROM user_elo_ratings 
    WHERE user_id = p_participant_2_id AND queue_type = p_queue_type;
    
    -- Calculate expected scores
    DECLARE p1_expected REAL := 1.0 / (1.0 + POWER(10.0, (p2_elo_before - p1_elo_before) / 400.0));
    DECLARE p2_expected REAL := 1.0 / (1.0 + POWER(10.0, (p1_elo_before - p2_elo_before) / 400.0));
    
    -- Calculate new ELO ratings
    IF p_winner_id = p_participant_1_id THEN
        p1_elo_after := p1_elo_before + k_factor * (1.0 - p1_expected);
        p2_elo_after := p2_elo_before + k_factor * (0.0 - p2_expected);
    ELSIF p_winner_id = p_participant_2_id THEN
        p1_elo_after := p1_elo_before + k_factor * (0.0 - p1_expected);
        p2_elo_after := p2_elo_before + k_factor * (1.0 - p2_expected);
    ELSE -- Draw
        p1_elo_after := p1_elo_before + k_factor * (0.5 - p1_expected);
        p2_elo_after := p2_elo_before + k_factor * (0.5 - p2_expected);
    END IF;
    
    -- Update participant 1 ELO
    INSERT INTO user_elo_ratings (
        user_id, queue_type, current_elo, peak_elo, battles_played, battles_won
    ) VALUES (
        p_participant_1_id, p_queue_type, p1_elo_after, p1_elo_after, 1, 
        CASE WHEN p_winner_id = p_participant_1_id THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id, queue_type) DO UPDATE SET
        current_elo = EXCLUDED.current_elo + (p1_elo_after - EXCLUDED.current_elo),
        peak_elo = GREATEST(EXCLUDED.peak_elo, p1_elo_after),
        battles_played = EXCLUDED.battles_played + 1,
        battles_won = EXCLUDED.battles_won + 
            CASE WHEN p_winner_id = p_participant_1_id THEN 1 ELSE 0 END,
        win_rate = ROUND(
            (EXCLUDED.battles_won + CASE WHEN p_winner_id = p_participant_1_id THEN 1 ELSE 0 END)::DECIMAL / 
            (EXCLUDED.battles_played + 1) * 100, 2
        ),
        updated_at = NOW();
    
    -- Update participant 2 ELO
    INSERT INTO user_elo_ratings (
        user_id, queue_type, current_elo, peak_elo, battles_played, battles_won
    ) VALUES (
        p_participant_2_id, p_queue_type, p2_elo_after, p2_elo_after, 1,
        CASE WHEN p_winner_id = p_participant_2_id THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id, queue_type) DO UPDATE SET
        current_elo = EXCLUDED.current_elo + (p2_elo_after - EXCLUDED.current_elo),
        peak_elo = GREATEST(EXCLUDED.peak_elo, p2_elo_after),
        battles_played = EXCLUDED.battles_played + 1,
        battles_won = EXCLUDED.battles_won + 
            CASE WHEN p_winner_id = p_participant_2_id THEN 1 ELSE 0 END,
        win_rate = ROUND(
            (EXCLUDED.battles_won + CASE WHEN p_winner_id = p_participant_2_id THEN 1 ELSE 0 END)::DECIMAL / 
            (EXCLUDED.battles_played + 1) * 100, 2
        ),
        updated_at = NOW();
    
    -- Record battle history
    INSERT INTO battle_history (
        battle_id, participant_id, opponent_id, queue_type, battle_format,
        elo_before, elo_after, elo_change, outcome, score, opponent_score
    ) VALUES
    (p_battle_id, p_participant_1_id, p_participant_2_id, p_queue_type, '60s',
     p1_elo_before, p1_elo_after, p1_elo_after - p1_elo_before,
     CASE WHEN p_winner_id = p_participant_1_id THEN 'win' 
          WHEN p_winner_id IS NULL THEN 'draw' ELSE 'loss' END,
     0, 0),
    (p_battle_id, p_participant_2_id, p_participant_1_id, p_queue_type, '60s',
     p2_elo_before, p2_elo_after, p2_elo_after - p2_elo_before,
     CASE WHEN p_winner_id = p_participant_2_id THEN 'win' 
          WHEN p_winner_id IS NULL THEN 'draw' ELSE 'loss' END,
     0, 0);
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_matchmaking_queue_updated_at 
    BEFORE UPDATE ON matchmaking_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_battles_updated_at 
    BEFORE UPDATE ON battles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_elo_ratings_updated_at 
    BEFORE UPDATE ON user_elo_ratings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Clean up expired queue entries
CREATE OR REPLACE FUNCTION cleanup_expired_queue()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    DELETE FROM matchmaking_queue 
    WHERE expires_at < NOW() OR status = 'expired';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE matchmaking_queue IS 'Real-time matchmaking queue for battle pairing';
COMMENT ON TABLE battles IS 'Battle records with matchmaking integration';
COMMENT ON TABLE user_elo_ratings IS 'ELO ratings for ranked battle matchmaking';
COMMENT ON TABLE battle_history IS 'Historical battle data for ELO calculations and statistics';

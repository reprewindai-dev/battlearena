-- Add licensing, source, and status metadata to beats
ALTER TABLE beats
    ADD COLUMN IF NOT EXISTS license_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'pixabay',
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','disabled'));

-- Indexes to improve beat discovery filters
CREATE INDEX IF NOT EXISTS idx_beats_genre ON beats(genre);
CREATE INDEX IF NOT EXISTS idx_beats_tempo ON beats(tempo);
CREATE INDEX IF NOT EXISTS idx_beats_source ON beats(source);
CREATE INDEX IF NOT EXISTS idx_beats_verified_active ON beats(is_verified, is_active);

-- Ensure an ingest/system user exists for attribution
DO $$
DECLARE
    v_ingest_user_id UUID;
BEGIN
    SELECT id INTO v_ingest_user_id FROM users WHERE email = 'beats-ingest@system.local' LIMIT 1;
    IF v_ingest_user_id IS NULL THEN
        v_ingest_user_id := uuid_generate_v4();
        INSERT INTO users (
            id,
            username,
            email,
            password_hash,
            display_name,
            is_verified,
            is_active,
            tier,
            reputation_score
        ) VALUES (
            v_ingest_user_id,
            'beats_ingest',
            'beats-ingest@system.local',
            'INGEST_DISABLED',
            'Beats Ingest',
            TRUE,
            FALSE,
            'novice',
            0
        );
    END IF;
END $$;

-- Backfill status on existing beats
UPDATE beats SET status = 'active' WHERE status IS NULL;

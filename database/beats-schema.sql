-- Real Beat Library Schema
-- Production-ready beat management system

-- Beats table with all required fields
CREATE TABLE IF NOT EXISTS beats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    tempo INTEGER NOT NULL CHECK (tempo BETWEEN 60 AND 200),
    key_signature VARCHAR(10) NOT NULL,
    genre VARCHAR(50) NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    preview_url TEXT NOT NULL,
    file_url TEXT NOT NULL,
    license_type VARCHAR(50) NOT NULL DEFAULT 'commercial',
    license_url TEXT,
    source VARCHAR(50) NOT NULL DEFAULT 'arena_library',
    usage_count INTEGER DEFAULT 0,
    download_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Beat usage tracking
CREATE TABLE IF NOT EXISTS beat_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beat_id UUID NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    battle_id UUID REFERENCES battles(id) ON DELETE SET NULL,
    usage_type VARCHAR(50) NOT NULL, -- 'battle', 'practice', 'preview'
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Beat licenses and rights
CREATE TABLE IF NOT EXISTS beat_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beat_id UUID NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
    license_type VARCHAR(50) NOT NULL,
    commercial_use BOOLEAN DEFAULT false,
    attribution_required BOOLEAN DEFAULT true,
    redistribution_allowed BOOLEAN DEFAULT false,
    modification_allowed BOOLEAN DEFAULT false,
    price_cents INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_beats_genre ON beats(genre);
CREATE INDEX IF NOT EXISTS idx_beats_tempo ON beats(tempo);
CREATE INDEX IF NOT EXISTS idx_beats_status ON beats(status);
CREATE INDEX IF NOT EXISTS idx_beats_active ON beats(is_active);
CREATE INDEX IF NOT EXISTS idx_beats_usage_count ON beats(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_beats_rating ON beats(rating DESC);
CREATE INDEX IF NOT EXISTS idx_beat_usage_beat_id ON beat_usage(beat_id);
CREATE INDEX IF NOT EXISTS idx_beat_usage_user_id ON beat_usage(user_id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_beats_updated_at BEFORE UPDATE ON beats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE beats ENABLE ROW LEVEL SECURITY;
ALTER TABLE beat_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE beat_licenses ENABLE ROW LEVEL SECURITY;

-- Users can view active beats
CREATE POLICY users_view_active_beats ON beats
    FOR SELECT USING (is_active = true AND status = 'active');

-- Users can track their beat usage
CREATE POLICY users_own_beat_usage ON beat_usage
    FOR ALL USING (user_id = auth.uid());

-- Admins can manage all beats
CREATE POLICY admins_manage_beats ON beats
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Insert sample beats for testing
INSERT INTO beats (title, artist, tempo, key_signature, genre, duration_seconds, preview_url, file_url, license_type, is_verified, tags) VALUES
('Neon Dreams', 'Arena Producer', 92, 'C# Minor', 'hip-hop', 32, 'https://storage.googleapis.com/arena-beats/previews/neon-dreams.mp3', 'https://storage.googleapis.com/arena-beats/files/neon-dreams.mp3', 'commercial', true, ARRAY['dark', 'atmospheric', 'trap']),
('Glass City', 'Arena Producer', 104, 'F Major', 'hip-hop', 28, 'https://storage.googleapis.com/arena-beats/previews/glass-city.mp3', 'https://storage.googleapis.com/arena-beats/files/glass-city.mp3', 'commercial', true, ARRAY['upbeat', 'melodic', 'boom-bap']),
('Ion Runner', 'Arena Producer', 120, 'D Minor', 'electronic', 24, 'https://storage.googleapis.com/arena-beats/previews/ion-runner.mp3', 'https://storage.googleapis.com/arena-beats/files/ion-runner.mp3', 'commercial', true, ARRAY['energetic', 'techno', 'industrial']),
('Midnight Groove', 'Arena Producer', 88, 'G Major', 'hip-hop', 36, 'https://storage.googleapis.com/arena-beats/previews/midnight-groove.mp3', 'https://storage.googleapis.com/arena-beats/files/midnight-groove.mp3', 'commercial', true, ARRAY['smooth', 'jazz-influenced', 'lo-fi']),
('Digital Storm', 'Arena Producer', 140, 'A Minor', 'electronic', 20, 'https://storage.googleapis.com/arena-beats/previews/digital-storm.mp3', 'https://storage.googleapis.com/arena-beats/files/digital-storm.mp3', 'commercial', true, ARRAY['intense', 'dubstep', 'bass-heavy']),
('Golden Hour', 'Arena Producer', 76, 'E Major', 'hip-hop', 40, 'https://storage.googleapis.com/arena-beats/previews/golden-hour.mp3', 'https://storage.googleapis.com/arena-beats/files/golden-hour.mp3', 'commercial', true, ARRAY['chill', 'soulful', 'boom-bap']),
('Cyber Punk', 'Arena Producer', 128, 'B Phrygian', 'electronic', 26, 'https://storage.googleapis.com/arena-beats/previews/cyber-punk.mp3', 'https://storage.googleapis.com/arena-beats/files/cyber-punk.mp3', 'commercial', true, ARRAY['futuristic', 'synthwave', 'retro']),
('Urban Legend', 'Arena Producer', 96, 'C Minor', 'hip-hop', 30, 'https://storage.googleapis.com/arena-beats/previews/urban-legend.mp3', 'https://storage.googleapis.com/arena-beats/files/urban-legend.mp3', 'commercial', true, ARRAY['gritty', 'street', 'boom-bap']),
('Crystal Clear', 'Arena Producer', 110, 'D Major', 'pop', 24, 'https://storage.googleapis.com/arena-beats/previews/crystal-clear.mp3', 'https://storage.googleapis.com/arena-beats/files/crystal-clear.mp3', 'commercial', true, ARRAY['clean', 'catchy', 'radio-friendly']),
('Underground', 'Arena Producer', 85, 'F# Minor', 'hip-hop', 35, 'https://storage.googleapis.com/arena-beats/previews/underground.mp3', 'https://storage.googleapis.com/arena-beats/files/underground.mp3', 'commercial', true, ARRAY['raw', 'experimental', 'lo-fi'])
ON CONFLICT DO NOTHING;

-- Insert corresponding licenses
INSERT INTO beat_licenses (beat_id, license_type, commercial_use, attribution_required, redistribution_allowed, modification_allowed, price_cents)
SELECT 
    b.id, 
    'commercial', 
    true, 
    false, 
    false, 
    true, 
    199
FROM beats b
WHERE b.title IN ('Neon Dreams', 'Glass City', 'Ion Runner', 'Midnight Groove', 'Digital Storm', 'Golden Hour', 'Cyber Punk', 'Urban Legend', 'Crystal Clear', 'Underground')
ON CONFLICT DO NOTHING;

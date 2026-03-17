-- Workers and operational automation tables

-- Daily reports table
CREATE TABLE IF NOT EXISTS daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL,
    report_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fraud alerts table
CREATE TABLE IF NOT EXISTS fraud_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fraud_score DECIMAL(5,4) NOT NULL,
    signals JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending_review',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    resolution VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CRF allocations table
CREATE TABLE IF NOT EXISTS crf_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month VARCHAR(7) NOT NULL UNIQUE,
    total_revenue_cents BIGINT NOT NULL,
    crf_contribution_cents BIGINT NOT NULL,
    allocation_breakdown JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending_approval',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournament prizes table
CREATE TABLE IF NOT EXISTS tournament_prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    placement INTEGER NOT NULL,
    amount_cents INTEGER NOT NULL,
    source VARCHAR(20) DEFAULT 'crf',
    status VARCHAR(20) DEFAULT 'pending',
    distributed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant applications table
CREATE TABLE IF NOT EXISTS grant_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grant_type VARCHAR(50) NOT NULL,
    amount_cents INTEGER NOT NULL,
    description TEXT NOT NULL,
    supporting_docs JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    disbursed BOOLEAN DEFAULT FALSE,
    disbursed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user ON fraud_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_crf_allocations_month ON crf_allocations(month);
CREATE INDEX IF NOT EXISTS idx_tournament_prizes_tournament ON tournament_prizes(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_prizes_user ON tournament_prizes(user_id);
CREATE INDEX IF NOT EXISTS idx_grant_applications_user ON grant_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_grant_applications_status ON grant_applications(status);

-- RPC functions for atomic balance updates
CREATE OR REPLACE FUNCTION increment_points(user_id_param UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE wallets 
    SET points_balance = points_balance + amount,
        updated_at = NOW()
    WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_points(user_id_param UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE wallets 
    SET points_balance = GREATEST(0, points_balance - amount),
        updated_at = NOW()
    WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- RLS policies
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crf_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_applications ENABLE ROW LEVEL SECURITY;

-- Admin-only access for sensitive tables
CREATE POLICY "Admin access for daily_reports" ON daily_reports
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin access for fraud_alerts" ON fraud_alerts
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin access for crf_allocations" ON crf_allocations
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Users can view their own prizes
CREATE POLICY "Users can view own prizes" ON tournament_prizes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin access for tournament_prizes" ON tournament_prizes
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Users can manage their own grant applications
CREATE POLICY "Users can view own grants" ON grant_applications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create grants" ON grant_applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin access for grant_applications" ON grant_applications
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

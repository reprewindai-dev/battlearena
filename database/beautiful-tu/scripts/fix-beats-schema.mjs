import { createSupabasePgClient } from "./lib/supabase-pg-client.mjs";

async function fixBeatsSchema() {
  const client = createSupabasePgClient({
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
  });

  try {
    await client.connect();
    console.log('🔌 Connected to Supabase PostgreSQL');

    // Update beats table schema
    const schema = `
-- Add missing columns to beats table
ALTER TABLE public.beats 
ADD COLUMN IF NOT EXISTS key_signature varchar(20),
ADD COLUMN IF NOT EXISTS license_type varchar(50) DEFAULT 'commercial',
ADD COLUMN IF NOT EXISTS license_url varchar(500),
ADD COLUMN IF NOT EXISTS source varchar(50) DEFAULT 'beatstars',
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS beats_genre_idx ON public.beats(genre);
CREATE INDEX IF NOT EXISTS beats_tempo_idx ON public.beats(tempo);
CREATE INDEX IF NOT EXISTS beats_active_idx ON public.beats(is_active);
CREATE INDEX IF NOT EXISTS beats_status_idx ON public.beats(status);
CREATE INDEX IF NOT EXISTS beats_usage_idx ON public.beats(usage_count);

-- RLS policies
ALTER TABLE public.beats ENABLE ROW LEVEL SECURITY;

-- Everyone can view active beats
CREATE POLICY "Anyone can view active beats" ON public.beats
    FOR SELECT USING (is_active = true AND status = 'active');

-- Admins can manage beats
CREATE POLICY "Admins can manage beats" ON public.beats
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );
`;

    await client.query(schema);
    console.log('✅ Beats schema updated successfully');

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Schema update failed:', err.message);
    process.exit(1);
  }
}

fixBeatsSchema();

import pg from 'pg';

const { Client } = pg;

async function rebuildBeatsSchema() {
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

    // Drop and recreate beats table
    const schema = `
-- Drop existing beats table
DROP TABLE IF EXISTS public.beats CASCADE;

-- Recreate beats table with full schema
CREATE TABLE public.beats (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title varchar(255) NOT NULL,
    artist varchar(255) NOT NULL,
    tempo integer,
    key_signature varchar(20),
    genre varchar(100),
    duration_seconds integer,
    preview_url varchar(500),
    file_url varchar(500),
    license_type varchar(50) DEFAULT 'commercial',
    license_url varchar(500),
    source varchar(50) DEFAULT 'beatstars',
    usage_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    is_verified boolean DEFAULT true,
    status varchar(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX beats_genre_idx ON public.beats(genre);
CREATE INDEX beats_tempo_idx ON public.beats(tempo);
CREATE INDEX beats_active_idx ON public.beats(is_active);
CREATE INDEX beats_status_idx ON public.beats(status);
CREATE INDEX beats_usage_idx ON public.beats(usage_count);
CREATE INDEX beats_created_at_idx ON public.beats(created_at);

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
    console.log('✅ Beats schema rebuilt successfully');

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Schema rebuild failed:', err.message);
    process.exit(1);
  }
}

rebuildBeatsSchema();

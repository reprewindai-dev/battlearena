import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function loadMinimalSchema() {
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

    // Create only the public schema tables we need
    const schema = `
-- BattleArena public schema tables
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email varchar(255) UNIQUE NOT NULL,
    username varchar(50) UNIQUE NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Matchmaking queue
CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.users(id),
    mode varchar(20) NOT NULL CHECK (mode IN ('ranked', 'freestyle')),
    preferences jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Battles
CREATE TABLE IF NOT EXISTS public.battles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    mode varchar(20) NOT NULL CHECK (mode IN ('ranked', 'freestyle')),
    status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
    participants uuid[] NOT NULL,
    round_duration_seconds integer DEFAULT 60,
    created_at timestamptz DEFAULT now() NOT NULL,
    started_at timestamptz,
    completed_at timestamptz
);

-- Battle sessions (for LiveKit room mapping)
CREATE TABLE IF NOT EXISTS public.battle_sessions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    battle_id uuid NOT NULL REFERENCES public.battles(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    livekit_room_name varchar(255) NOT NULL,
    participant_identity varchar(255) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Beats library
CREATE TABLE IF NOT EXISTS public.beats (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title varchar(255) NOT NULL,
    artist varchar(255) NOT NULL,
    genre varchar(100),
    tempo integer,
    duration_seconds integer,
    file_url varchar(500),
    preview_url varchar(500),
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS matchmaking_queue_user_idx ON public.matchmaking_queue(user_id);
CREATE INDEX IF NOT EXISTS matchmaking_queue_mode_idx ON public.matchmaking_queue(mode);
CREATE INDEX IF NOT EXISTS battles_status_idx ON public.battles(status);
CREATE INDEX IF NOT EXISTS battles_participants_idx ON public.battles USING GIN(participants);
CREATE INDEX IF NOT EXISTS battle_sessions_battle_idx ON public.battle_sessions(battle_id);
CREATE INDEX IF NOT EXISTS battle_sessions_user_idx ON public.battle_sessions(user_id);
CREATE INDEX IF NOT EXISTS beats_genre_idx ON public.beats(genre);
CREATE INDEX IF NOT EXISTS beats_tempo_idx ON public.beats(tempo);
`;

    await client.query(schema);
    console.log('✅ Minimal schema loaded successfully');

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Schema load failed:', err.message);
    process.exit(1);
  }
}

loadMinimalSchema();

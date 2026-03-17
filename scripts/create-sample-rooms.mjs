import pg from 'pg';

const { Client } = pg;

async function createSampleRooms() {
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

    // Create rooms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.rooms (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        name varchar(255) NOT NULL,
        description text,
        room_type varchar(50) NOT NULL DEFAULT 'general',
        max_participants integer DEFAULT 100,
        current_participants integer DEFAULT 0,
        is_active boolean DEFAULT true,
        is_private boolean DEFAULT false,
        room_code varchar(10) UNIQUE,
        created_by uuid REFERENCES public.users(id),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        tags text[] DEFAULT '{}',
        settings jsonb DEFAULT '{}'
      );
    `);

    // Create room_participants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.room_participants (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
        user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
        role varchar(20) DEFAULT 'participant' CHECK (role IN ('host', 'moderator', 'participant', 'spectator')),
        joined_at timestamptz DEFAULT now(),
        last_active timestamptz DEFAULT now(),
        is_online boolean DEFAULT true,
        settings jsonb DEFAULT '{}',
        UNIQUE(room_id, user_id)
      );
    `);

    // Create room_messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.room_messages (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        room_id uuid REFERENCES public.rooms(id) ON DELETE CASCADE,
        user_id uuid REFERENCES public.users(id),
        message_type varchar(20) DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'emoji', 'file')),
        content text NOT NULL,
        metadata jsonb DEFAULT '{}',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        is_deleted boolean DEFAULT false,
        reply_to uuid REFERENCES public.room_messages(id)
      );
    `);

    // Create lobbies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.lobbies (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        name varchar(255) NOT NULL,
        description text,
        lobby_type varchar(50) NOT NULL DEFAULT 'general',
        max_rooms integer DEFAULT 50,
        current_rooms integer DEFAULT 0,
        max_users_per_room integer DEFAULT 10,
        is_active boolean DEFAULT true,
        is_featured boolean DEFAULT false,
        sort_order integer DEFAULT 0,
        created_by uuid REFERENCES public.users(id),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        settings jsonb DEFAULT '{}'
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rooms_type ON public.rooms(room_type);
      CREATE INDEX IF NOT EXISTS idx_rooms_active ON public.rooms(is_active);
      CREATE INDEX IF NOT EXISTS idx_rooms_code ON public.rooms(room_code);
      CREATE INDEX IF NOT EXISTS idx_rooms_created_by ON public.rooms(created_by);
      CREATE INDEX IF NOT EXISTS idx_room_participants_room ON public.room_participants(room_id);
      CREATE INDEX IF NOT EXISTS idx_room_participants_user ON public.room_participants(user_id);
      CREATE INDEX IF NOT EXISTS idx_room_participants_online ON public.room_participants(is_online);
      CREATE INDEX IF NOT EXISTS idx_room_messages_room ON public.room_messages(room_id);
      CREATE INDEX IF NOT EXISTS idx_room_messages_created ON public.room_messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_lobbies_type ON public.lobbies(lobby_type);
      CREATE INDEX IF NOT EXISTS idx_lobbies_active ON public.lobbies(is_active);
      CREATE INDEX IF NOT EXISTS idx_lobbies_featured ON public.lobbies(is_featured);
    `);

    console.log('✅ Room tables created successfully');

    // Insert sample lobbies
    const { rows: lobbies } = await client.query(`
      INSERT INTO public.lobbies (name, description, lobby_type, is_featured, sort_order)
      VALUES 
        ('Battle Arena', 'Main lobby for rap battles and competitions', 'battle', true, 1),
        ('Freestyle Zone', 'Casual freestyle rap sessions', 'freestyle', true, 2),
        ('Practice Room', 'Practice your skills with beats', 'practice', false, 3),
        ('Tournament Hall', 'Official tournament battles', 'tournament', true, 4),
        ('Underground', 'Raw underground rap battles', 'underground', false, 5),
        ('Cypher Circle', 'Group rap cyphers and sessions', 'cypher', false, 6),
        ('Producer Lounge', 'Connect with beat producers', 'producer', false, 7),
        ('Open Mic Night', 'Weekly open mic performances', 'openmic', false, 8)
      ON CONFLICT DO NOTHING
      RETURNING id, name;
    `);

    console.log(`✅ Created ${lobbies.length} lobbies`);

    // Insert sample rooms
    const testUserId = '93d4e785-678b-4e1e-92fd-1e9d26efc446'; // Our test user
    
    const { rows: rooms } = await client.query(`
      INSERT INTO public.rooms (name, description, room_type, max_participants, room_code, created_by, tags, settings)
      VALUES 
        ('Main Stage', 'The main battle arena for epic rap battles', 'battle', 50, 'MAIN001', $1, ARRAY['featured', 'battle'], '{"allow_spectators": true, "auto_record": true}'),
        ('Underground Cypher', 'Raw underground rap sessions', 'cypher', 20, 'CYPH001', $1, ARRAY['underground', 'raw'], '{"explicit_content": true}'),
        ('Practice Booth #1', 'Practice your rap skills', 'practice', 5, 'PRAC001', $1, ARRAY['practice', 'beginner'], '{"has_beats": true}'),
        ('Tournament Room A', 'Official tournament battles', 'tournament', 100, 'TOURNA', $1, ARRAY['tournament', 'ranked'], '{"entry_fee": 10, "prize_pool": 100}'),
        ('Producer Session', 'Collaborate with producers', 'producer', 10, 'PROD001', $1, ARRAY['producer', 'collab'], '{"file_sharing": true}'),
        ('Open Mic Stage', 'Weekly open mic performances', 'openmic', 30, 'OPEN001', $1, ARRAY['openmic', 'weekly'], '{"sign_up_required": true}'),
        ('Freestyle Friday', 'Casual Friday freestyle sessions', 'freestyle', 25, 'FREE01', $1, ARRAY['freestyle', 'casual'], '{"random_beats": true}'),
        ('Battle Royale', 'High-stakes battle royale', 'battle', 40, 'ROYALE', $1, ARRAY['high_stakes', 'elimination'], '{"elimination_style": true}'),
        ('Cypher Circle', 'Group rap cypher sessions', 'cypher', 15, 'CIRCLE', $1, ARRAY['group', 'cypher'], '{"turn_based": true}'),
        ('Studio Session', 'Professional recording sessions', 'studio', 8, 'STUDIO', $1, ARRAY['studio', 'pro'], '{"high_quality": true}')
      ON CONFLICT (room_code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        updated_at = now()
      RETURNING id, name, room_code;
    `, [testUserId]);

    console.log(`✅ Created ${rooms.length} rooms`);

    // Add some participants to rooms
    for (const room of rooms.slice(0, 5)) {
      await client.query(`
        INSERT INTO public.room_participants (room_id, user_id, role)
        VALUES ($1, $2, 'host')
        ON CONFLICT (room_id, user_id) DO NOTHING
      `, [room.id, testUserId]);
    }

    // Add some sample messages
    for (const room of rooms.slice(0, 3)) {
      await client.query(`
        INSERT INTO public.room_messages (room_id, user_id, content, message_type)
        VALUES 
          ($1, $2, 'Welcome to the room! Drop your best bars!', 'system'),
          ($1, $2, 'Who''s ready to battle?', 'text'),
          ($1, $2, 'Let''s go! 🎤', 'text')
        ON CONFLICT DO NOTHING
      `, [room.id, testUserId]);
    }

    console.log('✅ Added participants and messages');

    // Create room categories/types
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.room_categories (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        name varchar(100) NOT NULL UNIQUE,
        description text,
        icon varchar(50),
        color varchar(7) DEFAULT '#000000',
        sort_order integer DEFAULT 0,
        is_active boolean DEFAULT true,
        created_at timestamptz DEFAULT now()
      );
    `);

    await client.query(`
      INSERT INTO public.room_categories (name, description, icon, color, sort_order)
      VALUES 
        ('Battle', 'Competitive rap battles', '⚔️', '#ef4444', 1),
        ('Freestyle', 'Casual freestyle sessions', '🎤', '#3b82f6', 2),
        ('Practice', 'Practice and improvement', '🎯', '#10b981', 3),
        ('Tournament', 'Official tournaments', '🏆', '#f59e0b', 4),
        ('Cypher', 'Group rap sessions', '🔄', '#8b5cf6', 5),
        ('Producer', 'Producer collaborations', '🎧', '#ec4899', 6),
        ('Open Mic', 'Open mic performances', '🎭', '#06b6d4', 7),
        ('Underground', 'Raw underground rap', '🌑', '#6b7280', 8)
      ON CONFLICT (name) DO NOTHING
    `);

    console.log('✅ Created room categories');

    await client.end();
    console.log('🔌 Disconnected cleanly');
    
    console.log('\n🎉 Sample rooms and lobbies created successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - ${lobbies.length} lobbies`);
    console.log(`   - ${rooms.length} rooms`);
    console.log(`   - 8 room categories`);
    console.log(`   - Room participants and messages added`);
    
  } catch (err) {
    console.error('❌ Failed to create sample rooms:', err.message);
    process.exit(1);
  }
}

createSampleRooms();

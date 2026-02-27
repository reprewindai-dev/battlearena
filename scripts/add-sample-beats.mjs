import pg from 'pg';

const { Client } = pg;

async function addSampleBeats() {
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

    // Sample beats data
    const beats = [
      {
        title: 'Boom Bap Classic',
        artist: 'Producer Mike',
        tempo: 95,
        key_signature: 'C minor',
        genre: 'Hip-Hop',
        duration_seconds: 180,
        preview_url: 'https://example.com/preview1.mp3',
        file_url: 'https://example.com/beat1.mp3',
        license_type: 'commercial',
        license_url: 'https://example.com/license1',
        source: 'beatstars',
        usage_count: 25
      },
      {
        title: 'Trap Anthem',
        artist: 'BeatMaster',
        tempo: 140,
        key_signature: 'G minor',
        genre: 'Trap',
        duration_seconds: 240,
        preview_url: 'https://example.com/preview2.mp3',
        file_url: 'https://example.com/beat2.mp3',
        license_type: 'commercial',
        license_url: 'https://example.com/license2',
        source: 'beatstars',
        usage_count: 42
      },
      {
        title: 'Lofi Vibes',
        artist: 'Chill Producer',
        tempo: 85,
        key_signature: 'D major',
        genre: 'Lofi',
        duration_seconds: 200,
        preview_url: 'https://example.com/preview3.mp3',
        file_url: 'https://example.com/beat3.mp3',
        license_type: 'commercial',
        license_url: 'https://example.com/license3',
        source: 'beatstars',
        usage_count: 18
      },
      {
        title: 'Club Banger',
        artist: 'DJ Beats',
        tempo: 128,
        key_signature: 'F major',
        genre: 'EDM',
        duration_seconds: 220,
        preview_url: 'https://example.com/preview4.mp3',
        file_url: 'https://example.com/beat4.mp3',
        license_type: 'commercial',
        license_url: 'https://example.com/license4',
        source: 'beatstars',
        usage_count: 67
      },
      {
        title: 'R&B Flow',
        artist: 'Soul Producer',
        tempo: 75,
        key_signature: 'B minor',
        genre: 'R&B',
        duration_seconds: 190,
        preview_url: 'https://example.com/preview5.mp3',
        file_url: 'https://example.com/beat5.mp3',
        license_type: 'commercial',
        license_url: 'https://example.com/license5',
        source: 'beatstars',
        usage_count: 33
      }
    ];

    for (const beat of beats) {
      await client.query(`
        INSERT INTO public.beats (
          title, artist, tempo, key_signature, genre, duration_seconds,
          preview_url, file_url, license_type, license_url, source, usage_count,
          is_active, is_verified, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, true, 'active'
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          artist = EXCLUDED.artist,
          usage_count = EXCLUDED.usage_count,
          updated_at = now()
      `, [
        beat.title, beat.artist, beat.tempo, beat.key_signature, beat.genre,
        beat.duration_seconds, beat.preview_url, beat.file_url, beat.license_type,
        beat.license_url, beat.source, beat.usage_count
      ]);
      
      console.log(`✅ Added beat: ${beat.title}`);
    }

    console.log('\n🎵 Sample beats added successfully!');
    console.log('📱 You can now test the beat library at: http://localhost:3000/app/beats');

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Failed to add beats:', err.message);
    process.exit(1);
  }
}

addSampleBeats();

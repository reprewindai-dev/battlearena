import pg from 'pg';

const { Client } = pg;

async function addBeatPreviews() {
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

    // Update beats with real preview URLs (using free sample audio)
    const updates = [
      {
        title: 'Boom Bap Classic',
        preview_url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        file_url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav'
      },
      {
        title: 'Trap Anthem',
        preview_url: 'https://www.soundjay.com/misc/sounds/beep-07a.wav',
        file_url: 'https://www.soundjay.com/misc/sounds/beep-07a.wav'
      },
      {
        title: 'Lofi Vibes',
        preview_url: 'https://www.soundjay.com/misc/sounds/button-3.wav',
        file_url: 'https://www.soundjay.com/misc/sounds/button-3.wav'
      },
      {
        title: 'Club Banger',
        preview_url: 'https://www.soundjay.com/misc/sounds/button-09.wav',
        file_url: 'https://www.soundjay.com/misc/sounds/button-09.wav'
      },
      {
        title: 'R&B Flow',
        preview_url: 'https://www.soundjay.com/misc/sounds/button-10.wav',
        file_url: 'https://www.soundjay.com/misc/sounds/button-10.wav'
      }
    ];

    for (const beat of updates) {
      await client.query(`
        UPDATE public.beats 
        SET preview_url = $1, file_url = $2
        WHERE title = $3
      `, [beat.preview_url, beat.file_url, beat.title]);
      
      console.log(`✅ Updated preview for: ${beat.title}`);
    }

    console.log('\n🎵 Beat previews updated with working URLs!');
    console.log('📱 You can now test audio preview at: http://localhost:3000/app/beats');

    await client.end();
    console.log('🔌 Disconnected cleanly');
  } catch (err) {
    console.error('❌ Failed to update previews:', err.message);
    process.exit(1);
  }
}

addBeatPreviews();

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment
config({ path: '.env.production' });
config({ path: '.env.local' });
config();

async function testMatchmakingClient() {
  console.log('🔍 Testing Client Matchmaking Access');
  console.log('=====================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase client configuration');
  }

  // Test client access (same as frontend)
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // Test 1: Can read from matchmaking_queue
    console.log('🔍 Testing matchmaking queue access...');
    const { data: queueData, error: queueError } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .limit(1);

    if (queueError) {
      console.log(`❌ Queue access error: ${queueError.message}`);
      console.log(`   Error code: ${queueError.code}`);
    } else {
      console.log('✅ Queue access: OK');
    }

    // Test 2: Can insert into matchmaking_queue (simulate enqueue)
    console.log('\n📝 Testing queue insert...');
    const testUserId = '00000000-0000-0000-0000-000000000001';
    
    // First delete any existing entry
    await supabase
      .from('matchmaking_queue')
      .delete()
      .eq('user_id', testUserId);

    const { data: insertData, error: insertError } = await supabase
      .from('matchmaking_queue')
      .insert({
        user_id: testUserId,
        queue_type: 'freestyle',
        battle_format: '60s',
        preferred_genres: [],
        status: 'active'
      })
      .select()
      .single();

    if (insertError) {
      console.log(`❌ Insert error: ${insertError.message}`);
      console.log(`   Error code: ${insertError.code}`);
      console.log(`   Error details: ${JSON.stringify(insertError.details, null, 2)}`);
    } else {
      console.log('✅ Queue insert: OK');
      console.log(`   Created entry: ${insertData.id}`);
    }

    // Test 3: Can delete from matchmaking_queue (simulate dequeue)
    console.log('\n🗑️ Testing queue delete...');
    const { error: deleteError } = await supabase
      .from('matchmaking_queue')
      .delete()
      .eq('user_id', testUserId);

    if (deleteError) {
      console.log(`❌ Delete error: ${deleteError.message}`);
      console.log(`   Error code: ${deleteError.code}`);
    } else {
      console.log('✅ Queue delete: OK');
    }

    // Test 4: Check RLS policies
    console.log('\n🔐 Testing RLS policies...');
    const { data: allQueues, error: allError } = await supabase
      .from('matchmaking_queue')
      .select('*');

    if (allError) {
      console.log(`❌ RLS error: ${allError.message}`);
    } else {
      console.log(`✅ RLS access: Can see ${allQueues.length} queue entries`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n=====================================');
  console.log('🎯 Client matchmaking test complete');
}

testMatchmakingClient().catch(console.error);

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment
config({ path: '.env.production' });
config({ path: '.env.local' });
config();

async function debugFrontendUser() {
  console.log('🔍 Debugging Frontend User Session');
  console.log('=====================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  // Simulate browser client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // Try to get current session (simulating browser)
    console.log('🔍 Checking current session...');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log(`❌ Session error: ${sessionError.message}`);
    } else if (sessionData.session) {
      console.log(`✅ Session found: ${sessionData.session.user.id}`);
      console.log(`   Email: ${sessionData.session.user.email}`);
      
      // Check if this user exists in public.users
      const { data: publicUser, error: publicError } = await supabase
        .from('users')
        .select('*')
        .eq('id', sessionData.session.user.id)
        .single();

      if (publicError) {
        console.log(`❌ Public user error: ${publicError.message}`);
        console.log(`   Code: ${publicError.code}`);
        
        if (publicError.code === 'PGRST116') {
          console.log(`   Creating public user record...`);
          
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: sessionData.session.user.id,
              email: sessionData.session.user.email || 'unknown@battlearena.com',
              username: sessionData.session.user.email?.split('@')[0] || 'user'
            });
            
          if (insertError) {
            console.log(`❌ Failed to create public user: ${insertError.message}`);
            console.log(`   Details: ${JSON.stringify(insertError.details, null, 2)}`);
          } else {
            console.log(`✅ Public user record created`);
          }
        }
      } else {
        console.log(`✅ Public user record exists`);
      }
      
      // Test queue insertion with this user
      console.log('\n🧪 Testing queue insertion...');
      const { data: queueData, error: queueError } = await supabase
        .from('matchmaking_queue')
        .insert({
          user_id: sessionData.session.user.id,
          queue_type: 'freestyle',
          battle_format: '60s',
          preferred_genres: [],
          status: 'active'
        })
        .select()
        .single();

      if (queueError) {
        console.log(`❌ Queue insertion error: ${queueError.message}`);
        console.log(`   Code: ${queueError.code}`);
        console.log(`   Details: ${JSON.stringify(queueError.details, null, 2)}`);
      } else {
        console.log(`✅ Queue insertion successful`);
        console.log(`   Queue ID: ${queueData.id}`);
        
        // Clean up
        await supabase
          .from('matchmaking_queue')
          .delete()
          .eq('id', queueData.id);
        console.log(`✅ Test queue entry cleaned up`);
      }
      
    } else {
      console.log(`❌ No session found`);
      console.log(`   Trying to sign in...`);
      
      // Try to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'test@battlearena.com',
        password: 'TestPassword123!'
      });

      if (signInError) {
        console.log(`❌ Sign in error: ${signInError.message}`);
      } else {
        console.log(`✅ Sign in successful`);
        console.log(`   User ID: ${signInData.user?.id}`);
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }

  console.log('\n=====================================');
  console.log('🎯 Frontend user debug complete');
}

debugFrontendUser().catch(console.error);

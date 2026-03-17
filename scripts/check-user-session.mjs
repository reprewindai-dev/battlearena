import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment
config({ path: '.env.production' });
config({ path: '.env.local' });
config();

async function checkUserSession() {
  console.log('🔍 Checking User Session Status');
  console.log('=====================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // Check current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log(`❌ Session error: ${sessionError.message}`);
    } else {
      console.log(`✅ Session check: ${sessionData.session ? 'Active session found' : 'No active session'}`);
      
      if (sessionData.session) {
        console.log(`   User ID: ${sessionData.session.user.id}`);
        console.log(`   Email: ${sessionData.session.user.email}`);
      }
    }

    // Try to get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.log(`❌ User error: ${userError.message}`);
      console.log(`   This usually means no user is logged in`);
    } else {
      console.log(`✅ User check: ${userData.user ? 'User data available' : 'No user data'}`);
      
      if (userData.user) {
        console.log(`   User ID: ${userData.user.id}`);
        console.log(`   Email: ${userData.user.email}`);
      }
    }

    console.log('\n📝 Solution:');
    console.log('1. Make sure you are logged in at: http://localhost:3000/login');
    console.log('2. Use the test credentials:');
    console.log('   Email: test@battlearena.com');
    console.log('   Password: TestPassword123!');
    console.log('3. After logging in, try joining the queue again');

  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }

  console.log('\n=====================================');
  console.log('🎯 User session check complete');
}

checkUserSession().catch(console.error);

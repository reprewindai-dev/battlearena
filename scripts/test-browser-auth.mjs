import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment
config({ path: '.env.production' });
config({ path: '.env.local' });
config();

async function testBrowserAuth() {
  console.log('🔍 Testing Browser Auth Simulation');
  console.log('=====================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase configuration');
  }

  // Create browser client (same as frontend)
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // Try to sign in with test credentials
    console.log('🔐 Attempting to sign in with test credentials...');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test@battlearena.com',
      password: 'TestPassword123!'
    });

    if (error) {
      console.log(`❌ Sign in error: ${error.message}`);
      console.log(`   This might mean the user doesn't exist or password is wrong`);
      
      // Try to create the user
      console.log('\n👤 Trying to create test user...');
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: 'test@battlearena.com',
        password: 'TestPassword123!',
        options: {
          emailRedirectTo: `${supabaseUrl}/auth/callback`
        }
      });

      if (signUpError) {
        console.log(`❌ Sign up error: ${signUpError.message}`);
        console.log(`   Error details: ${signUpError.code}`);
      } else {
        console.log(`✅ User created successfully`);
        console.log(`   User ID: ${signUpData.user?.id}`);
        console.log(`   Email: ${signUpData.user?.email}`);
      }
    } else {
      console.log(`✅ Sign in successful`);
      console.log(`   User ID: ${data.user?.id}`);
      console.log(`   Email: ${data.user?.email}`);
      console.log(`   Session: ${data.session ? 'Active' : 'None'}`);

      // Now test getting the user
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.log(`❌ Get user error: ${userError.message}`);
      } else {
        console.log(`✅ Get user successful`);
        console.log(`   User ID: ${userData.user?.id}`);
      }
    }

    console.log('\n📝 Instructions:');
    console.log('1. If user creation succeeded, check your email for verification');
    console.log('2. Or try signing in with these credentials in the browser:');
    console.log('   Email: test@battlearena.com');
    console.log('   Password: TestPassword123!');
    console.log('3. Go to: http://localhost:3000/login');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n=====================================');
  console.log('🎯 Browser auth test complete');
}

testBrowserAuth().catch(console.error);

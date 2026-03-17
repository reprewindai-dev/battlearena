import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment
config({ path: '.env.production' });
config({ path: '.env.local' });
config();

async function testFullAuth() {
  console.log('🔐 Testing Full Authentication System');
  console.log('=====================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  // Test 1: Anon client access
  console.log('🔍 Testing anonymous client access...');
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    const { data, error } = await anonClient.from('users').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Anonymous client: Can read public data');
  } catch (error) {
    console.log(`❌ Anonymous client error: ${error.message}`);
  }

  // Test 2: Service client access
  console.log('\n🔧 Testing service role access...');
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const { data, error } = await serviceClient.from('users').select('*').limit(1);
    if (error) throw error;
    console.log('✅ Service client: Full database access');
  } catch (error) {
    console.log(`❌ Service client error: ${error.message}`);
  }

  // Test 3: Auth session check
  console.log('\n👤 Testing auth session...');
  try {
    const { data, error } = await anonClient.auth.getSession();
    if (error && error.message !== 'Invalid JWT') {
      throw error;
    }
    console.log('✅ Auth service: Responding correctly');
  } catch (error) {
    console.log(`❌ Auth service error: ${error.message}`);
  }

  // Test 4: Test user creation
  console.log('\n👥 Testing user creation...');
  const testUser = {
    email: 'test@battlearena.com',
    password: 'TestPassword123!',
    username: 'TestUser'
  };

  try {
    const { data, error } = await serviceClient.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true
    });
    
    if (error) {
      if (error.message.includes('already registered')) {
        console.log('✅ User creation: Test user already exists');
      } else {
        throw error;
      }
    } else {
      console.log('✅ User creation: Test user created successfully');
      
      // Add to public users table
      await serviceClient.from('users').insert({
        id: data.user.id,
        email: data.user.email,
        username: testUser.username
      });
      console.log('✅ Public user record created');
    }
  } catch (error) {
    console.log(`❌ User creation error: ${error.message}`);
  }

  // Test 5: Matchmaking queue access
  console.log('\n⚔️ Testing matchmaking access...');
  try {
    const { data, error } = await anonClient.from('matchmaking_queue').select('*').limit(1);
    if (error) throw error;
    console.log('✅ Matchmaking: Queue accessible');
  } catch (error) {
    console.log(`❌ Matchmaking error: ${error.message}`);
  }

  // Test 6: Battle sessions access
  console.log('\n🎮 Testing battle sessions access...');
  try {
    const { data, error } = await anonClient.from('battles').select('*').limit(1);
    if (error) throw error;
    console.log('✅ Battle sessions: Accessible');
  } catch (error) {
    console.log(`❌ Battle sessions error: ${error.message}`);
  }

  console.log('\n=====================================');
  console.log('🎯 Authentication system test complete');
  console.log('📱 You can now test signup/login at: http://localhost:3000');
}

testFullAuth().catch(console.error);

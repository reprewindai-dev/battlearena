import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment
config({ path: '.env.production' });
config({ path: '.env.local' });
config();

async function debugCurrentUser() {
  console.log('🔍 Debugging Current User Session');
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
    
    console.log('📋 Session Status:');
    if (sessionError) {
      console.log(`❌ Session error: ${sessionError.message}`);
    } else if (sessionData.session) {
      console.log(`✅ Active session found`);
      console.log(`   User ID: ${sessionData.session.user.id}`);
      console.log(`   Email: ${sessionData.session.user.email}`);
      console.log(`   Created at: ${sessionData.session.user.created_at}`);
    } else {
      console.log(`❌ No active session`);
    }

    // Try to get current user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    console.log('\n👤 User Status:');
    if (userError) {
      console.log(`❌ User error: ${userError.message}`);
    } else if (userData.user) {
      console.log(`✅ User data available`);
      console.log(`   User ID: ${userData.user.id}`);
      console.log(`   Email: ${userData.user.email}`);
    } else {
      console.log(`❌ No user data`);
    }

    // Check if user exists in public.users table
    if (userData.user) {
      const { data: publicUser, error: publicError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userData.user.id)
        .single();

      console.log('\n🗄️ Public User Record:');
      if (publicError) {
        console.log(`❌ Public user error: ${publicError.message}`);
        console.log(`   Code: ${publicError.code}`);
        
        if (publicError.code === 'PGRST116') {
          console.log(`   This means the user doesn't exist in public.users table`);
          console.log(`   Creating public user record...`);
          
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: userData.user.id,
              email: userData.user.email || 'unknown@battlearena.com',
              username: userData.user.email?.split('@')[0] || 'user'
            });
            
          if (insertError) {
            console.log(`❌ Failed to create public user: ${insertError.message}`);
          } else {
            console.log(`✅ Public user record created`);
          }
        }
      } else {
        console.log(`✅ Public user record exists`);
        console.log(`   Username: ${publicUser.username}`);
        console.log(`   Email: ${publicUser.email}`);
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }

  console.log('\n=====================================');
  console.log('🎯 Debug complete');
}

debugCurrentUser().catch(console.error);

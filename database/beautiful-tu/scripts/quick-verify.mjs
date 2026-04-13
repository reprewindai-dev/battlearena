import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment
config({ path: '.env.production' });
config({ path: '.env.local' });
config();

async function quickVerification() {
  console.log('🚀 Quick Production Verification');
  console.log('=====================================\n');

  const results = {
    database: false,
    matchmaking: false,
    auth: false,
    frontend: false
  };

  // Test 1: Database Connection
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Test database connection
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) throw error;
    
    console.log('✅ Database: Connected and accessible');
    results.database = true;
  } catch (error) {
    console.log(`❌ Database: ${error.message}`);
  }

  // Test 2: Matchmaking Schema
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check matchmaking tables exist
    const tables = ['matchmaking_queue', 'battles', 'battle_sessions', 'beats'];
    for (const table of tables) {
      const { error } = await supabase.from(table).select('count').limit(1);
      if (error) throw new Error(`Table ${table} not accessible`);
    }
    
    console.log('✅ Matchmaking: All tables present and accessible');
    results.matchmaking = true;
  } catch (error) {
    console.log(`❌ Matchmaking: ${error.message}`);
  }

  // Test 3: Auth Configuration
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Auth configuration missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Test auth service
    const { data, error } = await supabase.auth.getSession();
    // Should work without error even if no session
    if (error && error.message !== 'Invalid JWT') {
      throw error;
    }
    
    console.log('✅ Auth: Service configured and accessible');
    results.auth = true;
  } catch (error) {
    console.log(`❌ Auth: ${error.message}`);
  }

  // Test 4: Frontend Build
  try {
    // Check if Next.js dev server is running
    const response = await fetch('http://localhost:3000').catch(() => null);
    if (response && response.ok) {
      console.log('✅ Frontend: Dev server running at localhost:3000');
      results.frontend = true;
    } else {
      throw new Error('Dev server not responding');
    }
  } catch (error) {
    console.log(`❌ Frontend: ${error.message}`);
  }

  // Summary
  console.log('\n=====================================');
  console.log('📊 Quick Verification Results:');
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  console.log(`✅ Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('🎉 Core systems ready for development!');
  } else {
    console.log('⚠️  Some systems need attention before full production');
  }

  // Environment Check
  console.log('\n🔧 Environment Status:');
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DATABASE_URL'
  ];
  
  let envCount = 0;
  requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`✅ ${varName}`);
      envCount++;
    } else {
      console.log(`❌ ${varName} - MISSING`);
    }
  });
  
  console.log(`\n📋 Environment: ${envCount}/${requiredEnvVars.length} variables set`);
  
  return results;
}

quickVerification().catch(console.error);

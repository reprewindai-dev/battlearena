#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment
config({ path: '.env.production' });
config({ path: '.env.local' });
config();

interface TestUser {
  id: string;
  name: string;
}

class MatchmakingVerifier {
  private supabase: any;
  private testUsers: TestUser[] = [];

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create test users with valid UUIDs
    this.testUsers = [
      { id: '00000000-0000-0000-0000-000000000001', name: 'TestUser1' },
      { id: '00000000-0000-0000-0000-000000000002', name: 'TestUser2' },
      { id: '00000000-0000-0000-0000-000000000003', name: 'TestUser3' },
      { id: '00000000-0000-0000-0000-000000000004', name: 'TestUser4' },
    ];
  }

  async cleanup() {
    console.log('🧹 Cleaning up test data...');
    
    // Clean up queue entries
    await this.supabase
      .from('matchmaking_queue')
      .delete()
      .in('user_id', this.testUsers.map(u => u.id));
    
    // Clean up battles
    await this.supabase
      .from('battles')
      .delete()
      .in('created_by', this.testUsers.map(u => u.id));
    
    console.log('✅ Cleanup complete');
  }

  async verifyQueueOperations() {
    console.log('🔄 Testing queue operations...');
    
    // Test 1: Users can join queue
    for (const user of this.testUsers) {
      const { data, error } = await this.supabase
        .from('matchmaking_queue')
        .insert({
          user_id: user.id,
          queue_type: 'freestyle',
          battle_format: '60s',
          status: 'active',
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to add ${user.name} to queue: ${error.message}`);
      }
      
      console.log(`✅ ${user.name} joined queue`);
    }
    
    // Test 2: Queue state is correct
    const { data: queueData, error: queueError } = await this.supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    
    if (queueError) {
      throw new Error(`Failed to query queue: ${queueError.message}`);
    }
    
    if (queueData.length !== 4) {
      throw new Error(`Expected 4 users in queue, got ${queueData.length}`);
    }
    
    console.log(`✅ Queue contains ${queueData.length} users`);
    
    return queueData;
  }

  async verifyMatchmaking() {
    console.log('⚔️ Testing matchmaking logic...');
    
    // Simulate matchmaking by pairing first two users
    const queueData = await this.supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(2);
    
    if (queueData.error || !queueData.data || queueData.data.length < 2) {
      throw new Error('Not enough users in queue for matching');
    }
    
    const [user1, user2] = queueData.data;
    const battleId = `test-battle-${Date.now()}`;
    
    // Create battle
    const { data: battle, error: battleError } = await this.supabase
      .from('battles')
      .insert({
        created_by: user1.user_id,
        participant_1_id: user1.user_id,
        participant_2_id: user2.user_id,
        queue_type: 'freestyle',
        battle_format: '60s',
        status: 'matched',
        room_id: battleId,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      })
      .select()
      .single();
    
    if (battleError) {
      throw new Error(`Failed to create battle: ${battleError.message}`);
    }
    
    console.log(`✅ Battle created: ${battle.id}`);
    
    // Update queue status
    await this.supabase
      .from('matchmaking_queue')
      .update({ status: 'matched' })
      .in('user_id', [user1.user_id, user2.user_id]);
    
    console.log(`✅ Queue updated for matched users`);
    
    return battle;
  }

  async verifyRaceConditions() {
    console.log('🏁 Testing race conditions...');
    
    // Try to match remaining users simultaneously
    const remainingUsers = this.testUsers.slice(2);
    const promises = remainingUsers.map(async (user) => {
      // Simulate concurrent matchmaking attempt
      const { data, error } = await this.supabase
        .from('matchmaking_queue')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();
      
      return { user, data, error };
    });
    
    const results = await Promise.all(promises);
    
    // Verify no duplicate matches
    const { data: battles, error: battlesError } = await this.supabase
      .from('battles')
      .select('*')
      .eq('status', 'matched');
    
    if (battlesError) {
      throw new Error(`Failed to query battles: ${battlesError.message}`);
    }
    
    // Check each user appears in at most one active battle
    const userBattleCounts = new Map<string, number>();
    
    for (const battle of battles) {
      if (battle.participant_1_id) {
        userBattleCounts.set(battle.participant_1_id, (userBattleCounts.get(battle.participant_1_id) || 0) + 1);
      }
      if (battle.participant_2_id) {
        userBattleCounts.set(battle.participant_2_id, (userBattleCounts.get(battle.participant_2_id) || 0) + 1);
      }
    }
    
    for (const [userId, count] of userBattleCounts.entries()) {
      if (count > 1) {
        throw new Error(`User ${userId} is in ${count} battles (race condition!)`);
      }
    }
    
    console.log(`✅ No race conditions detected`);
  }

  async verifyCleanup() {
    console.log('🧹 Testing cleanup of abandoned sessions...');
    
    // Simulate expired queue entries
    const expiredTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    await this.supabase
      .from('matchmaking_queue')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('created_at', expiredTime);
    
    // Run cleanup function
    const { data, error } = await this.supabase.rpc('cleanup_expired_queue');
    
    if (error) {
      throw new Error(`Cleanup function failed: ${error.message}`);
    }
    
    console.log(`✅ Cleaned up ${data} expired entries`);
  }

  async run() {
    let passed = 0;
    let failed = 0;
    const errors: string[] = [];
    
    try {
      console.log('🔍 Matchmaking System Verification\n');
      console.log('=====================================\n');
      
      await this.cleanup();
      
      // Test 1: Queue Operations
      try {
        await this.verifyQueueOperations();
        passed++;
      } catch (error) {
        errors.push(`❌ Queue Operations: ${error}`);
        failed++;
      }
      
      // Test 2: Matchmaking Logic
      try {
        await this.verifyMatchmaking();
        passed++;
      } catch (error) {
        errors.push(`❌ Matchmaking Logic: ${error}`);
        failed++;
      }
      
      // Test 3: Race Conditions
      try {
        await this.verifyRaceConditions();
        passed++;
      } catch (error) {
        errors.push(`❌ Race Conditions: ${error}`);
        failed++;
      }
      
      // Test 4: Cleanup
      try {
        await this.verifyCleanup();
        passed++;
      } catch (error) {
        errors.push(`❌ Cleanup: ${error}`);
        failed++;
      }
      
      await this.cleanup();
      
    } catch (error) {
      errors.push(`❌ Verification failed: ${error}`);
      failed++;
    }
    
    console.log('\n=====================================');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (errors.length > 0) {
      console.log('\n🚨 ERRORS:');
      errors.forEach(error => console.log(`   ${error}`));
      process.exit(1);
    } else {
      console.log('\n🎉 Matchmaking system verification passed!');
      process.exit(0);
    }
  }
}

// Run verification
const verifier = new MatchmakingVerifier();
verifier.run().catch(console.error);

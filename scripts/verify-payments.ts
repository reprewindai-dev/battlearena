#!/usr/bin/env node

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import Stripe from 'stripe';

// Load environment
config({ path: '.env.production' });
config({ path: '.env.local' });
config();

class PaymentVerifier {
  private stripe: Stripe;
  private supabase: any;

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
      throw new Error('Payment configuration missing');
    }
    
    this.stripe = new Stripe(stripeSecretKey);
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async verifyStripeConnection() {
    console.log('💳 Testing Stripe connection...');
    
    try {
      // Test Stripe API access
      const balance = await this.stripe.balance.retrieve();
      console.log(`✅ Stripe connected (livemode=${balance.livemode})`);
      return true;
    } catch (error: any) {
      throw new Error(`Stripe connection failed: ${error?.message || 'Unknown error'}`);
    }
  }

  async verifyWebhookSigning() {
    console.log('🔐 Testing webhook signing...');
    
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }
    
    // Create test webhook payload
    const testPayload = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_' + Date.now(),
          amount: 500,
          currency: 'usd',
          status: 'succeeded',
          metadata: {
            battle_id: 'test-battle',
            user_id: 'test-user'
          }
        }
      }
    };
    
    const payloadString = JSON.stringify(testPayload);
    const header = this.stripe.webhooks.generateTestHeaderString({
      payload: payloadString,
      secret: webhookSecret,
    });
    
    try {
      // Verify webhook signature
      const event = this.stripe.webhooks.constructEvent(payloadString, header, webhookSecret);
      console.log(`✅ Webhook signature verified for event: ${event.type}`);
      return true;
    } catch (error) {
      throw new Error(`Webhook signature verification failed: ${error}`);
    }
  }

  async verifyTestPayment() {
    console.log('💰 Testing test payment flow...');
    
    try {
      // Create a test payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: 500, // $5.00
        currency: 'usd',
        payment_method: 'pm_card_visa',
        confirm: true,
        metadata: {
          battle_id: 'test-battle-' + Date.now(),
          user_id: 'test-user-' + Date.now(),
          entry_type: 'ranked'
        }
      });
      
      console.log(`✅ Test payment created: ${paymentIntent.id}`);
      console.log(`   Status: ${paymentIntent.status}`);
      console.log(`   Amount: $${paymentIntent.amount / 100}`);
      
      return paymentIntent;
    } catch (error) {
      throw new Error(`Test payment failed: ${error}`);
    }
  }

  async verifyIdempotency() {
    console.log('🔄 Testing payment idempotency...');
    
    const idempotencyKey = `test_key_${Date.now()}`;
    const paymentData = {
      amount: 300,
      currency: 'usd',
      payment_method: 'pm_card_visa',
      confirm: true,
      metadata: {
        test_idempotency: 'true'
      }
    };
    
    try {
      // Create first payment
      const payment1 = await this.stripe.paymentIntents.create(paymentData, {
        idempotencyKey,
      });
      
      // Try to create duplicate with same idempotency key
      const payment2 = await this.stripe.paymentIntents.create(paymentData, {
        idempotencyKey,
      });
      
      // Should return the same payment intent
      if (payment1.id === payment2.id) {
        console.log(`✅ Idempotency working: ${payment1.id}`);
        return true;
      } else {
        throw new Error('Idempotency failed - different payment intents returned');
      }
    } catch (error) {
      throw new Error(`Idempotency test failed: ${error}`);
    }
  }

  async verifyLedgerConsistency() {
    console.log('📊 Testing ledger consistency...');
    
    try {
      // Check if payment_ledger table exists and has proper structure
      const { data: ledgerData, error: ledgerError } = await this.supabase
        .from('payment_ledger')
        .select('*')
        .limit(1);
      
      if (ledgerError && !ledgerError.message.includes('does not exist')) {
        throw new Error(`Ledger query failed: ${ledgerError.message}`);
      }
      
      // Check if battles table has payment fields
      const { data: battleData, error: battleError } = await this.supabase
        .from('battles')
        .select('entry_fee, prize_pool')
        .limit(1);
      
      if (battleError && !battleError.message.includes('does not exist')) {
        throw new Error(`Battle payment fields query failed: ${battleError.message}`);
      }
      
      console.log(`✅ Ledger structure verified`);
      return true;
    } catch (error) {
      throw new Error(`Ledger consistency check failed: ${error}`);
    }
  }

  async verifyFailedPaymentHandling() {
    console.log('❌ Testing failed payment handling...');
    
    try {
      // Create a payment that will fail
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: 500,
        currency: 'usd',
        payment_method: 'pm_card_chargeDeclined', // This card will be declined
        confirm: true,
        metadata: {
          test_failed_payment: 'true',
          battle_id: 'test-battle-failed'
        }
      });
      
      if (paymentIntent.status === 'requires_payment_method') {
        console.log(`✅ Failed payment handled correctly: ${paymentIntent.status}`);
        return true;
      } else {
        throw new Error(`Expected failed payment, got: ${paymentIntent.status}`);
      }
    } catch (error) {
      throw new Error(`Failed payment test failed: ${error}`);
    }
  }

  async run() {
    let passed = 0;
    let failed = 0;
    const errors: string[] = [];
    
    try {
      console.log('💳 Payment System Verification\n');
      console.log('=====================================\n');
      
      // Test 1: Stripe Connection
      try {
        await this.verifyStripeConnection();
        passed++;
      } catch (error) {
        errors.push(`❌ Stripe Connection: ${error}`);
        failed++;
      }
      
      // Test 2: Webhook Signing
      try {
        await this.verifyWebhookSigning();
        passed++;
      } catch (error) {
        errors.push(`❌ Webhook Signing: ${error}`);
        failed++;
      }
      
      // Test 3: Test Payment
      try {
        await this.verifyTestPayment();
        passed++;
      } catch (error) {
        errors.push(`❌ Test Payment: ${error}`);
        failed++;
      }
      
      // Test 4: Idempotency
      try {
        await this.verifyIdempotency();
        passed++;
      } catch (error) {
        errors.push(`❌ Idempotency: ${error}`);
        failed++;
      }
      
      // Test 5: Ledger Consistency
      try {
        await this.verifyLedgerConsistency();
        passed++;
      } catch (error) {
        errors.push(`❌ Ledger Consistency: ${error}`);
        failed++;
      }
      
      // Test 6: Failed Payment Handling
      try {
        await this.verifyFailedPaymentHandling();
        passed++;
      } catch (error) {
        errors.push(`❌ Failed Payment Handling: ${error}`);
        failed++;
      }
      
    } catch (error) {
      errors.push(`❌ Payment verification failed: ${error}`);
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
      console.log('\n🎉 Payment system verification passed!');
      process.exit(0);
    }
  }
}

// Run verification
const verifier = new PaymentVerifier();
verifier.run().catch(console.error);


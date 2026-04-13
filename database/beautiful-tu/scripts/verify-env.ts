#!/usr/bin/env node

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Load all env files
config({ path: '.env.production' });
config({ path: '.env.local', override: true });
config({ override: true });

interface EnvVar {
  name: string;
  required: boolean;
  pattern?: RegExp;
  description: string;
  secret?: boolean;
}

const REQUIRED_ENV_VARS: EnvVar[] = [
  // Database
  { name: 'DATABASE_URL', required: true, pattern: /^postgresql:\/\//, description: 'PostgreSQL connection string', secret: true },
  { name: 'REDIS_URL', required: true, pattern: /^redis:\/\//, description: 'Redis connection string' },
  
  // Supabase
  { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true, pattern: /^https:\/\//, description: 'Supabase project URL' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, pattern: /^eyJ/, description: 'Supabase service role key', secret: true },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true, pattern: /^eyJ/, description: 'Supabase anonymous key', secret: true },
  
  // LiveKit
  { name: 'LIVEKIT_HOST', required: true, description: 'LiveKit server host' },
  { name: 'LIVEKIT_API_KEY', required: true, pattern: /^[A-Za-z0-9_]+$/, description: 'LiveKit API key', secret: true },
  { name: 'LIVEKIT_API_SECRET', required: true, pattern: /^[A-Za-z0-9_]+$/, description: 'LiveKit API secret', secret: true },
  { name: 'NEXT_PUBLIC_LIVEKIT_URL', required: true, pattern: /^wss?:\/\//, description: 'LiveKit WebSocket URL' },
  
  // TURN Server
  { name: 'TURN_SERVER_URL', required: true, pattern: /^turn:/, description: 'TURN server URL' },
  { name: 'TURN_USERNAME', required: true, description: 'TURN server username' },
  { name: 'TURN_CREDENTIAL', required: true, description: 'TURN server credential' },
  
  // WebSocket
  { name: 'NEXT_PUBLIC_WEBSOCKET_URL', required: true, pattern: /^wss?:\/\//, description: 'WebSocket server URL' },
  
  // JWT
  { name: 'JWT_SECRET', required: true, pattern: /^.{32,}$/, description: 'JWT secret (min 32 chars)', secret: true },
  { name: 'JWT_REFRESH_SECRET', required: true, pattern: /^.{32,}$/, description: 'JWT refresh secret (min 32 chars)', secret: true },
  
  // Stripe
  { name: 'STRIPE_PUBLISHABLE_KEY', required: true, pattern: /^pk_/, description: 'Stripe publishable key', secret: true },
  { name: 'STRIPE_SECRET_KEY', required: true, pattern: /^sk_/, description: 'Stripe secret key', secret: true },
  { name: 'STRIPE_WEBHOOK_SECRET', required: true, pattern: /^whsec_/, description: 'Stripe webhook secret', secret: true },
  
  // AWS S3
  { name: 'AWS_ACCESS_KEY_ID', required: true, pattern: /^[A-Z0-9]+$/, description: 'AWS access key', secret: true },
  { name: 'AWS_SECRET_ACCESS_KEY', required: true, pattern: /^[A-Za-z0-9\/]+$/, description: 'AWS secret key', secret: true },
  { name: 'AWS_REGION', required: true, pattern: /^[a-z0-9-]+$/, description: 'AWS region' },
  { name: 'S3_BUCKET_NAME', required: true, description: 'S3 bucket name' },
  
  // Email
  { name: 'SMTP_HOST', required: true, description: 'SMTP host' },
  { name: 'SMTP_PORT', required: true, pattern: /^\d+$/, description: 'SMTP port' },
  { name: 'SMTP_USER', required: true, description: 'SMTP username' },
  { name: 'SMTP_PASS', required: true, description: 'SMTP password', secret: true },
  { name: 'FROM_EMAIL', required: true, pattern: /^[^@]+@[^@]+\.[^@]+$/, description: 'From email address' },
  
  // Security
  { name: 'CORS_ORIGIN', required: true, pattern: /^https?:\/\//, description: 'CORS origin' },
  { name: 'SESSION_SECRET', required: true, pattern: /^.{32,}$/, description: 'Session secret (min 32 chars)', secret: true },
  { name: 'BCRYPT_ROUNDS', required: true, pattern: /^\d+$/, description: 'BCrypt rounds' },
  
  // Rate Limiting
  { name: 'RATE_LIMIT_WINDOW_MS', required: true, pattern: /^\d+$/, description: 'Rate limit window (ms)' },
  { name: 'RATE_LIMIT_MAX_REQUESTS', required: true, pattern: /^\d+$/, description: 'Rate limit max requests' },
];

let passed = 0;
let failed = 0;
const errors: string[] = [];

console.log('🔍 Environment Variable Verification\n');
console.log('=====================================\n');

for (const envVar of REQUIRED_ENV_VARS) {
  const value = process.env[envVar.name];
  const status = value ? '✅' : '❌';
  
  console.log(`${status} ${envVar.name}`);
  console.log(`   Description: ${envVar.description}`);
  
  if (!value) {
    if (envVar.required) {
      errors.push(`❌ REQUIRED: ${envVar.name} is missing`);
      failed++;
    } else {
      console.log(`   ⚠️  Optional: Not set`);
      passed++;
    }
  } else {
    // Check pattern if specified
    if (envVar.pattern && !envVar.pattern.test(value)) {
      errors.push(`❌ INVALID FORMAT: ${envVar.name}`);
      failed++;
    } else {
      console.log(`   ✅ Valid format`);
      passed++;
    }
    
    // Don't log actual values for secrets
    if (envVar.secret ||
        envVar.name.toLowerCase().includes('secret') || 
        envVar.name.toLowerCase().includes('key') ||
        envVar.name.toLowerCase().includes('password') ||
        envVar.name.toLowerCase().includes('url') && envVar.name.toLowerCase().includes('database')) {
      console.log(`   Value: [REDACTED]`);
    } else {
      console.log(`   Value: ${value}`);
    }
  }
  
  console.log('');
}

console.log('=====================================');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (errors.length > 0) {
  console.log('\n🚨 ERRORS:');
  errors.forEach(error => console.log(`   ${error}`));
  process.exit(1);
} else {
  console.log('\n🎉 All environment variables are valid!');
  process.exit(0);
}

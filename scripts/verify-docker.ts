#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync } from 'fs';

interface Service {
  name: string;
  healthCheck: string;
  required: boolean;
}

const SERVICES: Service[] = [
  { name: 'battlearena-postgres', healthCheck: 'pg_isready -U postgres', required: true },
  { name: 'battlearena-redis', healthCheck: 'redis-cli ping', required: true },
  { name: 'battlearena-livekit', healthCheck: 'wget --no-verbose --tries=1 --spider http://localhost:7881/health', required: true },
  { name: 'battlearena-recording', healthCheck: 'wget --no-verbose --tries=1 --spider http://localhost:3000/health', required: true },
  { name: 'battlearena-chat', healthCheck: 'wget --no-verbose --tries=1 --spider http://localhost:8080/health', required: true },
  { name: 'battlearena-app', healthCheck: 'wget --no-verbose --tries=1 --spider http://localhost:3000/api/health', required: true },
  { name: 'battlearena-nginx', healthCheck: 'wget --no-verbose --tries=1 --spider http://localhost/health', required: true },
  { name: 'battlearena-prometheus', healthCheck: 'wget --no-verbose --tries=1 --spider http://localhost:9090/-/healthy', required: false },
  { name: 'battlearena-grafana', healthCheck: 'wget --no-verbose --tries=1 --spider http://localhost:3001/api/health', required: false },
];

let passed = 0;
let failed = 0;
const errors: string[] = [];

console.log('🐳 Docker Production Verification\n');
console.log('=====================================\n');

// Check if docker-compose.production.yml exists
if (!existsSync('docker-compose.production.yml')) {
  errors.push('❌ docker-compose.production.yml not found');
  process.exit(1);
}

try {
  console.log('📋 Checking Docker Compose status...\n');
  
  // Get docker compose ps output
  const psOutput = execSync('docker compose -f docker-compose.production.yml ps', { encoding: 'utf8' });
  console.log(psOutput);
  
  console.log('\n🔍 Checking service health...\n');
  
  for (const service of SERVICES) {
    try {
      console.log(`🔍 ${service.name}...`);
      
      // Check if container is running
      const containerStatus = execSync(`docker compose -f docker-compose.production.yml ps ${service.name}`, { encoding: 'utf8' });
      
      if (!containerStatus.includes('Up')) {
        const error = `❌ ${service.name} is not running`;
        console.log(`   ${error}`);
        if (service.required) {
          errors.push(error);
          failed++;
        }
        continue;
      }
      
      // Run health check
      try {
        execSync(`docker compose -f docker-compose.production.yml exec ${service.name} sh -c "${service.healthCheck}"`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        console.log(`   ✅ Healthy`);
        passed++;
      } catch (healthError) {
        const error = `❌ ${service.name} health check failed`;
        console.log(`   ${error}`);
        if (service.required) {
          errors.push(error);
          failed++;
        }
      }
      
    } catch (error) {
      const errorMsg = `❌ ${service.name} check failed: ${error}`;
      console.log(`   ${errorMsg}`);
      if (service.required) {
        errors.push(errorMsg);
        failed++;
      }
    }
    
    console.log('');
  }
  
  // Test application endpoints
  console.log('🌐 Testing application endpoints...\n');
  
  const endpoints = [
    { url: 'http://localhost/api/health', name: 'App Health API' },
    { url: 'http://localhost:3000/api/health', name: 'App Health API (direct)' },
    { url: 'http://localhost:8080/health', name: 'Chat Server Health' },
    { url: 'http://localhost:7881/health', name: 'LiveKit Health' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = execSync(`curl -f -s -o /dev/null -w "%{http_code}" ${endpoint.url}`, { encoding: 'utf8' });
      if (response === '200') {
        console.log(`✅ ${endpoint.name}: ${response}`);
        passed++;
      } else {
        console.log(`❌ ${endpoint.name}: HTTP ${response}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name}: Failed`);
      failed++;
    }
  }
  
} catch (error) {
  errors.push(`❌ Docker verification failed: ${error}`);
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
  console.log('\n🎉 All Docker services are healthy!');
  process.exit(0);
}

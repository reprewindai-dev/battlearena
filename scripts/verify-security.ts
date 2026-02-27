#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment
config({ path: '.env.production' });
config({ path: '.env.local' });
config();

interface SecurityTestResult {
  testName: string;
  passed: boolean;
  error?: string;
  evidence?: any;
}

class SecurityVerifier {
  private results: SecurityTestResult[] = [];

  async testCORSConfiguration(): Promise<SecurityTestResult> {
    const testName = 'CORS Configuration';
    
    try {
      // Test CORS headers
      const curlOutput = execSync('curl -I -H "Origin: https://evil.com" http://localhost', { encoding: 'utf8' });
      
      const headers = curlOutput.split('\n');
      const accessControlAllowOrigin = headers.find(h => h.toLowerCase().includes('access-control-allow-origin'));
      
      if (!accessControlAllowOrigin) {
        throw new Error('No Access-Control-Allow-Origin header found');
      }
      
      // Should not allow evil.com in production
      if (accessControlAllowOrigin.includes('evil.com') || accessControlAllowOrigin.includes('*')) {
        throw new Error('CORS allows unauthorized origins');
      }
      
      return {
        testName,
        passed: true,
        evidence: { corsHeader: accessControlAllowOrigin.trim() }
      };
      
    } catch (error) {
      return {
        testName,
        passed: false,
        error: error.message
      };
    }
  }

  async testSecurityHeaders(): Promise<SecurityTestResult> {
    const testName = 'Security Headers';
    
    try {
      const curlOutput = execSync('curl -I http://localhost', { encoding: 'utf8' });
      const headers = curlOutput.split('\n');
      
      const requiredHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'x-xss-protection',
        'strict-transport-security'
      ];
      
      const missingHeaders: string[] = [];
      
      for (const header of requiredHeaders) {
        const found = headers.some(h => h.toLowerCase().includes(header));
        if (!found) {
          missingHeaders.push(header);
        }
      }
      
      if (missingHeaders.length > 0) {
        throw new Error(`Missing security headers: ${missingHeaders.join(', ')}`);
      }
      
      return {
        testName,
        passed: true,
        evidence: { headersPresent: requiredHeaders }
      };
      
    } catch (error) {
      return {
        testName,
        passed: false,
        error: error.message
      };
    }
  }

  async testRateLimiting(): Promise<SecurityTestResult> {
    const testName = 'Rate Limiting';
    
    try {
      // Test rate limiting on auth endpoint
      let rateLimitHit = false;
      
      for (let i = 0; i < 20; i++) {
        try {
          execSync('curl -f -s -o /dev/null -w "%{http_code}" http://localhost/api/auth/signin', { 
            encoding: 'utf8',
            stdio: 'pipe'
          });
        } catch (error) {
          // Check if rate limited
          if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
            rateLimitHit = true;
            break;
          }
        }
      }
      
      if (!rateLimitHit) {
        throw new Error('Rate limiting not triggered after 20 requests');
      }
      
      return {
        testName,
        passed: true,
        evidence: { rateLimitTriggered: true }
      };
      
    } catch (error) {
      return {
        testName,
        passed: false,
        error: error.message
      };
    }
  }

  async testRBAC(): Promise<SecurityTestResult> {
    const testName = 'Role-Based Access Control';
    
    try {
      // Test admin route without authentication
      try {
        execSync('curl -f -s -o /dev/null http://localhost/api/admin/users', { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        throw new Error('Admin route accessible without authentication');
      } catch (error) {
        // Expected to fail
        if (!error.message.includes('401') && !error.message.includes('403')) {
          throw new Error(`Unexpected error: ${error.message}`);
        }
      }
      
      // Test moderator route without authentication
      try {
        execSync('curl -f -s -o /dev/null http://localhost/api/mod/ban', { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        throw new Error('Moderator route accessible without authentication');
      } catch (error) {
        // Expected to fail
        if (!error.message.includes('401') && !error.message.includes('403')) {
          throw new Error(`Unexpected error: ${error.message}`);
        }
      }
      
      return {
        testName,
        passed: true,
        evidence: { protectedRoutesBlocked: true }
      };
      
    } catch (error) {
      return {
        testName,
        passed: false,
        error: error.message
      };
    }
  }

  async testSecretExposure(): Promise<SecurityTestResult> {
    const testName = 'Secret Exposure Check';
    
    try {
      // Check client bundle for secrets
      const secretPatterns = [
        /sk_live_[A-Za-z0-9]{24,}/, // Stripe secret key
        /SUPABASE_SERVICE_ROLE_KEY/,
        /LIVEKIT_API_SECRET/,
        /JWT_SECRET/,
        /DATABASE_URL/,
        /AWS_SECRET_ACCESS_KEY/
      ];
      
      const buildDir = join(process.cwd(), '.next');
      if (!existsSync(buildDir)) {
        throw new Error('Build directory not found - run npm run build first');
      }
      
      // Simple check for secrets in built files
      const checkFiles = [
        join(buildDir, 'static'),
        join(buildDir, 'server')
      ];
      
      let secretsFound = 0;
      
      for (const dir of checkFiles) {
        if (!existsSync(dir)) continue;
        
        try {
          const output = execSync(`grep -r "sk_live\\|SUPABASE_SERVICE_ROLE_KEY\\|LIVEKIT_API_SECRET" ${dir} 2>/dev/null || true`, { 
            encoding: 'utf8'
          });
          
          if (output.trim()) {
            secretsFound += output.split('\n').length;
          }
        } catch (error) {
          // No secrets found, which is good
        }
      }
      
      if (secretsFound > 0) {
        throw new Error(`Found ${secretsFound} potential secrets in client bundle`);
      }
      
      return {
        testName,
        passed: true,
        evidence: { secretsFound: 0 }
      };
      
    } catch (error) {
      return {
        testName,
        passed: false,
        error: error.message
      };
    }
  }

  async testEnvironmentVariables(): Promise<SecurityTestResult> {
    const testName = 'Environment Variables Security';
    
    try {
      // Check for hardcoded secrets in source code
      const sourceDir = join(process.cwd(), 'src');
      const secretPatterns = [
        'sk_live_',
        'SUPABASE_SERVICE_ROLE_KEY',
        'LIVEKIT_API_SECRET',
        'JWT_SECRET',
        'DATABASE_URL=postgresql://',
        'AWS_SECRET_ACCESS_KEY'
      ];
      
      let hardcodedSecrets = 0;
      
      for (const pattern of secretPatterns) {
        try {
          const output = execSync(`grep -r "${pattern}" ${sourceDir} --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null || true`, { 
            encoding: 'utf8'
          });
          
          if (output.trim()) {
            hardcodedSecrets += output.split('\n').length;
          }
        } catch (error) {
          // No hardcoded secrets found
        }
      }
      
      if (hardcodedSecrets > 0) {
        throw new Error(`Found ${hardcodedSecrets} hardcoded secrets in source code`);
      }
      
      return {
        testName,
        passed: true,
        evidence: { hardcodedSecrets: 0 }
      };
      
    } catch (error) {
      return {
        testName,
        passed: false,
        error: error.message
      };
    }
  }

  async testInputValidation(): Promise<SecurityTestResult> {
    const testName = 'Input Validation';
    
    try {
      // Test SQL injection attempt
      const maliciousPayload = "'; DROP TABLE users; --";
      
      try {
        const response = execSync(`curl -X POST -H "Content-Type: application/json" -d '{"email":"${maliciousPayload}","password":"test"}' -f -s -o /dev/null -w "%{http_code}" http://localhost/api/auth/signin`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        // Should return 400 (bad request) not 500 (server error)
        if (response === '500') {
          throw new Error('SQL injection caused server error - input validation missing');
        }
      } catch (error) {
        // Expected to fail with validation error
        if (!error.message.includes('400') && !error.message.includes('422')) {
          throw new Error(`Unexpected response: ${error.message}`);
        }
      }
      
      // Test XSS attempt
      const xssPayload = '<script>alert("xss")</script>';
      
      try {
        const response = execSync(`curl -X POST -H "Content-Type: application/json" -d '{"message":"${xssPayload}"}' -f -s -o /dev/null -w "%{http_code}" http://localhost/api/chat/send`, { 
          encoding: 'utf8',
          stdio: 'pipe'
        });
        
        // Should handle XSS safely
        if (response === '500') {
          throw new Error('XSS payload caused server error');
        }
      } catch (error) {
        // Expected to be handled safely
      }
      
      return {
        testName,
        passed: true,
        evidence: { inputValidationWorking: true }
      };
      
    } catch (error) {
      return {
        testName,
        passed: false,
        error: error.message
      };
    }
  }

  async run() {
    let passed = 0;
    let failed = 0;
    
    try {
      console.log('🔒 Security System Verification\n');
      console.log('=====================================\n');
      
      const tests = [
        () => this.testCORSConfiguration(),
        () => this.testSecurityHeaders(),
        () => this.testRateLimiting(),
        () => this.testRBAC(),
        () => this.testSecretExposure(),
        () => this.testEnvironmentVariables(),
        () => this.testInputValidation()
      ];
      
      for (const test of tests) {
        const result = await test();
        this.results.push(result);
        
        if (result.passed) {
          passed++;
          console.log(`✅ ${result.testName}`);
        } else {
          failed++;
          console.log(`❌ ${result.testName}: ${result.error}`);
        }
      }
      
    } catch (error) {
      failed++;
      console.log(`❌ Security verification failed: ${error}`);
    }
    
    console.log('\n=====================================');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('\n🎉 Security system verification passed!');
      process.exit(0);
    }
  }
}

// Run verification
const verifier = new SecurityVerifier();
verifier.run().catch(console.error);

#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

interface LoadTestConfig {
  scenarios: {
    name: string;
    weight: number;
    flow: string[];
  }[];
  target: string;
  phases: {
    duration: number;
    arrivalRate: number;
  }[];
}

class LoadTestVerifier {
  private config: LoadTestConfig;

  constructor() {
    this.config = {
      target: 'http://localhost:3000',
      scenarios: [
        {
          name: 'Browse Battles',
          weight: 30,
          flow: [
            'getHomePage',
            'getBattlesPage',
            'getBeatLibrary'
          ]
        },
        {
          name: 'Join Queue',
          weight: 40,
          flow: [
            'signIn',
            'getBattlesPage',
            'joinQueue'
          ]
        },
        {
          name: 'Live Battle',
          weight: 20,
          flow: [
            'signIn',
            'joinQueue',
            'enterBattleRoom',
            'enableMedia'
          ]
        },
        {
          name: 'Chat Activity',
          weight: 10,
          flow: [
            'signIn',
            'enterBattleRoom',
            'sendMessages'
          ]
        }
      ],
      phases: [
        {
          duration: 60, // 1 minute ramp up
          arrivalRate: 5
        },
        {
          duration: 300, // 5 minutes at load
          arrivalRate: 20
        },
        {
          duration: 60, // 1 minute ramp down
          arrivalRate: 5
        }
      ]
    };
  }

  generateArtilleryConfig() {
    const artilleryConfig = {
      config: {
        target: this.config.target,
        phases: this.config.phases,
        processor: './artillery-processor.js'
      },
      scenarios: this.config.scenarios.map(scenario => ({
        name: scenario.name,
        weight: scenario.weight,
        flow: scenario.flow.map(step => this.getStepFunction(step))
      }))
    };

    writeFileSync('artillery-config.yml', JSON.stringify(artilleryConfig, null, 2));
    return artilleryConfig;
  }

  private getStepFunction(step: string) {
    const steps = {
      getHomePage: {
        get: {
          url: '/'
        }
      },
      getBattlesPage: {
        get: {
          url: '/app/battles'
        }
      },
      getBeatLibrary: {
        get: {
          url: '/app/beats'
        }
      },
      signIn: {
        post: {
          url: '/api/auth/signin',
          json: {
            email: '{{ $randomEmail() }}',
            password: 'testpassword123'
          }
        }
      },
      joinQueue: {
        post: {
          url: '/api/matchmaking/enqueue',
          json: {
            mode: 'freestyle'
          }
        }
      },
      enterBattleRoom: {
        get: {
          url: '/app/battles/room/{{ $randomString() }}'
        }
      },
      enableMedia: {
        think: 2
      },
      sendMessages: [
        {
          think: 1
        },
        {
          post: {
            url: '/api/chat/send',
            json: {
              message: 'Test message {{ $randomString() }}'
            }
          }
        }
      ]
    };

    return steps[step] || { think: 1 };
  }

  generateArtilleryProcessor() {
    const processor = `
module.exports = {
  randomEmail: function() {
    const domains = ['test.com', 'example.com', 'demo.com'];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return 'user' + Math.random().toString(36).substring(7) + '@' + domain;
  },
  
  randomString: function() {
    return Math.random().toString(36).substring(7);
  }
};
`;

    writeFileSync('artillery-processor.js', processor);
  }

  async checkSystemHealth() {
    console.log('🏥 Checking system health before load test...');
    
    try {
      // Check if services are running
      const services = [
        { name: 'App', url: 'http://localhost:3000/api/health' },
        { name: 'Chat', url: 'http://localhost:8080/health' },
        { name: 'LiveKit', url: 'http://localhost:7881/health' }
      ];
      
      for (const service of services) {
        try {
          execSync(`curl -f -s -o /dev/null ${service.url}`, { stdio: 'pipe' });
          console.log(`✅ ${service.name} is healthy`);
        } catch (error) {
          throw new Error(`${service.name} is not responding`);
        }
      }
      
      // Check system resources
      const memory = execSync('free -m', { encoding: 'utf8' });
      const cpu = execSync('top -bn1 | grep "Cpu(s)"', { encoding: 'utf8' });
      
      console.log('📊 System Resources:');
      console.log(memory.split('\n')[1]);
      console.log(cpu.trim());
      
    } catch (error) {
      throw new Error(`System health check failed: ${error}`);
    }
  }

  async runLoadTest() {
    console.log('🚀 Starting load test...');
    
    try {
      // Generate artillery config
      this.generateArtilleryConfig();
      this.generateArtilleryProcessor();
      
      // Run artillery
      console.log('📈 Running artillery load test...');
      const output = execSync('artillery run artillery-config.yml', { 
        encoding: 'utf8',
        stdio: 'inherit'
      });
      
      return output;
      
    } catch (error) {
      throw new Error(`Load test failed: ${error}`);
    }
  }

  async analyzeResults() {
    console.log('📊 Analyzing load test results...');
    
    try {
      // Parse artillery report
      const report = execSync('artillery report --output json artillery-report.json', { 
        encoding: 'utf8'
      });
      
      // Check key metrics
      const metrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        responseTimeAvg: 0,
        responseTimeP95: 0,
        throughput: 0
      };
      
      // Extract metrics from report (simplified)
      console.log('📈 Load Test Results:');
      console.log(`Total Requests: ${metrics.totalRequests}`);
      console.log(`Success Rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`);
      console.log(`Avg Response Time: ${metrics.responseTimeAvg}ms`);
      console.log(`95th Percentile: ${metrics.responseTimeP95}ms`);
      console.log(`Throughput: ${metrics.throughput} req/s`);
      
      // Check if metrics meet requirements
      const requirements = {
        successRate: 99, // 99% success rate
        avgResponseTime: 500, // 500ms average
        p95ResponseTime: 1000, // 1000ms 95th percentile
        throughput: 50 // 50 req/s minimum
      };
      
      const passed = 
        ((metrics.successfulRequests / metrics.totalRequests) * 100) >= requirements.successRate &&
        metrics.responseTimeAvg <= requirements.avgResponseTime &&
        metrics.responseTimeP95 <= requirements.p95ResponseTime &&
        metrics.throughput >= requirements.throughput;
      
      if (passed) {
        console.log('✅ Load test requirements met');
      } else {
        console.log('❌ Load test requirements not met');
      }
      
      return passed;
      
    } catch (error) {
      throw new Error(`Results analysis failed: ${error}`);
    }
  }

  async checkSystemAfterLoad() {
    console.log('🔍 Checking system health after load test...');
    
    try {
      // Check for memory leaks
      const memoryAfter = execSync('free -m', { encoding: 'utf8' });
      const cpuAfter = execSync('top -bn1 | grep "Cpu(s)"', { encoding: 'utf8' });
      
      console.log('📊 System Resources After Load:');
      console.log(memoryAfter.split('\n')[1]);
      console.log(cpuAfter.trim());
      
      // Check for crashed services
      const services = [
        { name: 'App', url: 'http://localhost:3000/api/health' },
        { name: 'Chat', url: 'http://localhost:8080/health' },
        { name: 'LiveKit', url: 'http://localhost:7881/health' }
      ];
      
      let crashedServices = 0;
      
      for (const service of services) {
        try {
          execSync(`curl -f -s -o /dev/null ${service.url}`, { stdio: 'pipe' });
          console.log(`✅ ${service.name} still healthy`);
        } catch (error) {
          console.log(`❌ ${service.name} crashed or unresponsive`);
          crashedServices++;
        }
      }
      
      if (crashedServices > 0) {
        throw new Error(`${crashedServices} services crashed during load test`);
      }
      
      return true;
      
    } catch (error) {
      throw new Error(`Post-load check failed: ${error}`);
    }
  }

  async run() {
    let passed = 0;
    let failed = 0;
    
    try {
      console.log('⚡ Load Testing Verification\n');
      console.log('=====================================\n');
      
      // Test 1: Pre-load health check
      try {
        await this.checkSystemHealth();
        passed++;
        console.log('✅ System Health Check');
      } catch (error) {
        failed++;
        console.log(`❌ System Health Check: ${error}`);
      }
      
      // Test 2: Load test execution
      try {
        await this.runLoadTest();
        passed++;
        console.log('✅ Load Test Execution');
      } catch (error) {
        failed++;
        console.log(`❌ Load Test Execution: ${error}`);
      }
      
      // Test 3: Results analysis
      try {
        const resultsPassed = await this.analyzeResults();
        if (resultsPassed) {
          passed++;
          console.log('✅ Results Analysis');
        } else {
          failed++;
          console.log('❌ Results Analysis: Requirements not met');
        }
      } catch (error) {
        failed++;
        console.log(`❌ Results Analysis: ${error}`);
      }
      
      // Test 4: Post-load health check
      try {
        await this.checkSystemAfterLoad();
        passed++;
        console.log('✅ Post-load Health Check');
      } catch (error) {
        failed++;
        console.log(`❌ Post-load Health Check: ${error}`);
      }
      
    } catch (error) {
      failed++;
      console.log(`❌ Load testing verification failed: ${error}`);
    }
    
    console.log('\n=====================================');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed > 0) {
      process.exit(1);
    } else {
      console.log('\n🎉 Load testing verification passed!');
      process.exit(0);
    }
  }
}

// Run verification
const verifier = new LoadTestVerifier();
verifier.run().catch(console.error);

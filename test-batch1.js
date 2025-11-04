#!/usr/bin/env node

/**
 * Batch 1 Testing Script
 * Tests core infrastructure features using Node.js built-in modules
 */

const http = require('http');
const url = require('url');

const BASE_URL = 'http://localhost:3001';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(`${BASE_URL}${path}`);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        } catch (error) {
          console.log(`   JSON Parse Error: ${error.message}`);
          console.log(`   Raw data: ${data.substring(0, 100)}...`);
          resolve({
            status: res.statusCode,
            data: data,
            success: false,
            error: 'Invalid JSON response'
          });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`   HTTP Request Error: ${error.message}`);
      reject(error);
    });

    req.setTimeout(5000, () => {
      console.log(`   Request timeout for ${path}`);
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function testEndpoint(name, path, expectedKeys = []) {
  try {
    console.log(`\n🧪 Testing ${name}...`);
    const result = await makeRequest(path);
    
    if (result.success) {
      console.log(`✅ ${name} - Status: ${result.status}`);
      console.log(`   Response keys: ${Object.keys(result.data).join(', ')}`);
      
      // Check for expected keys
      if (expectedKeys.length > 0) {
        const missingKeys = expectedKeys.filter(key => !(key in result.data));
        if (missingKeys.length === 0) {
          console.log(`   ✅ All expected keys present: ${expectedKeys.join(', ')}`);
        } else {
          console.log(`   ⚠️  Missing keys: ${missingKeys.join(', ')}`);
        }
      }
      
      return { success: true, data: result.data };
    } else {
      console.log(`❌ ${name} - Status: ${result.status}`);
      console.log(`   Error: ${result.data.error?.message || result.error || 'Unknown error'}`);
      return { success: false, error: result.data };
    }
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runBatch1Tests() {
  console.log('🚀 Starting Batch 1 Infrastructure Tests...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  // Test 1: Health Endpoints
  const healthTest = await testEndpoint(
    'Health Check',
    '/healthz',
    ['status', 'timestamp', 'uptime', 'version']
  );
  results.total++;
  if (healthTest.success) results.passed++; else results.failed++;

  const readyTest = await testEndpoint(
    'Readiness Check',
    '/readyz',
    ['status', 'timestamp', 'checks']
  );
  results.total++;
  if (readyTest.success) results.passed++; else results.failed++;

  // Test 2: Admin System
  const adminTest = await testEndpoint(
    'Admin System',
    '/v1/admin/system',
    ['ok', 'data']
  );
  results.total++;
  if (adminTest.success) results.passed++; else results.failed++;

  // Test 3: SSE Events (Batch 1.2)
  const eventsTest = await testEndpoint(
    'SSE Events Stats',
    '/v1/events/stats',
    ['ok', 'data']
  );
  results.total++;
  if (eventsTest.success) results.passed++; else results.failed++;

  // Test 4: Queue Management (Batch 1.3)
  const queueTest = await testEndpoint(
    'Queue Health',
    '/v1/admin/queues/health',
    ['ok', 'data']
  );
  results.total++;
  if (queueTest.success) results.passed++; else results.failed++;

  // Test 5: Workspace Management (Batch 1.1)
  const membersTest = await testEndpoint(
    'Workspace Members',
    '/v1/workspaces/test-workspace/members',
    ['ok', 'data']
  );
  results.total++;
  if (membersTest.success) results.passed++; else results.failed++;

  // Test 6: Rate Limiting (Batch 1.1)
  const rateLimitTest = await testEndpoint(
    'Rate Limiting',
    '/v1/test/rate-limit',
    ['ok', 'data']
  );
  results.total++;
  if (rateLimitTest.success) results.passed++; else results.failed++;

  // Test Summary
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Total: ${results.total}`);
  console.log(`🎯 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);

  // Feature-specific results
  console.log('\n🏗️  Batch 1 Feature Tests:');
  console.log('📡 Core API Infrastructure:', healthTest.success && readyTest.success ? '✅ PASSED' : '❌ FAILED');
  console.log('🔧 Admin System:', adminTest.success ? '✅ PASSED' : '❌ FAILED');
  console.log('👥 Multi-tenant Management:', membersTest.success ? '✅ PASSED' : '❌ FAILED');
  console.log('🚦 Rate Limiting:', rateLimitTest.success ? '✅ PASSED' : '❌ FAILED');
  console.log('📡 SSE Infrastructure:', eventsTest.success ? '✅ PASSED' : '❌ FAILED');
  console.log('⚙️  Queue Management:', queueTest.success ? '✅ PASSED' : '❌ FAILED');

  if (results.failed === 0) {
    console.log('\n🎉 All Batch 1 tests passed! Ready for Batch 2 development.');
  } else {
    console.log('\n⚠️  Some tests failed. Review issues before proceeding to Batch 2.');
  }

  return results;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runBatch1Tests().catch(console.error);
}

module.exports = { runBatch1Tests };

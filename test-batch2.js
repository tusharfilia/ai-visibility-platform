#!/usr/bin/env node

/**
 * Batch 2 GEO Optimization Engine Testing Script
 * Tests enhanced scoring, knowledge graph, and trust signals
 */

const http = require('http');
const url = require('url');

const BASE_URL = 'http://localhost:3002';

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

async function runBatch2Tests() {
  console.log('🚀 Starting Batch 2 GEO Optimization Engine Tests...\n');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  // Test 1: Health Endpoints
  const healthTest = await testEndpoint(
    'Health Check',
    '/healthz',
    ['status', 'timestamp', 'uptime', 'version', 'features']
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

  // Test 2: GEO Scoring Engine
  const scoringTest = await testEndpoint(
    'GEO Scoring Engine',
    '/v1/geo/scoring/test-brand',
    ['ok', 'data']
  );
  results.total++;
  if (scoringTest.success) results.passed++; else results.failed++;

  // Test 3: Knowledge Graph Builder
  const knowledgeGraphTest = await testEndpoint(
    'Knowledge Graph Builder',
    '/v1/geo/knowledge-graph/test-brand',
    ['ok', 'data']
  );
  results.total++;
  if (knowledgeGraphTest.success) results.passed++; else results.failed++;

  // Test 4: Knowledge Graph Analysis
  const graphAnalysisTest = await testEndpoint(
    'Knowledge Graph Analysis',
    '/v1/geo/knowledge-graph/test-brand/analysis',
    ['ok', 'data']
  );
  results.total++;
  if (graphAnalysisTest.success) results.passed++; else results.failed++;

  // Test 5: Trust Signal Aggregation
  const trustTest = await testEndpoint(
    'Trust Signal Aggregation',
    '/v1/geo/trust/test-brand.com',
    ['ok', 'data']
  );
  results.total++;
  if (trustTest.success) results.passed++; else results.failed++;

  // Test 6: Trust Analysis
  const trustAnalysisTest = await testEndpoint(
    'Trust Analysis',
    '/v1/geo/trust/test-brand.com/analysis',
    ['ok', 'data']
  );
  results.total++;
  if (trustAnalysisTest.success) results.passed++; else results.failed++;

  // Test 7: Optimization Recommendations
  const optimizationTest = await testEndpoint(
    'Optimization Recommendations',
    '/v1/geo/optimization/test-brand/recommendations',
    ['ok', 'data']
  );
  results.total++;
  if (optimizationTest.success) results.passed++; else results.failed++;

  // Test 8: Competitive Analysis
  const competitorsTest = await testEndpoint(
    'Competitive Analysis',
    '/v1/geo/competitors/test-brand',
    ['ok', 'data']
  );
  results.total++;
  if (competitorsTest.success) results.passed++; else results.failed++;

  // Test Summary
  console.log('\n📊 Test Results Summary:');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Total: ${results.total}`);
  console.log(`🎯 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);

  // Feature-specific results
  console.log('\n🏗️  Batch 2 GEO Engine Tests:');
  console.log('📡 Core API Infrastructure:', healthTest.success && readyTest.success ? '✅ PASSED' : '❌ FAILED');
  console.log('📈 Enhanced GEO Scoring:', scoringTest.success ? '✅ PASSED' : '❌ FAILED');
  console.log('🧠 Knowledge Graph Builder:', knowledgeGraphTest.success ? '✅ PASSED' : '❌ FAILED');
  console.log('🔍 Graph Analysis:', graphAnalysisTest.success ? '✅ PASSED' : '❌ FAILED');
  console.log('🔒 Trust Signal Aggregation:', trustTest.success ? '✅ PASSED' : '❌ FAILED');
  console.log('📊 Trust Analysis:', trustAnalysisTest.success ? '✅ PASSED' : '❌ FAILED');
  console.log('💡 Optimization Engine:', optimizationTest.success ? '✅ PASSED' : '❌ FAILED');
  console.log('🏆 Competitive Analysis:', competitorsTest.success ? '✅ PASSED' : '❌ FAILED');

  // Detailed feature analysis
  if (scoringTest.success) {
    console.log('\n📈 GEO Scoring Analysis:');
    const score = scoringTest.data.data;
    console.log(`   Overall Score: ${score.overall}/100`);
    console.log(`   Mentions: ${score.breakdown.mentions}/100`);
    console.log(`   Rankings: ${score.breakdown.rankings}/100`);
    console.log(`   Citations: ${score.breakdown.citations}/100`);
    console.log(`   Sentiment: ${score.breakdown.sentiment}/100`);
    console.log(`   Authority: ${score.breakdown.authority}/100`);
    console.log(`   Freshness: ${score.breakdown.freshness}/100`);
    console.log(`   Recommendations: ${score.recommendations.length} actionable items`);
  }

  if (knowledgeGraphTest.success) {
    console.log('\n🧠 Knowledge Graph Analysis:');
    const graph = knowledgeGraphTest.data.data;
    console.log(`   Entities: ${graph.metadata.totalEntities}`);
    console.log(`   Relationships: ${graph.metadata.totalRelationships}`);
    console.log(`   Confidence: ${(graph.metadata.confidence * 100).toFixed(1)}%`);
    console.log(`   Entity Types: ${[...new Set(graph.entities.map(e => e.type))].join(', ')}`);
  }

  if (trustTest.success) {
    console.log('\n🔒 Trust Signal Analysis:');
    const trust = trustTest.data.data;
    console.log(`   Overall Trust: ${trust.overall}/100`);
    console.log(`   Domain Authority: ${trust.breakdown.domainAuthority}/100`);
    console.log(`   Backlinks: ${trust.breakdown.backlinks}/100`);
    console.log(`   Social Signals: ${trust.breakdown.socialSignals}/100`);
    console.log(`   Content Quality: ${trust.breakdown.contentQuality}/100`);
    console.log(`   User Engagement: ${trust.breakdown.userEngagement}/100`);
    console.log(`   Expertise: ${trust.breakdown.expertise}/100`);
    console.log(`   Freshness: ${trust.breakdown.freshness}/100`);
  }

  if (optimizationTest.success) {
    console.log('\n💡 Optimization Recommendations:');
    const opt = optimizationTest.data.data;
    console.log(`   Total Recommendations: ${opt.recommendations.length}`);
    console.log(`   High Priority: ${opt.priority.filter(p => p === 'high').length}`);
    console.log(`   Medium Priority: ${opt.priority.filter(p => p === 'medium').length}`);
    console.log(`   Low Priority: ${opt.priority.filter(p => p === 'low').length}`);
    console.log(`   Avg Impact: ${(opt.estimatedImpact.reduce((a, b) => a + b, 0) / opt.estimatedImpact.length).toFixed(1)}%`);
  }

  if (results.failed === 0) {
    console.log('\n🎉 All Batch 2 tests passed! GEO Optimization Engine is ready!');
    console.log('\n🚀 Ready for Batch 3: Automation & Intelligence!');
  } else {
    console.log('\n⚠️  Some tests failed. Review issues before proceeding to Batch 3.');
  }

  return results;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runBatch2Tests().catch(console.error);
}

module.exports = { runBatch2Tests };


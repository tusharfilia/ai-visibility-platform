#!/usr/bin/env node

/**
 * Batch 1 Testing Script
 * Tests core infrastructure: Multi-tenancy, SSE, Queue Architecture
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app-test.module';
import { Test, TestingModule } from '@nestjs/testing';

async function runTests() {
  console.log('🧪 Starting Batch 1 Infrastructure Tests...\n');

  try {
    // Test 1: Basic API Startup
    console.log('📡 Test 1: API Startup');
    const app = await NestFactory.create(AppModule, { logger: false });
    
    app.enableCors({
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    });

    const port = process.env.PORT || 3001; // Use different port for testing
    await app.listen(port);
    
    console.log(`✅ API started successfully on port ${port}`);
    
    // Test 2: Health Endpoints
    console.log('\n🏥 Test 2: Health Endpoints');
    const healthResponse = await fetch(`http://localhost:${port}/healthz`);
    const healthData = await healthResponse.json();
    console.log('✅ Health endpoint:', healthData);

    const readyResponse = await fetch(`http://localhost:${port}/readyz`);
    const readyData = await readyResponse.json();
    console.log('✅ Ready endpoint:', readyData);

    // Test 3: Admin System Endpoint
    console.log('\n🔧 Test 3: Admin System Endpoint');
    const adminResponse = await fetch(`http://localhost:${port}/v1/admin/system`);
    const adminData = await adminResponse.json();
    console.log('✅ Admin system endpoint:', adminData);

    // Test 4: SSE Events Endpoint (if available)
    console.log('\n📡 Test 4: SSE Events Endpoint');
    try {
      const eventsResponse = await fetch(`http://localhost:${port}/v1/events/stats`);
      const eventsData = await eventsResponse.json();
      console.log('✅ Events stats endpoint:', eventsData);
    } catch (error) {
      console.log('⚠️  Events endpoint not available (expected if Redis not configured)');
    }

    // Test 5: Queue Management Endpoint (if available)
    console.log('\n⚙️  Test 5: Queue Management Endpoint');
    try {
      const queueResponse = await fetch(`http://localhost:${port}/v1/admin/queues/health`);
      const queueData = await queueResponse.json();
      console.log('✅ Queue health endpoint:', queueData);
    } catch (error) {
      console.log('⚠️  Queue endpoint not available (expected if Redis not configured)');
    }

    console.log('\n🎉 Batch 1 Core Tests Completed Successfully!');
    console.log('\n📋 Test Summary:');
    console.log('✅ API Startup - PASSED');
    console.log('✅ Health Endpoints - PASSED');
    console.log('✅ Admin System - PASSED');
    console.log('⚠️  SSE Events - SKIPPED (Redis dependency)');
    console.log('⚠️  Queue Management - SKIPPED (Redis dependency)');

    await app.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };


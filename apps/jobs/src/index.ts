/**
 * AI Visibility Jobs Application
 * BullMQ workers and schedulers
 */

import { Redis } from 'ioredis';
import { prisma, connectDatabase, disconnectDatabase } from '@ai-visibility-platform/db';
import { RunPromptWorker } from './workers/run-prompt-worker';
import { RunBatchWorker } from './workers/run-batch-worker';
import { DailyAggregationsWorker } from './workers/daily-aggregations-worker';
import { CopilotPlannerWorker } from './workers/copilot-planner-worker';
import { jobScheduler } from './schedulers';
import { checkQueueHealth, getQueueMetrics, shutdownQueues } from './queues';

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Workers
let runPromptWorker: RunPromptWorker;
let runBatchWorker: RunBatchWorker;
let dailyAggregationsWorker: DailyAggregationsWorker;
let copilotPlannerWorker: CopilotPlannerWorker;

async function startWorkers(): Promise<void> {
  console.log('Starting workers...');
  
  // Initialize workers
  runPromptWorker = new RunPromptWorker(redis);
  runBatchWorker = new RunBatchWorker(redis);
  dailyAggregationsWorker = new DailyAggregationsWorker(redis);
  copilotPlannerWorker = new CopilotPlannerWorker(redis);
  
  console.log('Workers started successfully');
}

async function startSchedulers(): Promise<void> {
  console.log('Starting schedulers...');
  jobScheduler.start();
  console.log('Schedulers started successfully');
}

async function startHealthChecks(): Promise<void> {
  console.log('Starting health checks...');
  
  setInterval(async () => {
    try {
      const health = await checkQueueHealth();
      const metrics = await getQueueMetrics();
      
      console.log('Health check:', health);
      console.log('Queue metrics:', metrics);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }, 60000); // Every minute
  
  console.log('Health checks started');
}

async function startApplication(): Promise<void> {
  try {
    console.log('Starting AI Visibility Jobs Application...');
    
    // Connect to database
    await connectDatabase();
    
    // Start workers
    await startWorkers();
    
    // Start schedulers
    await startSchedulers();
    
    // Start health checks
    await startHealthChecks();
    
    console.log('AI Visibility Jobs Application started successfully');
    
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

async function shutdownApplication(): Promise<void> {
  console.log('Shutting down application...');
  
  try {
    // Stop schedulers
    jobScheduler.stop();
    
    // Close workers
    await runPromptWorker?.close();
    await runBatchWorker?.close();
    await dailyAggregationsWorker?.close();
    await copilotPlannerWorker?.close();
    
    // Shutdown queues
    await shutdownQueues();
    
    // Disconnect from database
    await disconnectDatabase();
    
    console.log('Application shut down successfully');
    
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
}

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  await shutdownApplication();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdownApplication();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await shutdownApplication();
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  await shutdownApplication();
  process.exit(1);
});

// Start the application
startApplication();

/**
 * AI Visibility Jobs Application
 * BullMQ workers and schedulers
 */

// Database connection will be handled by individual workers
import { RunPromptWorker } from './workers/run-prompt-worker';
import { RunBatchWorker } from './workers/run-batch-worker';
import { DailyAggregationsWorker } from './workers/daily-aggregations-worker';
import { CopilotPlannerWorker } from './workers/copilot-planner-worker';
import { EvidenceGraphWorker } from './workers/evidence-graph-worker';
import { MaturityRecomputeWorker } from './workers/maturity-recompute-worker';
import { RecommendationRefreshWorker } from './workers/recommendation-refresh-worker';
import { jobScheduler } from './schedulers';
import { checkQueueHealth, getQueueMetrics, shutdownQueues } from './queues';
import { createRedisClient } from '@ai-visibility/shared';

// Redis connection
const redis = createRedisClient('jobs:index');

// Workers
let runPromptWorker: RunPromptWorker;
let runBatchWorker: RunBatchWorker;
let dailyAggregationsWorker: DailyAggregationsWorker;
let copilotPlannerWorker: CopilotPlannerWorker;
let evidenceGraphWorker: EvidenceGraphWorker;
let maturityRecomputeWorker: MaturityRecomputeWorker;
let recommendationRefreshWorker: RecommendationRefreshWorker;

async function startWorkers(): Promise<void> {
  console.log('Starting workers...');
  
  // Initialize workers
  runPromptWorker = new RunPromptWorker(redis);
  runBatchWorker = new RunBatchWorker(redis);
  dailyAggregationsWorker = new DailyAggregationsWorker(redis);
  copilotPlannerWorker = new CopilotPlannerWorker(redis);
  evidenceGraphWorker = new EvidenceGraphWorker(redis);
  maturityRecomputeWorker = new MaturityRecomputeWorker(redis);
  recommendationRefreshWorker = new RecommendationRefreshWorker(redis);
  
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
    
  // Database connections will be handled by individual workers
    
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
    await evidenceGraphWorker?.close();
    await maturityRecomputeWorker?.close();
    await recommendationRefreshWorker?.close();
    
    // Shutdown queues
    await shutdownQueues();
    
    // Database connections are handled by individual workers
    
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

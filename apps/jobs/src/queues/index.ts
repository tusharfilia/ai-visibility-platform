/**
 * BullMQ queue definitions
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { createRedisClient } from '@ai-visibility/shared';
// Database operations will be handled by individual workers

// Redis connection for BullMQ
// BullMQ requires maxRetriesPerRequest: null for blocking commands (BLPOP, BRPOP)
const redis = createRedisClient('queues:index', { maxRetriesPerRequest: null });

// Queue definitions
export const runPromptQueue = new Queue('runPrompt', { connection: redis });
export const runBatchQueue = new Queue('runBatch', { connection: redis });
export const dailyAggregationsQueue = new Queue('dailyAggregations', { connection: redis });
export const copilotPlannerQueue = new Queue('copilotPlanner', { connection: redis });
export const evidenceGraphQueue = new Queue('evidenceGraph', { connection: redis });
export const maturityRecomputeQueue = new Queue('maturityRecompute', { connection: redis });
export const recommendationRefreshQueue = new Queue('recommendationRefresh', { connection: redis });

// Queue events
export const runPromptEvents = new QueueEvents('runPrompt', { connection: redis });
export const runBatchEvents = new QueueEvents('runBatch', { connection: redis });
export const dailyAggregationsEvents = new QueueEvents('dailyAggregations', { connection: redis });
export const copilotPlannerEvents = new QueueEvents('copilotPlanner', { connection: redis });

// Queue payload types
export interface RunPromptPayload {
  workspaceId: string;
  promptId: string;
  engineKey: string;
  idempotencyKey: string;
  demoRunId?: string;
  userId?: string;
}

export interface RunBatchPayload {
  workspaceId: string;
  promptIds: string[];
  engineKeys: string[];
  budgetCents: number;
  userId?: string;
}

export interface DailyAggregationsPayload {
  workspaceId: string;
  date: string;
}

export interface CopilotPlannerPayload {
  workspaceId: string;
  userId?: string;
}

// Queue health check
export async function checkQueueHealth(): Promise<{ [key: string]: boolean }> {
  const queues = [
    { name: 'runPrompt', queue: runPromptQueue },
    { name: 'runBatch', queue: runBatchQueue },
    { name: 'dailyAggregations', queue: dailyAggregationsQueue },
    { name: 'copilotPlanner', queue: copilotPlannerQueue },
  ];

  const health: { [key: string]: boolean } = {};

  for (const { name, queue } of queues) {
    try {
      await queue.getWaiting();
      health[name] = true;
    } catch (error) {
      console.error(`Queue ${name} health check failed:`, error);
      health[name] = false;
    }
  }

  return health;
}

// Queue metrics
export async function getQueueMetrics(): Promise<{ [key: string]: any }> {
  const queues = [
    { name: 'runPrompt', queue: runPromptQueue },
    { name: 'runBatch', queue: runBatchQueue },
    { name: 'dailyAggregations', queue: dailyAggregationsQueue },
    { name: 'copilotPlanner', queue: copilotPlannerQueue },
  ];

  const metrics: { [key: string]: any } = {};

  for (const { name, queue } of queues) {
    try {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();

      metrics[name] = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      };
    } catch (error) {
      console.error(`Failed to get metrics for queue ${name}:`, error);
      metrics[name] = { error: error.message };
    }
  }

  return metrics;
}

// Graceful shutdown
export async function shutdownQueues(): Promise<void> {
  console.log('Shutting down queues...');
  
  await Promise.all([
    runPromptQueue.close(),
    runBatchQueue.close(),
    dailyAggregationsQueue.close(),
    copilotPlannerQueue.close(),
  ]);
  
  await redis.quit();
  console.log('Queues shut down successfully');
}

// Process handlers
process.on('SIGINT', async () => {
  await shutdownQueues();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdownQueues();
  process.exit(0);
});

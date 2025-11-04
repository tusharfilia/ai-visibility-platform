/**
 * Base class for idempotent BullMQ workers
 * Provides idempotency support for job processing
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { IdempotencyManager, IdempotencyKeyGenerator } from '@ai-visibility/shared';

export interface IdempotentJobData {
  idempotencyKey: string;
  workspaceId: string;
  [key: string]: any;
}

export abstract class IdempotentWorker<T = any> {
  protected worker: Worker;
  protected redis: Redis;
  protected idempotencyManager: IdempotencyManager;

  constructor(
    queueName: string,
    connection: Redis,
    options: {
      concurrency?: number;
      removeOnComplete?: number;
      removeOnFail?: number;
    } = {}
  ) {
    this.redis = connection;
    this.idempotencyManager = new IdempotencyManager(connection);
    
    this.worker = new Worker(
      queueName,
      this.processJob.bind(this),
      {
        connection,
        concurrency: options.concurrency || 5,
        removeOnComplete: options.removeOnComplete || 100,
        removeOnFail: options.removeOnFail || 50,
      }
    );

    this.setupEventHandlers();
  }

  /**
   * Process job with idempotency check
   */
  private async processJob(job: Job<T & IdempotentJobData>): Promise<any> {
    const { idempotencyKey, workspaceId } = job.data;
    
    if (!idempotencyKey) {
      throw new Error('Idempotency key required');
    }

    // Check if job was already processed
    const cacheKey = `job:${workspaceId}:${idempotencyKey}`;
    const check = await this.idempotencyManager.checkIdempotency(cacheKey);
    
    if (check.isDuplicate) {
      console.log(`Job ${job.id} already processed (idempotency key: ${idempotencyKey})`);
      return check.result;
    }

    try {
      // Process the job
      const result = await this.executeJob(job);
      
      // Store result for idempotency
      await this.idempotencyManager.storeResult(cacheKey, result, 86400); // 24 hour TTL
      
      return result;
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Abstract method to be implemented by subclasses
   */
  protected abstract executeJob(job: Job<T & IdempotentJobData>): Promise<any>;

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Worker error:', err);
    });
  }

  /**
   * Close worker
   */
  async close(): Promise<void> {
    await this.worker.close();
  }

  /**
   * Generate idempotency key for job
   */
  protected generateIdempotencyKey(jobType: string, content: string, workspaceId: string): string {
    return IdempotencyKeyGenerator.generateForContent(content, `${jobType}:${workspaceId}`);
  }

  /**
   * Check if job should be deduplicated
   */
  protected async shouldDeduplicateJob(jobType: string, content: string, workspaceId: string): Promise<boolean> {
    const key = this.generateIdempotencyKey(jobType, content, workspaceId);
    const check = await this.idempotencyManager.checkIdempotency(key);
    return check.isDuplicate;
  }

  /**
   * Get job metrics
   */
  async getMetrics(): Promise<any> {
    return {
      waiting: await this.worker.getWaiting(),
      active: await this.worker.getActive(),
      completed: await this.worker.getCompleted(),
      failed: await this.worker.getFailed(),
    };
  }
}

/**
 * Utility for creating idempotent job data
 */
export function createIdempotentJobData(
  workspaceId: string,
  jobType: string,
  content: string,
  additionalData: any = {}
): IdempotentJobData {
  const idempotencyKey = IdempotencyKeyGenerator.generateForContent(content, `${jobType}:${workspaceId}`);
  
  return {
    idempotencyKey,
    workspaceId,
    jobType,
    ...additionalData
  };
}



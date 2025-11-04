import { Injectable } from '@nestjs/common';
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  processingRate: number;
  avgProcessingTime: number;
  errorRate: number;
}

export interface JobDependency {
  jobId: string;
  dependsOn: string[];
  status: 'pending' | 'waiting' | 'ready' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
}

@Injectable()
export class EnhancedQueueService {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private redis: Redis;
  private metricsCache: Map<string, QueueMetrics> = new Map();
  private dependencies: Map<string, JobDependency> = new Map();

  constructor(private configService: ConfigService) {
    this.redis = new Redis(this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379');
  }

  /**
   * Create enhanced queue with monitoring
   */
  async createQueue(
    name: string,
    options: {
      priority?: number;
      retryConfig?: RetryConfig;
      concurrency?: number;
      enableMetrics?: boolean;
    } = {}
  ): Promise<Queue> {
    const queue = new Queue(name, {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: options.retryConfig?.maxAttempts || 3,
        backoff: {
          type: 'exponential',
          delay: options.retryConfig?.backoffDelay || 2000,
        },
        priority: options.priority || 0,
      },
    });

    // Set up queue events for monitoring
    const queueEvents = new QueueEvents(name, { connection: this.redis });
    this.setupQueueEvents(queueEvents, name);

    this.queues.set(name, queue);
    this.queueEvents.set(name, queueEvents);

    // Initialize metrics
    if (options.enableMetrics !== false) {
      await this.updateQueueMetrics(name);
    }

    console.log(`Enhanced queue created: ${name}`);
    return queue;
  }

  /**
   * Create enhanced worker with retry logic
   */
  async createWorker(
    queueName: string,
    processor: (job: Job) => Promise<any>,
    options: {
      concurrency?: number;
      retryConfig?: RetryConfig;
      enableMetrics?: boolean;
    } = {}
  ): Promise<Worker> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const worker = new Worker(
      queueName,
      async (job: Job) => {
        try {
          // Check job dependencies
          await this.checkJobDependencies(job.id as string);
          
          // Process job
          const result = await processor(job);
          
          // Update dependency status
          await this.updateJobDependency(job.id as string, 'completed');
          
          return result;
        } catch (error) {
          // Update dependency status
          await this.updateJobDependency(job.id as string, 'failed');
          throw error;
        }
      },
      {
        connection: this.redis,
        concurrency: options.concurrency || 1,
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );

    // Set up worker events
    this.setupWorkerEvents(worker, queueName);

    this.workers.set(queueName, worker);

    console.log(`Enhanced worker created for queue: ${queueName}`);
    return worker;
  }

  /**
   * Add job with dependency management
   */
  async addJob(
    queueName: string,
    jobName: string,
    data: any,
    options: {
      priority?: number;
      delay?: number;
      dependsOn?: string[];
      retryConfig?: RetryConfig;
    } = {}
  ): Promise<Job> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    // Create job dependency record
    const dependency: JobDependency = {
      jobId: '', // Will be set after job creation
      dependsOn: options.dependsOn || [],
      status: options.dependsOn?.length ? 'waiting' : 'ready',
      createdAt: new Date(),
    };

    // Add job to queue
    const job = await queue.add(jobName, data, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      attempts: options.retryConfig?.maxAttempts || 3,
      backoff: {
        type: 'exponential',
        delay: options.retryConfig?.backoffDelay || 2000,
      },
    });

    // Update dependency with job ID
    dependency.jobId = job.id as string;
    this.dependencies.set(job.id as string, dependency);

    // Check if job is ready to run
    if (dependency.status === 'ready') {
      await this.updateJobDependency(job.id as string, 'ready');
    }

    console.log(`Job added to queue ${queueName}: ${job.id}`);
    return job;
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
    const cached = this.metricsCache.get(queueName);
    if (cached) {
      return cached;
    }

    return await this.updateQueueMetrics(queueName);
  }

  /**
   * Get all queue metrics
   */
  async getAllQueueMetrics(): Promise<QueueMetrics[]> {
    const metrics: QueueMetrics[] = [];
    
    for (const queueName of this.queues.keys()) {
      const queueMetrics = await this.getQueueMetrics(queueName);
      metrics.push(queueMetrics);
    }

    return metrics;
  }

  /**
   * Get job dependencies
   */
  getJobDependencies(jobId: string): JobDependency | undefined {
    return this.dependencies.get(jobId);
  }

  /**
   * Get jobs waiting for dependencies
   */
  getWaitingJobs(): JobDependency[] {
    return Array.from(this.dependencies.values()).filter(
      dep => dep.status === 'waiting'
    );
  }

  /**
   * Retry failed job
   */
  async retryJob(queueName: string, jobId: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    console.log(`Job ${jobId} retried in queue ${queueName}`);
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    console.log(`Queue ${queueName} paused`);
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    console.log(`Queue ${queueName} resumed`);
  }

  /**
   * Clean old jobs
   */
  async cleanQueue(queueName: string, grace: number = 60000): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.clean(grace, 100, 'completed');
    await queue.clean(grace, 50, 'failed');
    console.log(`Queue ${queueName} cleaned`);
  }

  /**
   * Update queue metrics
   */
  private async updateQueueMetrics(queueName: string): Promise<QueueMetrics> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
      queue.isPaused(),
    ]);

    const metrics: QueueMetrics = {
      queueName,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused,
      processingRate: 0, // Will be calculated over time
      avgProcessingTime: 0, // Will be calculated over time
      errorRate: failed.length / (completed.length + failed.length) || 0,
    };

    this.metricsCache.set(queueName, metrics);
    return metrics;
  }

  /**
   * Setup queue events for monitoring
   */
  private setupQueueEvents(queueEvents: QueueEvents, queueName: string): void {
    queueEvents.on('completed', async (jobId) => {
      console.log(`Job ${jobId} completed in queue ${queueName}`);
      await this.updateQueueMetrics(queueName);
    });

    queueEvents.on('failed', async (jobId, error) => {
      console.log(`Job ${jobId} failed in queue ${queueName}:`, error.message);
      await this.updateQueueMetrics(queueName);
    });

    queueEvents.on('stalled', async (jobId) => {
      console.log(`Job ${jobId} stalled in queue ${queueName}`);
      await this.updateQueueMetrics(queueName);
    });
  }

  /**
   * Setup worker events
   */
  private setupWorkerEvents(worker: Worker, queueName: string): void {
    worker.on('completed', async (job) => {
      console.log(`Worker completed job ${job.id} in queue ${queueName}`);
      await this.updateQueueMetrics(queueName);
    });

    worker.on('failed', async (job, error) => {
      console.log(`Worker failed job ${job?.id} in queue ${queueName}:`, error.message);
      await this.updateQueueMetrics(queueName);
    });

    worker.on('error', (error) => {
      console.error(`Worker error in queue ${queueName}:`, error);
    });
  }

  /**
   * Check job dependencies
   */
  private async checkJobDependencies(jobId: string): Promise<void> {
    const dependency = this.dependencies.get(jobId);
    if (!dependency || dependency.dependsOn.length === 0) {
      return;
    }

    // Check if all dependencies are completed
    const allCompleted = dependency.dependsOn.every(depId => {
      const dep = this.dependencies.get(depId);
      return dep?.status === 'completed';
    });

    if (!allCompleted) {
      throw new Error(`Job ${jobId} dependencies not met`);
    }
  }

  /**
   * Update job dependency status
   */
  private async updateJobDependency(jobId: string, status: JobDependency['status']): Promise<void> {
    const dependency = this.dependencies.get(jobId);
    if (!dependency) return;

    dependency.status = status;
    
    if (status === 'running') {
      dependency.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      dependency.completedAt = new Date();
    }

    this.dependencies.set(jobId, dependency);

    // Check if any waiting jobs are now ready
    if (status === 'completed') {
      await this.checkWaitingJobs();
    }
  }

  /**
   * Check waiting jobs and promote ready ones
   */
  private async checkWaitingJobs(): Promise<void> {
    const waitingJobs = this.getWaitingJobs();
    
    for (const waitingJob of waitingJobs) {
      const allCompleted = waitingJob.dependsOn.every(depId => {
        const dep = this.dependencies.get(depId);
        return dep?.status === 'completed';
      });

      if (allCompleted) {
        await this.updateJobDependency(waitingJob.jobId, 'ready');
        console.log(`Job ${waitingJob.jobId} is now ready to run`);
      }
    }
  }

  /**
   * Close all queues and workers
   */
  async close(): Promise<void> {
    // Close all workers
    for (const worker of this.workers.values()) {
      await worker.close();
    }

    // Close all queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }

    // Close all queue events
    for (const queueEvents of this.queueEvents.values()) {
      await queueEvents.close();
    }

    await this.redis.quit();
    console.log('Enhanced queue service closed');
  }
}


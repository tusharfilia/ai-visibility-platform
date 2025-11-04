import { Injectable } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { EnhancedQueueService } from './enhanced-queue.service';
import { JobRetryService } from './job-retry.service';
import { JobDeduplicationService } from './job-deduplication.service';
import { QueueMonitoringService } from './queue-monitoring.service';

export interface EnhancedWorkerConfig {
  queueName: string;
  concurrency: number;
  enableRetry: boolean;
  enableDeduplication: boolean;
  enableMonitoring: boolean;
  retryConfig?: {
    maxAttempts: number;
    backoffDelay: number;
    backoffMultiplier: number;
    maxDelay: number;
  };
}

export interface WorkerMetrics {
  workerId: string;
  queueName: string;
  isRunning: boolean;
  concurrency: number;
  activeJobs: number;
  processedJobs: number;
  failedJobs: number;
  avgProcessingTime: number;
  uptime: number;
  lastActivity: Date;
}

@Injectable()
export class EnhancedWorkerBase {
  private workers: Map<string, Worker> = new Map();
  private metrics: Map<string, WorkerMetrics> = new Map();
  private startTimes: Map<string, Date> = new Map();

  constructor(
    private enhancedQueue: EnhancedQueueService,
    private retryService: JobRetryService,
    private deduplicationService: JobDeduplicationService,
    private monitoringService: QueueMonitoringService
  ) {}

  /**
   * Create enhanced worker
   */
  async createWorker(
    config: EnhancedWorkerConfig,
    processor: (job: Job) => Promise<any>
  ): Promise<Worker> {
    const { queueName, concurrency, enableRetry, enableDeduplication, enableMonitoring } = config;

    // Create enhanced queue if it doesn't exist
    if (!this.enhancedQueue['queues'].has(queueName)) {
      await this.enhancedQueue.createQueue(queueName, {
        concurrency,
        enableMetrics: enableMonitoring,
        retryConfig: config.retryConfig
      });
    }

    // Create enhanced worker
    const worker = await this.enhancedQueue.createWorker(queueName, async (job: Job) => {
      return await this.processJobWithEnhancements(job, processor, {
        enableRetry,
        enableDeduplication,
        enableMonitoring
      });
    }, {
      concurrency,
      enableMetrics: enableMonitoring
    });

    // Register with monitoring service
    if (enableMonitoring) {
      this.monitoringService.registerQueue(this.enhancedQueue['queues'].get(queueName)!);
    }

    // Initialize metrics
    const workerId = `${queueName}-${Date.now()}`;
    this.startTimes.set(workerId, new Date());
    this.metrics.set(workerId, {
      workerId,
      queueName,
      isRunning: true,
      concurrency,
      activeJobs: 0,
      processedJobs: 0,
      failedJobs: 0,
      avgProcessingTime: 0,
      uptime: 0,
      lastActivity: new Date()
    });

    this.workers.set(workerId, worker);

    // Set up worker event handlers
    this.setupWorkerEventHandlers(worker, workerId);

    console.log(`Enhanced worker created: ${workerId} for queue ${queueName}`);
    return worker;
  }

  /**
   * Process job with all enhancements
   */
  private async processJobWithEnhancements(
    job: Job,
    processor: (job: Job) => Promise<any>,
    options: {
      enableRetry: boolean;
      enableDeduplication: boolean;
      enableMonitoring: boolean;
    }
  ): Promise<any> {
    const startTime = Date.now();
    const workerId = this.findWorkerIdByJob(job);

    try {
      let result: any;

      if (options.enableDeduplication) {
        // Process with deduplication and caching
        const deduplicationResult = await this.deduplicationService.processJobWithDeduplication(
          job.name,
          job.data,
          async () => {
            if (options.enableRetry) {
              // Process with retry logic
              const retryResult = await this.retryService.executeWithRetry(
                job,
                async (context) => {
                  return await processor(job);
                }
              );
              return retryResult.data;
            } else {
              // Process without retry
              return await processor(job);
            }
          }
        );

        result = deduplicationResult.result;

        if (deduplicationResult.fromCache) {
          console.log(`Job ${job.id} result served from cache`);
        }
      } else {
        // Process without deduplication
        if (options.enableRetry) {
          const retryResult = await this.retryService.executeWithRetry(
            job,
            async (context) => {
              return await processor(job);
            }
          );
          result = retryResult.data;
        } else {
          result = await processor(job);
        }
      }

      // Update metrics
      if (workerId) {
        await this.updateWorkerMetrics(workerId, 'success', Date.now() - startTime);
      }

      return result;

    } catch (error) {
      // Update metrics
      if (workerId) {
        await this.updateWorkerMetrics(workerId, 'failed', Date.now() - startTime);
      }

      console.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Setup worker event handlers
   */
  private setupWorkerEventHandlers(worker: Worker, workerId: string): void {
    worker.on('active', (job) => {
      console.log(`Worker ${workerId} started job ${job.id}`);
      this.updateWorkerMetrics(workerId, 'active');
    });

    worker.on('completed', (job) => {
      console.log(`Worker ${workerId} completed job ${job.id}`);
    });

    worker.on('failed', (job, error) => {
      console.log(`Worker ${workerId} failed job ${job?.id}:`, error.message);
    });

    worker.on('error', (error) => {
      console.error(`Worker ${workerId} error:`, error);
    });

    worker.on('stalled', (jobId) => {
      console.log(`Worker ${workerId} stalled job ${jobId}`);
    });
  }

  /**
   * Update worker metrics
   */
  private async updateWorkerMetrics(
    workerId: string,
    event: 'active' | 'success' | 'failed',
    processingTime?: number
  ): Promise<void> {
    const metrics = this.metrics.get(workerId);
    if (!metrics) return;

    const now = new Date();
    metrics.lastActivity = now;

    switch (event) {
      case 'active':
        metrics.activeJobs++;
        break;
      case 'success':
        metrics.activeJobs = Math.max(0, metrics.activeJobs - 1);
        metrics.processedJobs++;
        if (processingTime) {
          metrics.avgProcessingTime = 
            (metrics.avgProcessingTime * (metrics.processedJobs - 1) + processingTime) / 
            metrics.processedJobs;
        }
        break;
      case 'failed':
        metrics.activeJobs = Math.max(0, metrics.activeJobs - 1);
        metrics.failedJobs++;
        break;
    }

    metrics.uptime = now.getTime() - this.startTimes.get(workerId)!.getTime();
    this.metrics.set(workerId, metrics);
  }

  /**
   * Find worker ID by job
   */
  private findWorkerIdByJob(job: Job): string | undefined {
    for (const [workerId, worker] of this.workers.entries()) {
      if (worker.name === job.queueName) {
        return workerId;
      }
    }
    return undefined;
  }

  /**
   * Get worker metrics
   */
  getWorkerMetrics(workerId: string): WorkerMetrics | undefined {
    return this.metrics.get(workerId);
  }

  /**
   * Get all worker metrics
   */
  getAllWorkerMetrics(): WorkerMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(queueName: string) {
    return await this.enhancedQueue.getQueueMetrics(queueName);
  }

  /**
   * Get all queue metrics
   */
  async getAllQueueMetrics() {
    return await this.enhancedQueue.getAllQueueMetrics();
  }

  /**
   * Get queue health
   */
  async getQueueHealth(queueName: string) {
    return await this.monitoringService.getQueueHealth(queueName);
  }

  /**
   * Get all queue health
   */
  async getAllQueueHealth() {
    return await this.monitoringService.getAllQueueHealth();
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return this.monitoringService.getActiveAlerts();
  }

  /**
   * Get monitoring dashboard data
   */
  async getDashboardData() {
    return await this.monitoringService.getDashboardData();
  }

  /**
   * Pause worker
   */
  async pauseWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) {
      await worker.pause();
      const metrics = this.metrics.get(workerId);
      if (metrics) {
        metrics.isRunning = false;
        this.metrics.set(workerId, metrics);
      }
      console.log(`Worker ${workerId} paused`);
    }
  }

  /**
   * Resume worker
   */
  async resumeWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) {
      await worker.resume();
      const metrics = this.metrics.get(workerId);
      if (metrics) {
        metrics.isRunning = true;
        this.metrics.set(workerId, metrics);
      }
      console.log(`Worker ${workerId} resumed`);
    }
  }

  /**
   * Close worker
   */
  async closeWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) {
      await worker.close();
      this.workers.delete(workerId);
      this.metrics.delete(workerId);
      this.startTimes.delete(workerId);
      console.log(`Worker ${workerId} closed`);
    }
  }

  /**
   * Close all workers
   */
  async closeAllWorkers(): Promise<void> {
    for (const workerId of this.workers.keys()) {
      await this.closeWorker(workerId);
    }
    console.log('All enhanced workers closed');
  }
}


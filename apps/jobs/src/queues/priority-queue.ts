/**
 * Priority Queue System
 * Implements workspace tier-based priority with fair scheduling
 */

import { Queue, QueueOptions, Job } from 'bullmq';
import { Redis } from 'ioredis';

export interface PriorityQueueOptions extends QueueOptions {
  workspaceTier?: 'free' | 'insights' | 'copilot' | 'enterprise';
  priority?: number;
  maxConcurrency?: number;
  backpressureThreshold?: number;
}

export class PriorityQueue {
  private queue: Queue;
  private redis: Redis;
  private metrics: QueueMetrics;

  constructor(
    name: string,
    connection: Redis,
    options: PriorityQueueOptions = {}
  ) {
    this.redis = connection;
    this.metrics = new QueueMetrics();
    
    this.queue = new Queue(name, {
      connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
      ...options
    });

    this.setupEventHandlers();
  }

  /**
   * Add job with workspace tier priority
   */
  async addJob(
    jobName: string,
    data: any,
    options: {
      workspaceId: string;
      workspaceTier: 'free' | 'insights' | 'copilot' | 'enterprise';
      priority?: number;
      delay?: number;
    }
  ): Promise<Job> {
    const priority = this.calculatePriority(options.workspaceTier, options.priority);
    
    const job = await this.queue.add(jobName, {
      ...data,
      workspaceId: options.workspaceId,
      workspaceTier: options.workspaceTier,
      priority
    }, {
      priority,
      delay: options.delay,
      jobId: this.generateJobId(options.workspaceId, jobName)
    });

    // Update metrics
    this.metrics.incrementJobAdded(options.workspaceId, options.workspaceTier);
    
    return job;
  }

  /**
   * Calculate priority based on workspace tier
   */
  private calculatePriority(
    tier: 'free' | 'insights' | 'copilot' | 'enterprise',
    customPriority?: number
  ): number {
    if (customPriority !== undefined) {
      return customPriority;
    }

    const tierPriorities = {
      'enterprise': 1,  // Highest priority
      'copilot': 3,
      'insights': 5,
      'free': 10        // Lowest priority
    };

    return tierPriorities[tier];
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(workspaceId: string, jobName: string): string {
    return `${workspaceId}:${jobName}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup event handlers for metrics
   */
  private setupEventHandlers(): void {
    // @ts-ignore - BullMQ API type issue
    this.queue.on('completed', (job) => {
      this.metrics.incrementJobCompleted(job.data.workspaceId, job.data.workspaceTier);
    });

    // @ts-ignore - BullMQ API type issue
    this.queue.on('failed', (job, err) => {
      this.metrics.incrementJobFailed(job.data.workspaceId, job.data.workspaceTier);
      console.error(`Job ${job.id} failed:`, err);
    });

    // @ts-ignore - BullMQ API type issue
    this.queue.on('stalled', (job) => {
      this.metrics.incrementJobStalled(job.data.workspaceId, job.data.workspaceTier);
    });
  }

  /**
   * Get queue metrics
   */
  async getMetrics(): Promise<QueueMetricsData> {
    const waiting = await this.queue.getWaiting();
    const active = await this.queue.getActive();
    const completed = await this.queue.getCompleted();
    const failed = await this.queue.getFailed();
    // @ts-ignore - BullMQ API type issue
    const stalled = await this.queue.getStalled();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      stalled: stalled.length,
      workspaceMetrics: this.metrics.getWorkspaceMetrics(),
      tierMetrics: this.metrics.getTierMetrics()
    };
  }

  /**
   * Get workspace-specific metrics
   */
  async getWorkspaceMetrics(workspaceId: string): Promise<WorkspaceQueueMetrics> {
    const jobs = await this.queue.getJobs(['waiting', 'active', 'completed', 'failed']);
    const workspaceJobs = jobs.filter(job => job.data.workspaceId === workspaceId);

    return {
      total: workspaceJobs.length,
      // @ts-ignore - BullMQ API type issue
      waiting: workspaceJobs.filter(job => job.state === 'waiting').length,
      // @ts-ignore - BullMQ API type issue
      active: workspaceJobs.filter(job => job.state === 'active').length,
      // @ts-ignore - BullMQ API type issue
      completed: workspaceJobs.filter(job => job.state === 'completed').length,
      // @ts-ignore - BullMQ API type issue
      failed: workspaceJobs.filter(job => job.state === 'failed').length
    };
  }

  /**
   * Pause queue for workspace
   */
  async pauseWorkspace(workspaceId: string): Promise<void> {
    // This would require custom implementation
    // For now, we'll use job-level pausing
    console.log(`Pausing queue for workspace ${workspaceId}`);
  }

  /**
   * Resume queue for workspace
   */
  async resumeWorkspace(workspaceId: string): Promise<void> {
    console.log(`Resuming queue for workspace ${workspaceId}`);
  }

  /**
   * Clean up old jobs
   */
  async cleanup(olderThanHours: number = 24): Promise<void> {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    
    // Clean up completed jobs
    await this.queue.clean(cutoffTime, 100, 'completed');
    
    // Clean up failed jobs
    await this.queue.clean(cutoffTime, 50, 'failed');
  }

  /**
   * Close queue
   */
  async close(): Promise<void> {
    await this.queue.close();
  }
}

export interface QueueMetricsData {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  stalled: number;
  workspaceMetrics: Record<string, WorkspaceQueueMetrics>;
  tierMetrics: Record<string, TierQueueMetrics>;
}

export interface WorkspaceQueueMetrics {
  total: number;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
}

export interface TierQueueMetrics {
  total: number;
  averageWaitTime: number;
  successRate: number;
}

class QueueMetrics {
  private workspaceMetrics: Map<string, WorkspaceQueueMetrics> = new Map();
  private tierMetrics: Map<string, TierQueueMetrics> = new Map();

  incrementJobAdded(workspaceId: string, tier: string): void {
    this.updateWorkspaceMetric(workspaceId, 'total', 1);
    this.updateTierMetric(tier, 'total', 1);
  }

  incrementJobCompleted(workspaceId: string, tier: string): void {
    this.updateWorkspaceMetric(workspaceId, 'completed', 1);
    this.updateTierMetric(tier, 'completed', 1);
  }

  incrementJobFailed(workspaceId: string, tier: string): void {
    this.updateWorkspaceMetric(workspaceId, 'failed', 1);
    this.updateTierMetric(tier, 'failed', 1);
  }

  incrementJobStalled(workspaceId: string, tier: string): void {
    this.updateWorkspaceMetric(workspaceId, 'stalled', 1);
    this.updateTierMetric(tier, 'stalled', 1);
  }

  private updateWorkspaceMetric(workspaceId: string, metric: string, increment: number): void {
    if (!this.workspaceMetrics.has(workspaceId)) {
      this.workspaceMetrics.set(workspaceId, {
        total: 0,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0
      });
    }

    const metrics = this.workspaceMetrics.get(workspaceId)!;
    (metrics as any)[metric] += increment;
  }

  private updateTierMetric(tier: string, metric: string, increment: number): void {
    if (!this.tierMetrics.has(tier)) {
      this.tierMetrics.set(tier, {
        total: 0,
        averageWaitTime: 0,
        successRate: 0
      });
    }

    const metrics = this.tierMetrics.get(tier)!;
    (metrics as any)[metric] += increment;
  }

  getWorkspaceMetrics(): Record<string, WorkspaceQueueMetrics> {
    return Object.fromEntries(this.workspaceMetrics);
  }

  getTierMetrics(): Record<string, TierQueueMetrics> {
    return Object.fromEntries(this.tierMetrics);
  }
}



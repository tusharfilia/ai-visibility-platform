import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { createRedisClient } from '@ai-visibility/shared';

export interface JobRetryStrategy {
  maxAttempts: number;
  backoffDelay: number;
  backoffMultiplier: number;
  maxDelay: number;
  retryableErrors: string[];
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  retryable: boolean;
  processingTime: number;
  attempts: number;
}

export interface JobContext {
  jobId: string;
  queueName: string;
  workspaceId: string;
  userId: string;
  attempt: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt: Date;
}

@Injectable()
export class JobRetryService {
  private redis: Redis;
  private retryStrategies: Map<string, JobRetryStrategy> = new Map();

  constructor(private configService: ConfigService) {
    // BullMQ requires maxRetriesPerRequest: null for blocking commands
    this.redis = createRedisClient('JobRetryService', { maxRetriesPerRequest: null });
    this.initializeRetryStrategies();
  }

  /**
   * Initialize retry strategies for different job types
   */
  private initializeRetryStrategies(): void {
    // AI Provider jobs - more aggressive retry
    this.retryStrategies.set('runPrompt', {
      maxAttempts: 5,
      backoffDelay: 1000,
      backoffMultiplier: 2,
      maxDelay: 30000,
      retryableErrors: [
        'TIMEOUT',
        'RATE_LIMIT',
        'NETWORK_ERROR',
        'TEMPORARY_FAILURE',
        'SERVICE_UNAVAILABLE'
      ]
    });

    // Batch jobs - moderate retry
    this.retryStrategies.set('runBatch', {
      maxAttempts: 3,
      backoffDelay: 2000,
      backoffMultiplier: 2,
      maxDelay: 60000,
      retryableErrors: [
        'TIMEOUT',
        'RATE_LIMIT',
        'NETWORK_ERROR'
      ]
    });

    // Copilot jobs - conservative retry
    this.retryStrategies.set('copilotPlanner', {
      maxAttempts: 2,
      backoffDelay: 5000,
      backoffMultiplier: 2,
      maxDelay: 120000,
      retryableErrors: [
        'TIMEOUT',
        'NETWORK_ERROR'
      ]
    });

    // Directory sync jobs - aggressive retry
    this.retryStrategies.set('directorySync', {
      maxAttempts: 7,
      backoffDelay: 2000,
      backoffMultiplier: 1.5,
      maxDelay: 300000, // 5 minutes
      retryableErrors: [
        'TIMEOUT',
        'RATE_LIMIT',
        'NETWORK_ERROR',
        'API_ERROR',
        'AUTH_ERROR'
      ]
    });
  }

  /**
   * Execute job with retry logic
   */
  async executeWithRetry<T>(
    job: Job,
    processor: (context: JobContext) => Promise<T>,
    customStrategy?: JobRetryStrategy
  ): Promise<JobResult> {
    const startTime = Date.now();
    const context = this.createJobContext(job);
    const strategy = customStrategy || this.getRetryStrategy(job.name);
    
    try {
      // Execute the job
      const result = await processor(context);
      
      // Log successful execution
      await this.logJobExecution(job, 'success', Date.now() - startTime);
      
      return {
        success: true,
        data: result,
        retryable: false,
        processingTime: Date.now() - startTime,
        attempts: context.attempt
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if error is retryable
      const isRetryable = this.isRetryableError(errorMessage, strategy);
      
      // Log failed execution
      await this.logJobExecution(job, 'failed', processingTime, errorMessage);
      
      // If not retryable or max attempts reached, fail the job
      if (!isRetryable || context.attempt >= strategy.maxAttempts) {
        return {
          success: false,
          error: errorMessage,
          retryable: false,
          processingTime,
          attempts: context.attempt
        };
      }
      
      // Calculate delay for retry
      const delay = this.calculateRetryDelay(context.attempt, strategy);
      
      // Schedule retry
      await this.scheduleRetry(job, delay);
      
      return {
        success: false,
        error: errorMessage,
        retryable: true,
        processingTime,
        attempts: context.attempt
      };
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, strategy: JobRetryStrategy): number {
    const delay = strategy.backoffDelay * Math.pow(strategy.backoffMultiplier, attempt - 1);
    return Math.min(delay, strategy.maxDelay);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(errorMessage: string, strategy: JobRetryStrategy): boolean {
    return strategy.retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    );
  }

  /**
   * Get retry strategy for job type
   */
  private getRetryStrategy(jobName: string): JobRetryStrategy {
    return this.retryStrategies.get(jobName) || {
      maxAttempts: 3,
      backoffDelay: 2000,
      backoffMultiplier: 2,
      maxDelay: 60000,
      retryableErrors: ['TIMEOUT', 'NETWORK_ERROR']
    };
  }

  /**
   * Create job context
   */
  private createJobContext(job: Job): JobContext {
    return {
      jobId: job.id as string,
      queueName: job.queueName,
      workspaceId: job.data.workspaceId || 'unknown',
      userId: job.data.userId || 'system',
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts || 3,
      createdAt: new Date(job.timestamp),
      startedAt: new Date()
    };
  }

  /**
   * Schedule job retry
   */
  private async scheduleRetry(job: Job, delay: number): Promise<void> {
    try {
      // Add delay to job
      await job.moveToDelayed(Date.now() + delay);
      
      console.log(`Job ${job.id} scheduled for retry in ${delay}ms`);
      
      // Update retry metrics
      await this.updateRetryMetrics(job.queueName, delay);
      
    } catch (error) {
      console.error(`Failed to schedule retry for job ${job.id}:`, error);
    }
  }

  /**
   * Log job execution
   */
  private async logJobExecution(
    job: Job,
    status: 'success' | 'failed',
    processingTime: number,
    error?: string
  ): Promise<void> {
    const logData = {
      jobId: job.id,
      queueName: job.queueName,
      jobName: job.name,
      workspaceId: job.data.workspaceId,
      status,
      processingTime,
      attempts: job.attemptsMade + 1,
      timestamp: new Date().toISOString(),
      error: error ? error.substring(0, 500) : undefined // Truncate long errors
    };

    // Store in Redis for analysis
    await this.redis.lpush(
      `job_logs:${job.queueName}`,
      JSON.stringify(logData)
    );

    // Keep only last 1000 logs per queue
    await this.redis.ltrim(`job_logs:${job.queueName}`, 0, 999);

    console.log(`Job ${job.id} ${status} in ${processingTime}ms (attempt ${job.attemptsMade + 1})`);
  }

  /**
   * Update retry metrics
   */
  private async updateRetryMetrics(queueName: string, delay: number): Promise<void> {
    const metricsKey = `retry_metrics:${queueName}`;
    
    await this.redis.hincrby(metricsKey, 'total_retries', 1);
    await this.redis.hincrby(metricsKey, 'total_delay', delay);
    await this.redis.expire(metricsKey, 86400); // 24 hours
  }

  /**
   * Get retry metrics for queue
   */
  async getRetryMetrics(queueName: string): Promise<{
    totalRetries: number;
    totalDelay: number;
    avgDelay: number;
  }> {
    const metricsKey = `retry_metrics:${queueName}`;
    const metrics = await this.redis.hgetall(metricsKey);
    
    const totalRetries = parseInt(metrics.total_retries || '0');
    const totalDelay = parseInt(metrics.total_delay || '0');
    const avgDelay = totalRetries > 0 ? totalDelay / totalRetries : 0;
    
    return {
      totalRetries,
      totalDelay,
      avgDelay
    };
  }

  /**
   * Get job execution logs
   */
  async getJobLogs(queueName: string, limit: number = 100): Promise<any[]> {
    const logs = await this.redis.lrange(`job_logs:${queueName}`, 0, limit - 1);
    return logs.map(log => JSON.parse(log));
  }

  /**
   * Get job failure analysis
   */
  async getFailureAnalysis(queueName: string, hours: number = 24): Promise<{
    totalFailures: number;
    errorTypes: Record<string, number>;
    avgProcessingTime: number;
    retryRate: number;
  }> {
    const logs = await this.getJobLogs(queueName, 1000);
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const recentLogs = logs.filter(log => 
      new Date(log.timestamp) > cutoffTime && log.status === 'failed'
    );
    
    const errorTypes: Record<string, number> = {};
    let totalProcessingTime = 0;
    let retryCount = 0;
    
    recentLogs.forEach(log => {
      if (log.error) {
        const errorType = this.categorizeError(log.error);
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      }
      
      totalProcessingTime += log.processingTime;
      
      if (log.attempts > 1) {
        retryCount++;
      }
    });
    
    return {
      totalFailures: recentLogs.length,
      errorTypes,
      avgProcessingTime: recentLogs.length > 0 ? totalProcessingTime / recentLogs.length : 0,
      retryRate: recentLogs.length > 0 ? retryCount / recentLogs.length : 0
    };
  }

  /**
   * Categorize error type
   */
  private categorizeError(error: string): string {
    if (error.includes('TIMEOUT')) return 'TIMEOUT';
    if (error.includes('RATE_LIMIT')) return 'RATE_LIMIT';
    if (error.includes('NETWORK_ERROR')) return 'NETWORK_ERROR';
    if (error.includes('AUTH_ERROR')) return 'AUTH_ERROR';
    if (error.includes('API_ERROR')) return 'API_ERROR';
    if (error.includes('VALIDATION_ERROR')) return 'VALIDATION_ERROR';
    return 'OTHER';
  }

  /**
   * Add custom retry strategy
   */
  addRetryStrategy(jobName: string, strategy: JobRetryStrategy): void {
    this.retryStrategies.set(jobName, strategy);
    console.log(`Retry strategy added for job type: ${jobName}`);
  }

  /**
   * Get all retry strategies
   */
  getRetryStrategies(): Map<string, JobRetryStrategy> {
    return new Map(this.retryStrategies);
  }
}


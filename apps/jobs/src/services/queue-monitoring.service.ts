import { Injectable } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

export interface QueueHealthStatus {
  queueName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  metrics: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  };
  performance: {
    avgProcessingTime: number;
    processingRate: number;
    errorRate: number;
    throughput: number;
  };
  lastUpdated: Date;
}

export interface QueueAlert {
  id: string;
  queueName: string;
  type: 'high_failure_rate' | 'queue_backlog' | 'slow_processing' | 'queue_paused';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  createdAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface QueuePerformanceMetrics {
  queueName: string;
  timeWindow: string;
  metrics: {
    jobsProcessed: number;
    avgProcessingTime: number;
    errorRate: number;
    throughput: number;
    peakConcurrency: number;
  };
  trends: {
    processingTimeTrend: 'improving' | 'stable' | 'degrading';
    errorRateTrend: 'improving' | 'stable' | 'degrading';
    throughputTrend: 'improving' | 'stable' | 'degrading';
  };
}

@Injectable()
export class QueueMonitoringService {
  private redis: Redis;
  private queues: Map<string, Queue> = new Map();
  private healthThresholds = {
    maxFailureRate: 0.1, // 10%
    maxWaitingJobs: 1000,
    maxAvgProcessingTime: 30000, // 30 seconds
    minThroughput: 1 // jobs per minute
  };
  private alerts: Map<string, QueueAlert> = new Map();
  private performanceHistory: Map<string, QueuePerformanceMetrics[]> = new Map();

  constructor(private configService: ConfigService) {
    this.redis = new Redis(this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379');
  }

  /**
   * Register queue for monitoring
   */
  registerQueue(queue: Queue): void {
    this.queues.set(queue.name, queue);
    console.log(`Queue registered for monitoring: ${queue.name}`);
  }

  /**
   * Get comprehensive queue health status
   */
  async getQueueHealth(queueName: string): Promise<QueueHealthStatus> {
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

    const metrics = {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused,
    };

    const performance = await this.calculatePerformanceMetrics(queueName);
    const issues = await this.identifyIssues(queueName, metrics, performance);
    const status = this.determineHealthStatus(issues);

    return {
      queueName,
      status,
      issues,
      metrics,
      performance,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get health status for all queues
   */
  async getAllQueueHealth(): Promise<QueueHealthStatus[]> {
    const healthStatuses: QueueHealthStatus[] = [];
    
    for (const queueName of this.queues.keys()) {
      try {
        const health = await this.getQueueHealth(queueName);
        healthStatuses.push(health);
      } catch (error) {
        console.error(`Failed to get health for queue ${queueName}:`, error);
      }
    }

    return healthStatuses;
  }

  /**
   * Calculate performance metrics
   */
  private async calculatePerformanceMetrics(queueName: string): Promise<QueueHealthStatus['performance']> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    // Get recent completed jobs
    const completedJobs = await queue.getCompleted(0, 100);
    const failedJobs = await queue.getFailed(0, 100);
    
    // Calculate average processing time
    let totalProcessingTime = 0;
    let processedCount = 0;
    
    completedJobs.forEach(job => {
      if (job.processedOn && job.finishedOn) {
        totalProcessingTime += job.finishedOn - job.processedOn;
        processedCount++;
      }
    });

    const avgProcessingTime = processedCount > 0 ? totalProcessingTime / processedCount : 0;
    
    // Calculate error rate
    const totalJobs = completedJobs.length + failedJobs.length;
    const errorRate = totalJobs > 0 ? failedJobs.length / totalJobs : 0;
    
    // Calculate throughput (jobs per minute)
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentJobs = [...completedJobs, ...failedJobs].filter(
      job => job.finishedOn && job.finishedOn > oneHourAgo
    );
    const throughput = recentJobs.length / 60; // jobs per minute
    
    // Calculate processing rate (jobs per second)
    const processingRate = processedCount > 0 ? 1000 / avgProcessingTime : 0;

    return {
      avgProcessingTime,
      processingRate,
      errorRate,
      throughput,
    };
  }

  /**
   * Identify queue issues
   */
  private async identifyIssues(
    queueName: string,
    metrics: QueueHealthStatus['metrics'],
    performance: QueueHealthStatus['performance']
  ): Promise<string[]> {
    const issues: string[] = [];

    // Check failure rate
    if (performance.errorRate > this.healthThresholds.maxFailureRate) {
      issues.push(`High failure rate: ${(performance.errorRate * 100).toFixed(1)}%`);
    }

    // Check queue backlog
    if (metrics.waiting > this.healthThresholds.maxWaitingJobs) {
      issues.push(`High queue backlog: ${metrics.waiting} jobs waiting`);
    }

    // Check processing time
    if (performance.avgProcessingTime > this.healthThresholds.maxAvgProcessingTime) {
      issues.push(`Slow processing: ${(performance.avgProcessingTime / 1000).toFixed(1)}s average`);
    }

    // Check throughput
    if (performance.throughput < this.healthThresholds.minThroughput) {
      issues.push(`Low throughput: ${performance.throughput.toFixed(2)} jobs/min`);
    }

    // Check if queue is paused
    if (metrics.paused) {
      issues.push('Queue is paused');
    }

    return issues;
  }

  /**
   * Determine overall health status
   */
  private determineHealthStatus(issues: string[]): QueueHealthStatus['status'] {
    if (issues.length === 0) {
      return 'healthy';
    }

    const criticalIssues = issues.filter(issue => 
      issue.includes('High failure rate') || 
      issue.includes('Queue is paused')
    );

    if (criticalIssues.length > 0) {
      return 'unhealthy';
    }

    return 'degraded';
  }

  /**
   * Generate alerts for queue issues
   */
  async generateAlerts(queueName: string): Promise<QueueAlert[]> {
    const health = await this.getQueueHealth(queueName);
    const newAlerts: QueueAlert[] = [];

    for (const issue of health.issues) {
      const alertType = this.determineAlertType(issue);
      const severity = this.determineSeverity(issue);
      
      // Check if alert already exists
      const existingAlert = Array.from(this.alerts.values()).find(
        alert => alert.queueName === queueName && 
                alert.type === alertType && 
                !alert.acknowledged
      );

      if (!existingAlert) {
        const alert: QueueAlert = {
          id: this.generateAlertId(),
          queueName,
          type: alertType,
          severity,
          message: issue,
          threshold: this.getThresholdForIssue(issue),
          currentValue: this.getCurrentValueForIssue(issue, health),
          createdAt: new Date(),
          acknowledged: false,
        };

        this.alerts.set(alert.id, alert);
        newAlerts.push(alert);
        
        console.log(`Alert generated for queue ${queueName}: ${issue}`);
      }
    }

    return newAlerts;
  }

  /**
   * Determine alert type from issue message
   */
  private determineAlertType(issue: string): QueueAlert['type'] {
    if (issue.includes('High failure rate')) return 'high_failure_rate';
    if (issue.includes('High queue backlog')) return 'queue_backlog';
    if (issue.includes('Slow processing')) return 'slow_processing';
    if (issue.includes('Queue is paused')) return 'queue_paused';
    return 'high_failure_rate'; // default
  }

  /**
   * Determine alert severity
   */
  private determineSeverity(issue: string): QueueAlert['severity'] {
    if (issue.includes('Queue is paused')) return 'critical';
    if (issue.includes('High failure rate')) return 'high';
    if (issue.includes('High queue backlog')) return 'medium';
    if (issue.includes('Slow processing')) return 'low';
    return 'medium';
  }

  /**
   * Get threshold for issue
   */
  private getThresholdForIssue(issue: string): number {
    if (issue.includes('High failure rate')) return this.healthThresholds.maxFailureRate;
    if (issue.includes('High queue backlog')) return this.healthThresholds.maxWaitingJobs;
    if (issue.includes('Slow processing')) return this.healthThresholds.maxAvgProcessingTime;
    if (issue.includes('Low throughput')) return this.healthThresholds.minThroughput;
    return 0;
  }

  /**
   * Get current value for issue
   */
  private getCurrentValueForIssue(issue: string, health: QueueHealthStatus): number {
    if (issue.includes('High failure rate')) return health.performance.errorRate;
    if (issue.includes('High queue backlog')) return health.metrics.waiting;
    if (issue.includes('Slow processing')) return health.performance.avgProcessingTime;
    if (issue.includes('Low throughput')) return health.performance.throughput;
    return 0;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): QueueAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.acknowledged);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
      console.log(`Alert ${alertId} acknowledged by ${acknowledgedBy}`);
    }
  }

  /**
   * Get queue performance trends
   */
  async getPerformanceTrends(queueName: string, hours: number = 24): Promise<QueuePerformanceMetrics> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    
    // Get jobs from the specified time window
    const [completedJobs, failedJobs] = await Promise.all([
      queue.getCompleted(0, 1000),
      queue.getFailed(0, 1000),
    ]);

    const recentJobs = [...completedJobs, ...failedJobs].filter(
      job => job.finishedOn && job.finishedOn > cutoffTime
    );

    // Calculate metrics
    const jobsProcessed = recentJobs.length;
    const failedCount = recentJobs.filter(job => job.failedReason).length;
    const errorRate = jobsProcessed > 0 ? failedCount / jobsProcessed : 0;
    
    const processingTimes = recentJobs
      .filter(job => job.processedOn && job.finishedOn)
      .map(job => job.finishedOn! - job.processedOn!);
    
    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length 
      : 0;

    const throughput = jobsProcessed / (hours * 60); // jobs per minute
    const peakConcurrency = Math.max(...recentJobs.map(job => job.opts.concurrency || 1));

    // Calculate trends (simplified)
    const trends = {
      processingTimeTrend: 'stable' as const,
      errorRateTrend: 'stable' as const,
      throughputTrend: 'stable' as const,
    };

    return {
      queueName,
      timeWindow: `${hours}h`,
      metrics: {
        jobsProcessed,
        avgProcessingTime,
        errorRate,
        throughput,
        peakConcurrency,
      },
      trends,
    };
  }

  /**
   * Update health thresholds
   */
  updateHealthThresholds(thresholds: Partial<typeof this.healthThresholds>): void {
    this.healthThresholds = { ...this.healthThresholds, ...thresholds };
    console.log('Health thresholds updated:', this.healthThresholds);
  }

  /**
   * Get monitoring dashboard data
   */
  async getDashboardData(): Promise<{
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    queueHealth: QueueHealthStatus[];
    activeAlerts: QueueAlert[];
    totalJobs: number;
    totalErrors: number;
  }> {
    const queueHealth = await this.getAllQueueHealth();
    const activeAlerts = this.getActiveAlerts();
    
    const overallHealth = queueHealth.every(q => q.status === 'healthy') ? 'healthy' :
                         queueHealth.some(q => q.status === 'unhealthy') ? 'unhealthy' : 'degraded';
    
    const totalJobs = queueHealth.reduce((sum, q) => 
      sum + q.metrics.waiting + q.metrics.active + q.metrics.completed + q.metrics.failed, 0
    );
    
    const totalErrors = queueHealth.reduce((sum, q) => sum + q.metrics.failed, 0);

    return {
      overallHealth,
      queueHealth,
      activeAlerts,
      totalJobs,
      totalErrors,
    };
  }
}


/**
 * Fair Scheduling Logic
 * Implements token-bucket style rate limiting for fair workspace scheduling
 */

import { Redis } from 'ioredis';

export interface WorkspaceQuota {
  workspaceId: string;
  tier: 'free' | 'insights' | 'copilot' | 'enterprise';
  maxConcurrentJobs: number;
  maxJobsPerHour: number;
  currentJobs: number;
  lastReset: Date;
  tokens: number;
}

export interface SchedulingConfig {
  free: { maxConcurrent: number; maxPerHour: number; tokens: number };
  insights: { maxConcurrent: number; maxPerHour: number; tokens: number };
  copilot: { maxConcurrent: number; maxPerHour: number; tokens: number };
  enterprise: { maxConcurrent: number; maxPerHour: number; tokens: number };
}

export class FairScheduler {
  private redis: Redis;
  private quotas: Map<string, WorkspaceQuota> = new Map();
  private config: SchedulingConfig;

  constructor(redis: Redis, config?: Partial<SchedulingConfig>) {
    this.redis = redis;
    this.config = {
      free: { maxConcurrent: 2, maxPerHour: 10, tokens: 10 },
      insights: { maxConcurrent: 5, maxPerHour: 50, tokens: 50 },
      copilot: { maxConcurrent: 10, maxPerHour: 200, tokens: 200 },
      enterprise: { maxConcurrent: 50, maxPerHour: 1000, tokens: 1000 },
      ...config
    };
  }

  /**
   * Check if workspace can schedule a job
   */
  async canScheduleJob(workspaceId: string, tier: string): Promise<{
    allowed: boolean;
    reason?: string;
    waitTime?: number;
  }> {
    const quota = await this.getWorkspaceQuota(workspaceId, tier);
    
    // Check concurrent job limit
    if (quota.currentJobs >= quota.maxConcurrentJobs) {
      return {
        allowed: false,
        reason: 'Concurrent job limit reached',
        waitTime: this.estimateWaitTime(quota)
      };
    }

    // Check hourly rate limit
    if (quota.tokens <= 0) {
      return {
        allowed: false,
        reason: 'Hourly rate limit reached',
        waitTime: this.estimateWaitTime(quota)
      };
    }

    return { allowed: true };
  }

  /**
   * Reserve a job slot for workspace
   */
  async reserveJobSlot(workspaceId: string, tier: string): Promise<boolean> {
    const quota = await this.getWorkspaceQuota(workspaceId, tier);
    
    if (quota.currentJobs >= quota.maxConcurrentJobs || quota.tokens <= 0) {
      return false;
    }

    // Reserve the slot
    quota.currentJobs++;
    quota.tokens--;
    
    await this.updateWorkspaceQuota(workspaceId, quota);
    
    return true;
  }

  /**
   * Release a job slot when job completes
   */
  async releaseJobSlot(workspaceId: string, tier: string): Promise<void> {
    const quota = await this.getWorkspaceQuota(workspaceId, tier);
    
    if (quota.currentJobs > 0) {
      quota.currentJobs--;
      await this.updateWorkspaceQuota(workspaceId, quota);
    }
  }

  /**
   * Get workspace quota
   */
  private async getWorkspaceQuota(workspaceId: string, tier: string): Promise<WorkspaceQuota> {
    const key = `quota:${workspaceId}`;
    const cached = await this.redis.get(key);
    
    if (cached) {
      const quota = JSON.parse(cached);
      // Check if quota needs reset (hourly)
      if (this.shouldResetQuota(quota)) {
        return this.resetWorkspaceQuota(workspaceId, tier);
      }
      return quota;
    }
    
    return this.resetWorkspaceQuota(workspaceId, tier);
  }

  /**
   * Reset workspace quota
   */
  private async resetWorkspaceQuota(workspaceId: string, tier: string): Promise<WorkspaceQuota> {
    const tierConfig = this.config[tier as keyof SchedulingConfig];
    
    const quota: WorkspaceQuota = {
      workspaceId,
      tier: tier as any,
      maxConcurrentJobs: tierConfig.maxConcurrent,
      maxJobsPerHour: tierConfig.maxPerHour,
      currentJobs: 0,
      lastReset: new Date(),
      tokens: tierConfig.tokens
    };
    
    await this.updateWorkspaceQuota(workspaceId, quota);
    return quota;
  }

  /**
   * Update workspace quota in Redis
   */
  private async updateWorkspaceQuota(workspaceId: string, quota: WorkspaceQuota): Promise<void> {
    const key = `quota:${workspaceId}`;
    await this.redis.setex(key, 3600, JSON.stringify(quota)); // 1 hour TTL
  }

  /**
   * Check if quota should be reset
   */
  private shouldResetQuota(quota: WorkspaceQuota): boolean {
    const now = new Date();
    const lastReset = new Date(quota.lastReset);
    const hoursDiff = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
    
    return hoursDiff >= 1; // Reset every hour
  }

  /**
   * Estimate wait time for workspace
   */
  private estimateWaitTime(quota: WorkspaceQuota): number {
    if (quota.currentJobs < quota.maxConcurrentJobs) {
      return 0; // Can start immediately
    }
    
    // Estimate based on current load
    const averageJobTime = 30; // seconds
    const queuedJobs = quota.currentJobs - quota.maxConcurrentJobs;
    
    return queuedJobs * averageJobTime;
  }

  /**
   * Get scheduling metrics
   */
  async getSchedulingMetrics(): Promise<{
    totalWorkspaces: number;
    activeWorkspaces: number;
    tierDistribution: Record<string, number>;
    averageWaitTime: number;
  }> {
    const keys = await this.redis.keys('quota:*');
    const quotas = await Promise.all(
      keys.map(async key => {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      })
    );

    const activeQuotas = quotas.filter(q => q && q.currentJobs > 0);
    
    const tierDistribution = quotas.reduce((acc, quota) => {
      if (quota) {
        acc[quota.tier] = (acc[quota.tier] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalWorkspaces: quotas.length,
      activeWorkspaces: activeQuotas.length,
      tierDistribution,
      averageWaitTime: this.calculateAverageWaitTime(activeQuotas)
    };
  }

  /**
   * Calculate average wait time
   */
  private calculateAverageWaitTime(quotas: WorkspaceQuota[]): number {
    if (quotas.length === 0) return 0;
    
    const totalWaitTime = quotas.reduce((sum, quota) => {
      return sum + this.estimateWaitTime(quota);
    }, 0);
    
    return totalWaitTime / quotas.length;
  }

  /**
   * Get workspace scheduling status
   */
  async getWorkspaceStatus(workspaceId: string): Promise<{
    tier: string;
    currentJobs: number;
    maxConcurrent: number;
    tokensRemaining: number;
    maxPerHour: number;
    canSchedule: boolean;
    waitTime: number;
  }> {
    const quota = await this.getWorkspaceQuota(workspaceId, 'free'); // Default tier
    
    return {
      tier: quota.tier,
      currentJobs: quota.currentJobs,
      maxConcurrent: quota.maxConcurrentJobs,
      tokensRemaining: quota.tokens,
      maxPerHour: quota.maxJobsPerHour,
      canSchedule: quota.currentJobs < quota.maxConcurrentJobs && quota.tokens > 0,
      waitTime: this.estimateWaitTime(quota)
    };
  }
}



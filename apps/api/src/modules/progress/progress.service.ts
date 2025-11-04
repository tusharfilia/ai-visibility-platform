/**
 * Progress Tracking Service
 * Manages progress state for long-running operations
 */

import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { EventEmitterService } from '../events/event-emitter.service';

export interface ProgressState {
  id: string;
  workspaceId: string;
  operation: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  metadata?: any;
}

@Injectable()
export class ProgressService {
  private redis: Redis;
  private readonly PROGRESS_TTL = 86400; // 24 hours

  constructor(private eventEmitter: EventEmitterService) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  /**
   * Create new progress tracking
   */
  async createProgress(
    workspaceId: string,
    operation: string,
    totalSteps: number = 1,
    metadata?: any
  ): Promise<ProgressState> {
    const progressId = this.generateProgressId();
    const progress: ProgressState = {
      id: progressId,
      workspaceId,
      operation,
      status: 'pending',
      progress: 0,
      currentStep: 'Initializing',
      totalSteps,
      completedSteps: 0,
      startedAt: new Date().toISOString(),
      metadata
    };

    await this.redis.setex(
      `progress:${workspaceId}:${progressId}`,
      this.PROGRESS_TTL,
      JSON.stringify(progress)
    );

    // Emit initial progress event
    this.eventEmitter.emitScanProgress(workspaceId, progressId, 0, 'pending');

    return progress;
  }

  /**
   * Update progress
   */
  async updateProgress(
    workspaceId: string,
    progressId: string,
    updates: Partial<ProgressState>
  ): Promise<ProgressState> {
    const key = `progress:${workspaceId}:${progressId}`;
    const existing = await this.redis.get(key);
    
    if (!existing) {
      throw new Error('Progress not found');
    }

    const progress: ProgressState = JSON.parse(existing);
    const updatedProgress = { ...progress, ...updates };
    
    // Calculate progress percentage
    if (updatedProgress.completedSteps !== undefined && updatedProgress.totalSteps) {
      updatedProgress.progress = Math.round(
        (updatedProgress.completedSteps / updatedProgress.totalSteps) * 100
      );
    }

    await this.redis.setex(key, this.PROGRESS_TTL, JSON.stringify(updatedProgress));

    // Emit progress event
    this.eventEmitter.emitScanProgress(
      workspaceId,
      progressId,
      updatedProgress.progress,
      updatedProgress.status
    );

    return updatedProgress;
  }

  /**
   * Complete progress
   */
  async completeProgress(
    workspaceId: string,
    progressId: string,
    success: boolean = true,
    error?: string
  ): Promise<ProgressState> {
    const updates: Partial<ProgressState> = {
      status: success ? 'completed' : 'failed',
      progress: success ? 100 : undefined,
      finishedAt: new Date().toISOString(),
      error: success ? undefined : error
    };

    return this.updateProgress(workspaceId, progressId, updates);
  }

  /**
   * Cancel progress
   */
  async cancelProgress(
    workspaceId: string,
    progressId: string,
    reason?: string
  ): Promise<ProgressState> {
    const updates: Partial<ProgressState> = {
      status: 'cancelled',
      finishedAt: new Date().toISOString(),
      error: reason
    };

    return this.updateProgress(workspaceId, progressId, updates);
  }

  /**
   * Get progress state
   */
  async getProgress(workspaceId: string, progressId: string): Promise<ProgressState | null> {
    const key = `progress:${workspaceId}:${progressId}`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  /**
   * Get all progress for workspace
   */
  async getWorkspaceProgress(workspaceId: string): Promise<ProgressState[]> {
    const pattern = `progress:${workspaceId}:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) {
      return [];
    }

    const progressData = await this.redis.mget(keys);
    return progressData
      .filter(data => data !== null)
      .map(data => JSON.parse(data!));
  }

  /**
   * Clean up completed progress
   */
  async cleanupCompletedProgress(workspaceId: string, olderThanHours: number = 24): Promise<void> {
    const progressList = await this.getWorkspaceProgress(workspaceId);
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    const toDelete = progressList
      .filter(progress => 
        (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') &&
        new Date(progress.finishedAt || progress.startedAt) < cutoffTime
      );

    for (const progress of toDelete) {
      await this.redis.del(`progress:${workspaceId}:${progress.id}`);
    }
  }

  /**
   * Get progress metrics
   */
  async getProgressMetrics(workspaceId: string): Promise<{
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    const progressList = await this.getWorkspaceProgress(workspaceId);
    
    return {
      total: progressList.length,
      pending: progressList.filter(p => p.status === 'pending').length,
      running: progressList.filter(p => p.status === 'running').length,
      completed: progressList.filter(p => p.status === 'completed').length,
      failed: progressList.filter(p => p.status === 'failed').length,
      cancelled: progressList.filter(p => p.status === 'cancelled').length
    };
  }

  /**
   * Generate unique progress ID
   */
  private generateProgressId(): string {
    return `prog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}



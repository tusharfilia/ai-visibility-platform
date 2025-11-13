import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { createRedisClient } from '@ai-visibility/shared';

export interface DirectoryPlatform {
  id: string;
  name: string;
  type: 'oauth' | 'api' | 'form' | 'aggregator';
  baseUrl: string;
  authType: 'oauth2' | 'api_key' | 'basic' | 'none';
  supportedFields: string[];
  submissionEndpoint: string;
  status: 'active' | 'inactive' | 'maintenance';
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  lastSync?: Date;
}

export interface DirectorySubmission {
  id: string;
  workspaceId: string;
  platformId: string;
  businessInfo: BusinessInfo;
  status: 'pending' | 'submitting' | 'submitted' | 'failed' | 'verified';
  submittedAt?: Date;
  verifiedAt?: Date;
  error?: string;
  submissionId?: string;
  verificationData?: any;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessInfo {
  name: string;
  description: string;
  website: string;
  email: string;
  phone?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  category: string;
  subcategory?: string;
  hours?: {
    [key: string]: string;
  };
  socialMedia?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };
  images?: string[];
  tags?: string[];
}

export interface SyncJob {
  id: string;
  workspaceId: string;
  platformIds: string[];
  businessInfo: BusinessInfo;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    platform: string;
    message: string;
  };
  results: DirectorySubmission[];
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface DirectoryMetrics {
  totalPlatforms: number;
  activePlatforms: number;
  submissionsToday: number;
  submissionsThisWeek: number;
  submissionsThisMonth: number;
  successRate: number;
  averageSubmissionTime: number;
  topPerformingPlatforms: Array<{
    platformId: string;
    name: string;
    submissionCount: number;
    successRate: number;
  }>;
}

@Injectable()
export class DirectorySyncService {
  private redis: Redis;
  private syncQueue: Queue;
  private platforms: DirectoryPlatform[] = [];

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.redis = createRedisClient('DirectorySyncService');
    this.syncQueue = new Queue('directory-sync', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
      },
    });

    this.initializePlatforms();
  }

  /**
   * Initialize supported directory platforms
   */
  private initializePlatforms(): void {
    this.platforms = [
      {
        id: 'google-business',
        name: 'Google My Business',
        type: 'oauth',
        baseUrl: 'https://mybusiness.googleapis.com',
        authType: 'oauth2',
        supportedFields: ['name', 'description', 'website', 'phone', 'address', 'category', 'hours'],
        submissionEndpoint: '/v4/accounts/{accountId}/locations',
        status: 'active',
        rateLimit: { requestsPerMinute: 100, requestsPerDay: 10000 },
      },
      {
        id: 'yelp',
        name: 'Yelp',
        type: 'api',
        baseUrl: 'https://api.yelp.com',
        authType: 'api_key',
        supportedFields: ['name', 'description', 'website', 'phone', 'address', 'category'],
        submissionEndpoint: '/v3/businesses',
        status: 'active',
        rateLimit: { requestsPerMinute: 50, requestsPerDay: 5000 },
      },
      {
        id: 'facebook-pages',
        name: 'Facebook Pages',
        type: 'oauth',
        baseUrl: 'https://graph.facebook.com',
        authType: 'oauth2',
        supportedFields: ['name', 'description', 'website', 'phone', 'address', 'category', 'hours'],
        submissionEndpoint: '/v18.0/me/accounts',
        status: 'active',
        rateLimit: { requestsPerMinute: 200, requestsPerDay: 20000 },
      },
      {
        id: 'linkedin-company',
        name: 'LinkedIn Company Pages',
        type: 'oauth',
        baseUrl: 'https://api.linkedin.com',
        authType: 'oauth2',
        supportedFields: ['name', 'description', 'website', 'industry', 'address'],
        submissionEndpoint: '/v2/organizations',
        status: 'active',
        rateLimit: { requestsPerMinute: 100, requestsPerDay: 10000 },
      },
      {
        id: 'yellow-pages',
        name: 'Yellow Pages',
        type: 'form',
        baseUrl: 'https://www.yellowpages.com',
        authType: 'none',
        supportedFields: ['name', 'description', 'website', 'phone', 'address', 'category'],
        submissionEndpoint: '/submit',
        status: 'active',
        rateLimit: { requestsPerMinute: 10, requestsPerDay: 100 },
      },
      {
        id: 'better-business-bureau',
        name: 'Better Business Bureau',
        type: 'form',
        baseUrl: 'https://www.bbb.org',
        authType: 'none',
        supportedFields: ['name', 'description', 'website', 'phone', 'address', 'category'],
        submissionEndpoint: '/business-profile',
        status: 'active',
        rateLimit: { requestsPerMinute: 5, requestsPerDay: 50 },
      },
    ];
  }

  /**
   * Get all supported platforms
   */
  async getPlatforms(): Promise<DirectoryPlatform[]> {
    return this.platforms;
  }

  /**
   * Get platform by ID
   */
  async getPlatform(platformId: string): Promise<DirectoryPlatform | null> {
    return this.platforms.find(p => p.id === platformId) || null;
  }

  /**
   * Initiate directory sync for multiple platforms
   */
  async initiateSync(
    workspaceId: string,
    platformIds: string[],
    businessInfo: BusinessInfo,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<SyncJob> {
    const syncJob: SyncJob = {
      id: this.generateSyncJobId(),
      workspaceId,
      platformIds,
      businessInfo,
      priority,
      status: 'pending',
      progress: {
        current: 0,
        total: platformIds.length,
        platform: '',
        message: 'Preparing directory sync...',
      },
      results: [],
      createdAt: new Date(),
    };

    // Store sync job
    await this.redis.setex(
      `sync:job:${syncJob.id}`,
      86400, // 24 hours TTL
      JSON.stringify(syncJob)
    );

    // Queue sync job
    await this.syncQueue.add('sync-directories', {
      syncJobId: syncJob.id,
      workspaceId,
      platformIds,
      businessInfo,
      priority,
    }, {
      jobId: syncJob.id,
      priority: this.getPriorityValue(priority),
    });

    this.eventEmitter.emit('directory.sync.initiated', {
      workspaceId,
      syncJobId: syncJob.id,
      platformIds,
    });

    return syncJob;
  }

  /**
   * Process directory sync job
   */
  async processSyncJob(payload: {
    syncJobId: string;
    workspaceId: string;
    platformIds: string[];
    businessInfo: BusinessInfo;
    priority: string;
  }): Promise<void> {
    const { syncJobId, workspaceId, platformIds, businessInfo, priority } = payload;

    try {
      // Update job status to running
      await this.updateSyncJob(syncJobId, {
        status: 'running',
        startedAt: new Date(),
        progress: {
          current: 0,
          total: platformIds.length,
          platform: '',
          message: 'Starting directory sync...',
        },
      });

      const results: DirectorySubmission[] = [];

      // Process each platform
      for (let i = 0; i < platformIds.length; i++) {
        const platformId = platformIds[i];
        const platform = await this.getPlatform(platformId);

        if (!platform) {
          console.error(`Platform ${platformId} not found`);
          continue;
        }

        // Update progress
        await this.updateSyncJob(syncJobId, {
          progress: {
            current: i + 1,
            total: platformIds.length,
            platform: platform.name,
            message: `Submitting to ${platform.name}...`,
          },
        });

        // Submit to platform
        const submission = await this.submitToPlatform(
          workspaceId,
          platformId,
          businessInfo
        );

        results.push(submission);

        // Emit progress event
        this.eventEmitter.emit('directory.sync.progress', {
          workspaceId,
          syncJobId,
          platformId,
          platformName: platform.name,
          submission,
        });
      }

      // Update job as completed
      await this.updateSyncJob(syncJobId, {
        status: 'completed',
        completedAt: new Date(),
        results,
        progress: {
          current: platformIds.length,
          total: platformIds.length,
          platform: 'All platforms',
          message: 'Directory sync completed successfully!',
        },
      });

      // Emit completion event
      this.eventEmitter.emit('directory.sync.completed', {
        workspaceId,
        syncJobId,
        results,
      });

    } catch (error) {
      console.error(`Directory sync failed for job ${syncJobId}:`, error);

      await this.updateSyncJob(syncJobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        progress: {
          current: 0,
          total: platformIds.length,
          platform: 'Error',
          message: 'Directory sync failed. Please try again.',
        },
      });

      this.eventEmitter.emit('directory.sync.failed', {
        workspaceId,
        syncJobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Submit business info to a specific platform
   */
  private async submitToPlatform(
    workspaceId: string,
    platformId: string,
    businessInfo: BusinessInfo
  ): Promise<DirectorySubmission> {
    const platform = await this.getPlatform(platformId);
    if (!platform) {
      throw new Error(`Platform ${platformId} not found`);
    }

    const submission: DirectorySubmission = {
      id: this.generateSubmissionId(),
      workspaceId,
      platformId,
      businessInfo,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      // Update status to submitting
      submission.status = 'submitting';
      submission.updatedAt = new Date();

      // Simulate platform submission based on platform type
      const result = await this.simulatePlatformSubmission(platform, businessInfo);

      // Update submission with success
      submission.status = 'submitted';
      submission.submittedAt = new Date();
      submission.submissionId = result.submissionId;
      submission.updatedAt = new Date();

      // Store submission
      await this.redis.setex(
        `submission:${submission.id}`,
        86400,
        JSON.stringify(submission)
      );

      return submission;

    } catch (error) {
      // Update submission with failure
      submission.status = 'failed';
      submission.error = error instanceof Error ? error.message : String(error);
      submission.retryCount++;
      submission.updatedAt = new Date();

      // Store submission
      await this.redis.setex(
        `submission:${submission.id}`,
        86400,
        JSON.stringify(submission)
      );

      return submission;
    }
  }

  /**
   * Simulate platform submission
   */
  private async simulatePlatformSubmission(
    platform: DirectoryPlatform,
    businessInfo: BusinessInfo
  ): Promise<any> {
    // Simulate different submission times based on platform type
    const delays = {
      'oauth': 2000,
      'api': 1500,
      'form': 3000,
      'aggregator': 1000,
    };

    await this.simulateDelay(delays[platform.type] || 2000);

    // Simulate success/failure based on platform status
    if (platform.status === 'maintenance') {
      throw new Error(`Platform ${platform.name} is under maintenance`);
    }

    if (platform.status === 'inactive') {
      throw new Error(`Platform ${platform.name} is currently inactive`);
    }

    // Simulate occasional failures
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error(`Submission failed due to platform error`);
    }

    return {
      submissionId: `sub_${platform.id}_${Date.now()}`,
      platform: platform.name,
      submittedAt: new Date(),
      estimatedVerificationTime: this.getEstimatedVerificationTime(platform),
    };
  }

  /**
   * Get sync job status
   */
  async getSyncJobStatus(syncJobId: string): Promise<SyncJob | null> {
    const data = await this.redis.get(`sync:job:${syncJobId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get directory metrics
   */
  async getMetrics(workspaceId: string): Promise<DirectoryMetrics> {
    const platforms = await this.getPlatforms();
    const submissions = await this.getSubmissions(workspaceId);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const submissionsToday = submissions.filter(s => s.createdAt >= today).length;
    const submissionsThisWeek = submissions.filter(s => s.createdAt >= weekAgo).length;
    const submissionsThisMonth = submissions.filter(s => s.createdAt >= monthAgo).length;

    const successfulSubmissions = submissions.filter(s => s.status === 'submitted');
    const successRate = submissions.length > 0 
      ? (successfulSubmissions.length / submissions.length) * 100 
      : 0;

    const averageSubmissionTime = successfulSubmissions.length > 0
      ? successfulSubmissions.reduce((sum, s) => {
          const duration = s.submittedAt ? s.submittedAt.getTime() - s.createdAt.getTime() : 0;
          return sum + duration;
        }, 0) / successfulSubmissions.length
      : 0;

    const topPerformingPlatforms = platforms
      .map(platform => {
        const platformSubmissions = submissions.filter(s => s.platformId === platform.id);
        const successfulPlatformSubmissions = platformSubmissions.filter(s => s.status === 'submitted');
        const platformSuccessRate = platformSubmissions.length > 0 
          ? (successfulPlatformSubmissions.length / platformSubmissions.length) * 100 
          : 0;

        return {
          platformId: platform.id,
          name: platform.name,
          submissionCount: platformSubmissions.length,
          successRate: platformSuccessRate,
        };
      })
      .filter(p => p.submissionCount > 0)
      .sort((a, b) => b.submissionCount - a.submissionCount)
      .slice(0, 5);

    return {
      totalPlatforms: platforms.length,
      activePlatforms: platforms.filter(p => p.status === 'active').length,
      submissionsToday,
      submissionsThisWeek,
      submissionsThisMonth,
      successRate: Math.round(successRate * 100) / 100,
      averageSubmissionTime: Math.round(averageSubmissionTime),
      topPerformingPlatforms,
    };
  }

  /**
   * Private helper methods
   */
  private async updateSyncJob(syncJobId: string, updates: Partial<SyncJob>): Promise<void> {
    const jobData = await this.redis.get(`sync:job:${syncJobId}`);
    if (!jobData) return;

    const job = JSON.parse(jobData);
    const updatedJob = { ...job, ...updates };

    await this.redis.setex(
      `sync:job:${syncJobId}`,
      86400,
      JSON.stringify(updatedJob)
    );
  }

  private async getSubmissions(workspaceId: string): Promise<DirectorySubmission[]> {
    // In a real implementation, this would query a database
    // For now, return empty array
    return [];
  }

  private getPriorityValue(priority: string): number {
    const priorities = {
      'low': 1,
      'medium': 5,
      'high': 10,
    };
    return (priorities as Record<string, number>)[priority] || 5;
  }

  private getEstimatedVerificationTime(platform: DirectoryPlatform): string {
    const times = {
      'google-business': '24-48 hours',
      'yelp': '1-3 days',
      'facebook-pages': 'Immediate',
      'linkedin-company': '1-2 days',
      'yellow-pages': '3-7 days',
      'better-business-bureau': '5-10 days',
    };
    return (times as Record<string, string>)[platform.id] || '1-3 days';
  }

  private generateSyncJobId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubmissionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


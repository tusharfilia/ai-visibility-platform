import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { createRedisClient } from '@ai-visibility/shared';

export interface JobDeduplicationConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  keyFields: string[]; // Fields to include in deduplication key
  ignoreFields: string[]; // Fields to ignore in deduplication key
}

export interface JobCacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  keyFields: string[]; // Fields to include in cache key
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  existingJobId?: string;
  cacheKey: string;
}

export interface CacheResult<T> {
  hit: boolean;
  data?: T;
  cacheKey: string;
}

@Injectable()
export class JobDeduplicationService {
  private redis: Redis;
  private deduplicationConfigs: Map<string, JobDeduplicationConfig> = new Map();
  private cacheConfigs: Map<string, JobCacheConfig> = new Map();

  constructor(private configService: ConfigService) {
    // BullMQ requires maxRetriesPerRequest: null for blocking commands
    this.redis = createRedisClient('JobDeduplicationService', { maxRetriesPerRequest: null });
    this.initializeConfigurations();
  }

  /**
   * Initialize deduplication and cache configurations
   */
  private initializeConfigurations(): void {
    // Prompt run jobs - deduplicate by prompt + engine + workspace
    this.deduplicationConfigs.set('runPrompt', {
      enabled: true,
      ttl: 3600, // 1 hour
      keyFields: ['workspaceId', 'promptId', 'engineId'],
      ignoreFields: ['timestamp', 'userId']
    });

    // Batch jobs - deduplicate by batch ID
    this.deduplicationConfigs.set('runBatch', {
      enabled: true,
      ttl: 7200, // 2 hours
      keyFields: ['workspaceId', 'batchId'],
      ignoreFields: ['timestamp', 'userId']
    });

    // Copilot jobs - deduplicate by workspace + alert type
    this.deduplicationConfigs.set('copilotPlanner', {
      enabled: true,
      ttl: 1800, // 30 minutes
      keyFields: ['workspaceId', 'alertType'],
      ignoreFields: ['timestamp', 'userId']
    });

    // Directory sync jobs - deduplicate by workspace + platform
    this.deduplicationConfigs.set('directorySync', {
      enabled: true,
      ttl: 1800, // 30 minutes
      keyFields: ['workspaceId', 'platform'],
      ignoreFields: ['timestamp', 'userId']
    });

    // Cache configurations
    this.cacheConfigs.set('runPrompt', {
      enabled: true,
      ttl: 86400, // 24 hours
      keyFields: ['workspaceId', 'promptId', 'engineId']
    });

    this.cacheConfigs.set('runBatch', {
      enabled: true,
      ttl: 43200, // 12 hours
      keyFields: ['workspaceId', 'batchId']
    });
  }

  /**
   * Check if job is duplicate
   */
  async checkDuplicate(
    jobName: string,
    jobData: any
  ): Promise<DeduplicationResult> {
    const config = this.deduplicationConfigs.get(jobName);
    
    if (!config || !config.enabled) {
      return {
        isDuplicate: false,
        cacheKey: ''
      };
    }

    const cacheKey = this.generateCacheKey(jobName, jobData, config);
    const existingJobId = await this.redis.get(cacheKey);

    if (existingJobId) {
      console.log(`Duplicate job detected: ${jobName} with key ${cacheKey}`);
      return {
        isDuplicate: true,
        existingJobId,
        cacheKey
      };
    }

    return {
      isDuplicate: false,
      cacheKey
    };
  }

  /**
   * Mark job as processed for deduplication
   */
  async markJobProcessed(
    jobName: string,
    jobData: any,
    jobId: string
  ): Promise<void> {
    const config = this.deduplicationConfigs.get(jobName);
    
    if (!config || !config.enabled) {
      return;
    }

    const cacheKey = this.generateCacheKey(jobName, jobData, config);
    await this.redis.setex(cacheKey, config.ttl, jobId);
    
    console.log(`Job marked as processed: ${jobName} with key ${cacheKey}`);
  }

  /**
   * Get cached job result
   */
  async getCachedResult<T>(
    jobName: string,
    jobData: any
  ): Promise<CacheResult<T>> {
    const config = this.cacheConfigs.get(jobName);
    
    if (!config || !config.enabled) {
      return {
        hit: false,
        cacheKey: ''
      };
    }

    const cacheKey = this.generateCacheKey(jobName, jobData, config);
    const cachedData = await this.redis.get(cacheKey);

    if (cachedData) {
      console.log(`Cache hit for job: ${jobName} with key ${cacheKey}`);
      return {
        hit: true,
        data: JSON.parse(cachedData),
        cacheKey
      };
    }

    return {
      hit: false,
      cacheKey
    };
  }

  /**
   * Cache job result
   */
  async cacheResult<T>(
    jobName: string,
    jobData: any,
    result: T
  ): Promise<void> {
    const config = this.cacheConfigs.get(jobName);
    
    if (!config || !config.enabled) {
      return;
    }

    const cacheKey = this.generateCacheKey(jobName, jobData, config);
    await this.redis.setex(cacheKey, config.ttl, JSON.stringify(result));
    
    console.log(`Result cached for job: ${jobName} with key ${cacheKey}`);
  }

  /**
   * Generate cache key for job
   */
  private generateCacheKey(
    jobName: string,
    jobData: any,
    config: JobDeduplicationConfig | JobCacheConfig
  ): string {
    // Extract relevant fields
    const keyData: any = {};
    
    config.keyFields.forEach(field => {
      if (jobData[field] !== undefined) {
        keyData[field] = jobData[field];
      }
    });

    // Remove ignored fields
    // @ts-ignore - Type narrowing issue
    config.ignoreFields?.forEach(field => {
      delete keyData[field];
    });

    // Generate hash
    const dataString = JSON.stringify(keyData, Object.keys(keyData).sort());
    const hash = createHash('sha256').update(dataString).digest('hex');
    
    return `job:${jobName}:${hash}`;
  }

  /**
   * Invalidate cache for job
   */
  async invalidateCache(jobName: string, jobData: any): Promise<void> {
    const config = this.cacheConfigs.get(jobName);
    
    if (!config || !config.enabled) {
      return;
    }

    const cacheKey = this.generateCacheKey(jobName, jobData, config);
    await this.redis.del(cacheKey);
    
    console.log(`Cache invalidated for job: ${jobName} with key ${cacheKey}`);
  }

  /**
   * Get deduplication statistics
   */
  async getDeduplicationStats(): Promise<{
    totalKeys: number;
    keysByJob: Record<string, number>;
    memoryUsage: number;
  }> {
    const keys = await this.redis.keys('job:*');
    const keysByJob: Record<string, number> = {};
    let totalMemory = 0;

    for (const key of keys) {
      const parts = key.split(':');
      if (parts.length >= 2) {
        const jobName = parts[1];
        keysByJob[jobName] = (keysByJob[jobName] || 0) + 1;
      }

      // Get memory usage for key
      // @ts-ignore - Redis command type issue
      const memory = await this.redis.memory('USAGE', key);
      totalMemory += memory;
    }

    return {
      totalKeys: keys.length,
      keysByJob,
      memoryUsage: totalMemory
    };
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredEntries(): Promise<number> {
    const keys = await this.redis.keys('job:*');
    let cleanedCount = 0;

    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -1) {
        // Key has no expiration, set default TTL
        await this.redis.expire(key, 3600);
      } else if (ttl === -2) {
        // Key has expired, remove it
        await this.redis.del(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned ${cleanedCount} expired cache entries`);
    }

    return cleanedCount;
  }

  /**
   * Add custom deduplication configuration
   */
  addDeduplicationConfig(jobName: string, config: JobDeduplicationConfig): void {
    this.deduplicationConfigs.set(jobName, config);
    console.log(`Deduplication config added for job type: ${jobName}`);
  }

  /**
   * Add custom cache configuration
   */
  addCacheConfig(jobName: string, config: JobCacheConfig): void {
    this.cacheConfigs.set(jobName, config);
    console.log(`Cache config added for job type: ${jobName}`);
  }

  /**
   * Get all deduplication configurations
   */
  getDeduplicationConfigs(): Map<string, JobDeduplicationConfig> {
    return new Map(this.deduplicationConfigs);
  }

  /**
   * Get all cache configurations
   */
  getCacheConfigs(): Map<string, JobCacheConfig> {
    return new Map(this.cacheConfigs);
  }

  /**
   * Process job with deduplication and caching
   */
  async processJobWithDeduplication<T>(
    jobName: string,
    jobData: any,
    processor: () => Promise<T>
  ): Promise<{
    result: T;
    fromCache: boolean;
    wasDuplicate: boolean;
  }> {
    // Check for duplicates
    const duplicateCheck = await this.checkDuplicate(jobName, jobData);
    if (duplicateCheck.isDuplicate) {
      throw new Error(`Duplicate job detected: ${duplicateCheck.existingJobId}`);
    }

    // Check cache
    const cacheCheck = await this.getCachedResult<T>(jobName, jobData);
    if (cacheCheck.hit) {
      return {
        result: cacheCheck.data!,
        fromCache: true,
        wasDuplicate: false
      };
    }

    // Process job
    const result = await processor();

    // Cache result
    await this.cacheResult(jobName, jobData, result);

    // Mark as processed for deduplication
    await this.markJobProcessed(jobName, jobData, 'processed');

    return {
      result,
      fromCache: false,
      wasDuplicate: false
    };
  }
}


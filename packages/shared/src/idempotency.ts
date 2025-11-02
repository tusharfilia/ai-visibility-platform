/**
 * Idempotency key utilities
 * Provides utilities for generating and managing idempotency keys
 */

import { createHash, randomBytes } from 'crypto';

export interface IdempotencyKeyOptions {
  workspaceId: string;
  userId: string;
  operation: string;
  content?: string;
}

export class IdempotencyKeyGenerator {
  /**
   * Generate a deterministic idempotency key
   * Same inputs will always produce the same key
   */
  static generateDeterministic(options: IdempotencyKeyOptions): string {
    const { workspaceId, userId, operation, content } = options;
    
    const input = `${workspaceId}:${userId}:${operation}:${content || ''}`;
    const hash = createHash('sha256').update(input).digest('hex');
    
    return `idem_${hash.substring(0, 16)}`;
  }

  /**
   * Generate a random idempotency key
   * Useful for operations that should be unique
   */
  static generateRandom(): string {
    const random = randomBytes(8).toString('hex');
    return `idem_${random}`;
  }

  /**
   * Generate idempotency key for content-based operations
   * Uses content hash to ensure same content = same key
   */
  static generateForContent(content: string, operation: string): string {
    const hash = createHash('sha256').update(content).digest('hex');
    return `idem_${operation}_${hash.substring(0, 16)}`;
  }

  /**
   * Generate idempotency key for time-based operations
   * Includes timestamp for operations that should be unique per time period
   */
  static generateTimeBased(options: IdempotencyKeyOptions, timeWindow: number = 3600): string {
    const { workspaceId, userId, operation } = options;
    const timeSlot = Math.floor(Date.now() / (timeWindow * 1000));
    
    const input = `${workspaceId}:${userId}:${operation}:${timeSlot}`;
    const hash = createHash('sha256').update(input).digest('hex');
    
    return `idem_${hash.substring(0, 16)}`;
  }
}

export interface IdempotencyResult<T = any> {
  isDuplicate: boolean;
  result?: T;
  key: string;
}

export class IdempotencyManager {
  private redis: any;

  constructor(redis: any) {
    this.redis = redis;
  }

  /**
   * Check if operation was already performed
   */
  async checkIdempotency<T>(key: string): Promise<IdempotencyResult<T>> {
    try {
      const cached = await this.redis.get(key);
      
      if (cached) {
        const result = JSON.parse(cached);
        return {
          isDuplicate: true,
          result: result,
          key
        };
      }
      
      return {
        isDuplicate: false,
        key
      };
    } catch (error) {
      console.error('Idempotency check error:', error);
      return {
        isDuplicate: false,
        key
      };
    }
  }

  /**
   * Store operation result
   */
  async storeResult<T>(key: string, result: T, ttl: number = 86400): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(result));
    } catch (error) {
      console.error('Idempotency store error:', error);
    }
  }

  /**
   * Create idempotency key for BullMQ job
   */
  static createJobIdempotencyKey(workspaceId: string, jobType: string, content: string): string {
    return `job:${workspaceId}:${jobType}:${createHash('sha256').update(content).digest('hex').substring(0, 16)}`;
  }

  /**
   * Create idempotency key for API request
   */
  static createApiIdempotencyKey(workspaceId: string, method: string, path: string, content: string): string {
    const input = `${workspaceId}:${method}:${path}:${content}`;
    return `api:${createHash('sha256').update(input).digest('hex').substring(0, 16)}`;
  }
}

/**
 * Idempotency decorator for methods
 */
export function Idempotent(options: {
  keyGenerator?: (args: any[]) => string;
  ttl?: number;
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const key = options.keyGenerator ? options.keyGenerator(args) : IdempotencyKeyGenerator.generateRandom();
      const ttl = options.ttl || 86400;
      
      // Check if already executed
      const manager = new IdempotencyManager((this as any).redis);
      const check = await manager.checkIdempotency(key);
      
      if (check.isDuplicate) {
        return check.result;
      }
      
      // Execute method
      const result = await method.apply(this, args);
      
      // Store result
      await manager.storeResult(key, result, ttl);
      
      return result;
    };
  };
}



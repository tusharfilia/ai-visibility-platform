/**
 * Idempotency middleware for HTTP requests
 * Prevents duplicate operations using X-Idempotency-Key header
 */

import { Injectable, NestMiddleware, BadRequestException, ConflictException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { WorkspaceContextService } from './workspace-context';
import { createRedisClient } from '@ai-visibility/shared';

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private redis: Redis;

  constructor(private workspaceContext: WorkspaceContextService) {
    this.redis = createRedisClient('IdempotencyMiddleware');
  }

  async use(req: Request, res: Response, next: NextFunction) {
    // Only apply to write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers['x-idempotency-key'] as string;
    
    if (!idempotencyKey) {
      throw new BadRequestException('X-Idempotency-Key header required for write operations');
    }

    try {
      const workspaceId = this.workspaceContext.getWorkspaceId();
      const route = `${req.method}:${req.route?.path || req.path}`;
      const cacheKey = `idempotency:${workspaceId}:${route}:${idempotencyKey}`;
      
      // Check if request was already processed
      const existingResponse = await this.redis.get(cacheKey);
      
      if (existingResponse) {
        const { statusCode, headers, body } = JSON.parse(existingResponse);
        
        // Return cached response
        res.status(statusCode);
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });
        res.json(body);
        return;
      }

      // Store request fingerprint for deduplication
      const requestFingerprint = this.createRequestFingerprint(req);
      const lockKey = `lock:${cacheKey}`;
      
      // Try to acquire lock
      const lockAcquired = await this.redis.set(lockKey, '1', 'EX', 30, 'NX');
      
      if (!lockAcquired) {
        throw new ConflictException('Request is being processed');
      }

      // Store request fingerprint
      await this.redis.setex(`fingerprint:${cacheKey}`, 3600, requestFingerprint);
      
      // Add response interceptor
      const originalJson = res.json;
      const originalStatus = res.status;
      let responseData: any = null;
      let statusCode: number = 200;

      res.status = (code: number) => {
        statusCode = code;
        return res;
      };

      res.json = (data: any) => {
        responseData = data;
        
        // Cache successful responses
        if (statusCode >= 200 && statusCode < 300) {
          const response = {
            statusCode,
            headers: res.getHeaders(),
            body: data
          };
          
          this.redis.setex(cacheKey, 86400, JSON.stringify(response)); // 24 hour TTL
        }
        
        // Release lock
        this.redis.del(lockKey);
        
        return originalJson.call(res, data);
      };

      next();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      
      // Log error but don't block request
      console.error('Idempotency middleware error:', error);
      next();
    }
  }

  private createRequestFingerprint(req: Request): string {
    const { method, path, body, query } = req;
    const fingerprint = {
      method,
      path,
      body: body ? JSON.stringify(body) : null,
      query: query ? JSON.stringify(query) : null
    };
    
    return JSON.stringify(fingerprint);
  }

  /**
   * Clean up expired idempotency keys
   */
  async cleanupExpiredKeys(): Promise<void> {
    const pattern = 'idempotency:*';
    const keys = await this.redis.keys(pattern);
    
    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -1) { // No expiration set
        await this.redis.del(key);
      }
    }
  }
}



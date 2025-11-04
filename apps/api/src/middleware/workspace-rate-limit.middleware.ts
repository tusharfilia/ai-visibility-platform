import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../modules/database/prisma.service';

export interface WorkspaceTier {
  FREE: 'FREE';
  INSIGHTS: 'INSIGHTS';
  COPILOT: 'COPILOT';
}

export interface TierLimits {
  FREE: {
    requestsPerHour: number;
    scansPerDay: number;
    members: number;
    storageGB: number;
  };
  INSIGHTS: {
    requestsPerHour: number;
    scansPerDay: number;
    members: number;
    storageGB: number;
  };
  COPILOT: {
    requestsPerHour: number;
    scansPerDay: number;
    members: number;
    storageGB: number;
  };
}

@Injectable()
export class WorkspaceRateLimitMiddleware implements NestMiddleware {
  private readonly tierLimits: TierLimits = {
    FREE: {
      requestsPerHour: 100,
      scansPerDay: 10,
      members: 3,
      storageGB: 1
    },
    INSIGHTS: {
      requestsPerHour: 500,
      scansPerDay: 100,
      members: 10,
      storageGB: 10
    },
    COPILOT: {
      requestsPerHour: 2000,
      scansPerDay: 1000,
      members: 50,
      storageGB: 100
    }
  };

  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const workspaceId = req.headers['x-workspace-id'] as string;
    const userId = req.headers['x-user-id'] as string;

    if (!workspaceId) {
      return next();
    }

    try {
      // Get workspace tier
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { tier: true }
      });

      if (!workspace) {
        return res.status(404).json({
          ok: false,
          error: {
            code: 'WORKSPACE_NOT_FOUND',
            message: 'Workspace not found'
          }
        });
      }

      const tier = workspace.tier as keyof TierLimits;
      const limits = this.tierLimits[tier];

      // Check rate limits based on endpoint
      const endpoint = req.path;
      const method = req.method;

      if (this.isRateLimitedEndpoint(endpoint, method)) {
        const rateLimitKey = this.getRateLimitKey(workspaceId, endpoint, method);
        const isRateLimited = await this.checkRateLimit(rateLimitKey, limits);

        if (isRateLimited) {
          return res.status(429).json({
            ok: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Rate limit exceeded for ${tier} tier`,
              retryAfter: 3600 // 1 hour
            }
          });
        }
      }

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limits.requestsPerHour.toString());
      res.setHeader('X-RateLimit-Remaining', '0'); // Will be calculated by Redis
      res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + 3600);

      // Add workspace context to request
      (req as any).workspaceTier = tier;
      (req as any).workspaceLimits = limits;

      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      next();
    }
  }

  /**
   * Check if endpoint should be rate limited
   */
  private isRateLimitedEndpoint(endpoint: string, method: string): boolean {
    // Rate limit POST, PUT, DELETE operations
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
      return true;
    }

    // Rate limit specific GET endpoints
    const rateLimitedEndpoints = [
      '/v1/prompts/discover',
      '/v1/citations/opportunities/analyze',
      '/v1/alerts/hallucinations/detect',
      '/v1/public/analyze'
    ];

    return rateLimitedEndpoints.some(limitedEndpoint => 
      endpoint.startsWith(limitedEndpoint)
    );
  }

  /**
   * Get rate limit key for Redis
   */
  private getRateLimitKey(workspaceId: string, endpoint: string, method: string): string {
    const hour = Math.floor(Date.now() / (1000 * 60 * 60));
    return `rate_limit:${workspaceId}:${method}:${endpoint}:${hour}`;
  }

  /**
   * Check rate limit using Redis
   */
  private async checkRateLimit(key: string, limits: TierLimits[keyof TierLimits]): Promise<boolean> {
    // This would use Redis to implement sliding window rate limiting
    // For now, we'll use a simple in-memory approach
    // In production, this should use Redis with proper sliding window algorithm
    
    const currentCount = await this.getCurrentCount(key);
    return currentCount >= limits.requestsPerHour;
  }

  /**
   * Get current request count for key
   */
  private async getCurrentCount(key: string): Promise<number> {
    // This would query Redis for the current count
    // For now, return 0 to allow all requests
    // In production, implement proper Redis-based counting
    return 0;
  }

  /**
   * Increment request count
   */
  async incrementRequestCount(workspaceId: string, endpoint: string, method: string): Promise<void> {
    const key = this.getRateLimitKey(workspaceId, endpoint, method);
    
    // This would increment the count in Redis
    // For now, we'll just log it
    console.log(`Incrementing rate limit for ${key}`);
  }

  /**
   * Get workspace tier limits
   */
  getTierLimits(tier: keyof TierLimits): TierLimits[keyof TierLimits] {
    return this.tierLimits[tier];
  }

  /**
   * Check if workspace can perform action
   */
  async canPerformAction(
    workspaceId: string,
    action: 'scan' | 'member' | 'storage',
    count: number = 1
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { tier: true }
      });

      if (!workspace) {
        return { allowed: false, reason: 'Workspace not found' };
      }

      const tier = workspace.tier as keyof TierLimits;
      const limits = this.tierLimits[tier];

      switch (action) {
        case 'scan':
          // Check daily scan limit
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const todayScans = await this.prisma.promptRun.count({
            where: {
              workspaceId,
              startedAt: { gte: today }
            }
          });

          if (todayScans + count > limits.scansPerDay) {
            return { 
              allowed: false, 
              reason: `Daily scan limit exceeded (${limits.scansPerDay})` 
            };
          }
          break;

        case 'member':
          const memberCount = await this.prisma.workspaceMember.count({
            where: { workspaceId }
          });

          if (memberCount + count > limits.members) {
            return { 
              allowed: false, 
              reason: `Member limit exceeded (${limits.members})` 
            };
          }
          break;

        case 'storage':
          // This would check actual storage usage
          // For now, we'll assume it's within limits
          break;
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking action permission:', error);
      return { allowed: false, reason: 'Internal error' };
    }
  }
}


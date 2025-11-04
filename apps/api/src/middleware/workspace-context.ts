/**
 * Workspace context service for request-scoped isolation
 * Provides workspace context throughout the request lifecycle
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

export interface WorkspaceContext {
  workspaceId: string;
  userId: string;
  userRole: string;
  tier: 'free' | 'insights' | 'copilot' | 'enterprise';
}

@Injectable()
export class WorkspaceContextService {
  private context: WorkspaceContext | null = null;

  setContext(context: WorkspaceContext) {
    this.context = context;
  }

  getContext(): WorkspaceContext {
    if (!this.context) {
      throw new Error('Workspace context not set');
    }
    return this.context;
  }

  getWorkspaceId(): string {
    return this.getContext().workspaceId;
  }

  getUserId(): string {
    return this.getContext().userId;
  }

  getUserRole(): string {
    return this.getContext().userRole;
  }

  getTier(): string {
    return this.getContext().tier;
  }

  isWorkspaceMember(workspaceId: string): boolean {
    return this.getWorkspaceId() === workspaceId;
  }

  hasRole(role: string): boolean {
    return this.getUserRole() === role;
  }

  isAdmin(): boolean {
    return this.hasRole('admin') || this.hasRole('owner');
  }

  canAccessWorkspace(workspaceId: string): boolean {
    return this.isWorkspaceMember(workspaceId) && this.isAdmin();
  }

  clearContext() {
    this.context = null;
  }
}

/**
 * Workspace access guard
 * Ensures user has access to the requested workspace
 */
@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(private workspaceContext: WorkspaceContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const workspaceId = request.params.workspaceId || request.body.workspaceId;

    if (!workspaceId) {
      throw new ForbiddenException('Workspace ID required');
    }

    const userContext = this.workspaceContext.getContext();
    
    if (!this.workspaceContext.isWorkspaceMember(workspaceId)) {
      throw new ForbiddenException('Access denied to workspace');
    }

    return true;
  }
}

/**
 * Workspace context middleware
 * Extracts workspace context from JWT token and request
 */
export function createWorkspaceContextMiddleware(workspaceContext: WorkspaceContextService) {
  return (req: Request, res: any, next: any) => {
    try {
      // Extract workspace context from JWT token
      const user = (req as any).user;
      if (!user || !user.workspaceId) {
        throw new ForbiddenException('Invalid workspace context');
      }

      const context: WorkspaceContext = {
        workspaceId: user.workspaceId,
        userId: user.sub,
        userRole: user.role || 'member',
        tier: user.tier || 'free'
      };

      workspaceContext.setContext(context);
      next();
    } catch (error) {
      next(error);
    }
  };
}



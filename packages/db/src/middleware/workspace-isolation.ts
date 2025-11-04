/**
 * Prisma middleware for automatic workspace isolation
 * Ensures all queries are scoped to the current workspace
 * NOTE: This middleware is not currently used as we're using pg directly instead of Prisma Client
 * It's kept for reference but will need to be adapted for pg if needed in the future
 */

export function createWorkspaceIsolationMiddleware(workspaceId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (params: any, next: any) => {
    // Skip middleware for system operations
    if (params.model === 'User' || params.model === 'Workspace') {
      return next(params);
    }

    // Add workspaceId filter to all queries
    if (params.action === 'findMany' || params.action === 'findFirst' || params.action === 'findUnique') {
      if (!params.args.where) {
        params.args.where = { workspaceId };
      } else {
        params.args.where = {
          AND: [params.args.where, { workspaceId }]
        };
      }
    }

    // For create operations, ensure workspaceId is set
    if (params.action === 'create' || params.action === 'createMany') {
      if (params.args.data) {
        if (Array.isArray(params.args.data)) {
          params.args.data = params.args.data.map((item: any) => ({
            ...item,
            workspaceId
          }));
        } else {
          params.args.data = {
            ...params.args.data,
            workspaceId
          };
        }
      }
    }

    // For update operations, ensure workspaceId filter
    if (params.action === 'update' || params.action === 'updateMany' || params.action === 'delete' || params.action === 'deleteMany') {
      if (!params.args.where) {
        params.args.where = { workspaceId };
      } else {
        params.args.where = {
          AND: [params.args.where, { workspaceId }]
        };
      }
    }

    return next(params);
  };
}

/**
 * Workspace isolation middleware factory
 * Creates middleware with workspace context
 */
export class WorkspaceIsolationMiddleware {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  getMiddleware() {
    return createWorkspaceIsolationMiddleware(this.workspaceId);
  }

  /**
   * Verify workspace access for a resource
   */
  async verifyWorkspaceAccess(prisma: any, model: string, resourceId: string): Promise<boolean> {
    try {
      const resource = await (prisma as any)[model].findFirst({
        where: {
          id: resourceId,
          workspaceId: this.workspaceId
        }
      });
      return !!resource;
    } catch (error) {
      return false;
    }
  }
}



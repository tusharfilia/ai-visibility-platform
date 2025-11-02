import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../modules/database/prisma.service';

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const workspaceId = request.params.workspaceId || request.headers['x-workspace-id'];
    const userId = request.user?.id || request.headers['x-user-id'];

    if (!workspaceId || !userId) {
      return false;
    }

    try {
      // Check if user is a member of the workspace
      const member = await this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId
        }
      });

      return !!member;
    } catch (error) {
      console.error('Workspace access check failed:', error);
      return false;
    }
  }
}
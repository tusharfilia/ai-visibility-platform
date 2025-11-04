import { Injectable } from '@nestjs/common';
import { PrismaService } from '../modules/database/prisma.service';

@Injectable()
export class WorkspaceDeletionWorker {
  constructor(private prisma: PrismaService) {}

  /**
   * Process workspace deletion job
   */
  async processDeletionJob(workspaceId: string): Promise<void> {
    try {
      console.log(`Processing deletion job for workspace ${workspaceId}`);

      // Verify deletion request exists and is scheduled
      const deletionStatus = await this.getDeletionStatus(workspaceId);
      
      if (deletionStatus.status !== 'scheduled') {
        console.log(`Deletion not scheduled for workspace ${workspaceId}, skipping`);
        return;
      }

      // Check if grace period has passed
      if (deletionStatus.scheduledFor && deletionStatus.scheduledFor > new Date()) {
        console.log(`Grace period not yet passed for workspace ${workspaceId}`);
        return;
      }

      // Execute deletion
      await this.executeWorkspaceDeletion(workspaceId);

      console.log(`Deletion job completed for workspace ${workspaceId}`);
    } catch (error) {
      console.error(`Deletion job failed for workspace ${workspaceId}:`, error);
      throw error;
    }
  }

  /**
   * Execute workspace deletion
   */
  private async executeWorkspaceDeletion(workspaceId: string): Promise<void> {
    try {
      console.log(`Executing deletion for workspace ${workspaceId}`);

      // Delete in order to respect foreign key constraints
      const deletionOrder = [
        'Mention',
        'Citation', 
        'Answer',
        'PromptRun',
        'Prompt',
        'Engine',
        'Connection',
        'Alert',
        'Report',
        'WorkspaceMember',
        'WorkspaceInvitation',
        'WorkspaceSettings',
        'Workspace'
      ];

      for (const table of deletionOrder) {
        try {
          const deleteQuery = `DELETE FROM "${table}" WHERE "workspaceId" = $1`;
          const result = await this.prisma.$executeRaw(deleteQuery, workspaceId);
          console.log(`Deleted ${result} records from ${table}`);
        } catch (error) {
          console.error(`Failed to delete from ${table}:`, error);
          // Continue with other tables
        }
      }

      // Log the deletion completion
      await this.prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: 'system',
          action: 'WORKSPACE_DELETION_COMPLETED',
          payload: {
            deletedAt: new Date(),
            tablesDeleted: deletionOrder
          },
          createdAt: new Date()
        }
      });

      console.log(`Workspace deletion completed for ${workspaceId}`);
    } catch (error) {
      console.error(`Workspace deletion failed for ${workspaceId}:`, error);
      
      // Log the failure
      await this.prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: 'system',
          action: 'WORKSPACE_DELETION_FAILED',
          payload: {
            error: error.message,
            failedAt: new Date()
          },
          createdAt: new Date()
        }
      });

      throw error;
    }
  }

  /**
   * Get deletion status for workspace
   */
  private async getDeletionStatus(workspaceId: string): Promise<{
    status: 'none' | 'pending' | 'scheduled' | 'completed';
    scheduledFor?: Date;
  }> {
    const deletionLogs = await this.prisma.auditLog.findMany({
      where: {
        workspaceId,
        action: {
          in: ['GDPR_DELETION_REQUESTED', 'WORKSPACE_DELETION_COMPLETED', 'GDPR_DELETION_CANCELLED']
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (deletionLogs.length === 0) {
      return { status: 'none' };
    }

    const latestLog = deletionLogs[0];

    switch (latestLog.action) {
      case 'GDPR_DELETION_REQUESTED':
        const scheduledFor = new Date(latestLog.createdAt);
        scheduledFor.setDate(scheduledFor.getDate() + 7);
        
        return {
          status: 'scheduled',
          scheduledFor
        };

      case 'WORKSPACE_DELETION_COMPLETED':
        return { status: 'completed' };

      case 'GDPR_DELETION_CANCELLED':
        return { status: 'none' };

      default:
        return { status: 'none' };
    }
  }

  /**
   * Clean up old deletion logs
   */
  async cleanupDeletionLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep logs for 90 days

    const deletedLogs = await this.prisma.auditLog.deleteMany({
      where: {
        action: {
          in: ['GDPR_DELETION_REQUESTED', 'WORKSPACE_DELETION_COMPLETED', 'GDPR_DELETION_CANCELLED']
        },
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    console.log(`Cleaned up ${deletedLogs.count} old deletion logs`);
    return deletedLogs.count;
  }

  /**
   * Get pending deletions
   */
  async getPendingDeletions(): Promise<Array<{
    workspaceId: string;
    scheduledFor: Date;
    requestedAt: Date;
  }>> {
    const pendingDeletions = await this.prisma.auditLog.findMany({
      where: {
        action: 'GDPR_DELETION_REQUESTED',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return pendingDeletions.map(log => {
      const scheduledFor = new Date(log.createdAt);
      scheduledFor.setDate(scheduledFor.getDate() + 7);
      
      return {
        workspaceId: log.workspaceId,
        scheduledFor,
        requestedAt: log.createdAt
      };
    });
  }
}


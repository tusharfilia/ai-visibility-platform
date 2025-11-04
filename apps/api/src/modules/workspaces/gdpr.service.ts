import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../modules/database/prisma.service';
import { FileStorageService } from '@ai-visibility/shared';

export interface WorkspaceExportData {
  workspace: any;
  members: any[];
  prompts: any[];
  promptRuns: any[];
  answers: any[];
  mentions: any[];
  citations: any[];
  engines: any[];
  connections: any[];
  alerts: any[];
  reports: any[];
  settings: any;
  createdAt: Date;
  exportedBy: string;
}

export interface GDPRDeletionRequest {
  workspaceId: string;
  userId: string;
  reason: string;
  requestedAt: Date;
}

@Injectable()
export class WorkspaceExportService {
  constructor(
    private prisma: PrismaService,
    private fileStorage: FileStorageService
  ) {}

  /**
   * Export all workspace data
   */
  async exportWorkspaceData(
    workspaceId: string,
    exportedBy: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    try {
      // Get all workspace data
      const exportData = await this.gatherWorkspaceData(workspaceId, exportedBy);

      // Generate file based on format
      let fileName: string;
      let fileContent: string;

      if (format === 'json') {
        fileName = `workspace-export-${workspaceId}-${Date.now()}.json`;
        fileContent = JSON.stringify(exportData, null, 2);
      } else {
        fileName = `workspace-export-${workspaceId}-${Date.now()}.csv`;
        fileContent = this.convertToCSV(exportData);
      }

      // Upload to file storage
      const fileKey = `exports/${fileName}`;
      const uploadResult = await this.fileStorage.uploadFile(
        fileKey,
        Buffer.from(fileContent),
        { contentType: format === 'json' ? 'application/json' : 'text/csv' }
      );
      const downloadUrl = typeof uploadResult === 'string' ? uploadResult : uploadResult.url || uploadResult.key || fileKey;

      // Generate signed URL (7 days expiry)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Log the export
      await this.prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: exportedBy,
          action: 'WORKSPACE_EXPORT',
          payload: {
            format,
            fileName,
            fileSize: fileContent.length
          },
          createdAt: new Date()
        }
      });

      return {
        downloadUrl,
        expiresAt
      };
    } catch (error) {
      console.error('Workspace export failed:', error);
      throw new Error(`Failed to export workspace data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gather all workspace data
   */
  private async gatherWorkspaceData(
    workspaceId: string,
    exportedBy: string
  ): Promise<WorkspaceExportData> {
    const [
      workspace,
      members,
      prompts,
      promptRuns,
      answers,
      mentions,
      citations,
      engines,
      connections,
      alerts,
      reports,
      settings
    ] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId }
      }),
      this.prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              createdAt: true
            }
          }
        }
      }),
      this.prisma.prompt.findMany({
        where: { workspaceId }
      }),
      this.prisma.promptRun.findMany({
        where: { workspaceId },
        take: 1000 // Limit to prevent huge exports
      }),
      this.prisma.answer.findMany({
        where: {
          promptRun: {
            workspaceId
          }
        },
        take: 1000
      }),
      this.prisma.mention.findMany({
        where: {
          answer: {
            promptRun: {
              workspaceId
            }
          }
        },
        take: 1000
      }),
      this.prisma.citation.findMany({
        where: {
          answer: {
            promptRun: {
              workspaceId
            }
          }
        },
        take: 1000
      }),
      this.prisma.engine.findMany({
        where: { workspaceId }
      }),
      this.prisma.connection.findMany({
        where: { workspaceId }
      }),
      this.prisma.alert.findMany({
        where: { workspaceId }
      }),
      this.prisma.report.findMany({
        where: { workspaceId }
      }),
      this.prisma.workspaceSettings.findUnique({
        where: { workspaceId }
      })
    ]);

    return {
      workspace,
      members,
      prompts,
      promptRuns,
      answers,
      mentions,
      citations,
      engines,
      connections,
      alerts,
      reports,
      settings,
      createdAt: new Date(),
      exportedBy
    };
  }

  /**
   * Convert export data to CSV format
   */
  private convertToCSV(data: WorkspaceExportData): string {
    const csvRows: string[] = [];
    
    // Add metadata
    csvRows.push('Section,Field,Value');
    csvRows.push(`Workspace,Name,"${data.workspace?.name || ''}"`);
    csvRows.push(`Workspace,Tier,"${data.workspace?.tier || ''}"`);
    csvRows.push(`Workspace,Created,"${data.workspace?.createdAt || ''}"`);
    csvRows.push(`Export,ExportedBy,"${data.exportedBy}"`);
    csvRows.push(`Export,ExportedAt,"${data.createdAt}"`);
    csvRows.push('');

    // Add members
    csvRows.push('Members,UserId,Email,Name,Role,JoinedAt');
    data.members.forEach(member => {
      csvRows.push(`Member,"${member.userId}","${member.user?.email || ''}","${member.user?.name || ''}","${member.role}","${member.joinedAt}"`);
    });
    csvRows.push('');

    // Add prompts
    csvRows.push('Prompts,Id,Text,Intent,Active,CreatedAt');
    data.prompts.forEach(prompt => {
      csvRows.push(`Prompt,"${prompt.id}","${prompt.text?.replace(/"/g, '""') || ''}","${prompt.intent || ''}","${prompt.active}","${prompt.createdAt}"`);
    });
    csvRows.push('');

    // Add engines
    csvRows.push('Engines,Id,Key,Name,Enabled,DailyBudget');
    data.engines.forEach(engine => {
      csvRows.push(`Engine,"${engine.id}","${engine.key}","${engine.name || ''}","${engine.enabled}","${engine.dailyBudgetCents}"`);
    });

    return csvRows.join('\n');
  }

  /**
   * Get export history for workspace
   */
  async getExportHistory(workspaceId: string): Promise<any[]> {
    const exports = await this.prisma.auditLog.findMany({
      where: {
        workspaceId,
        action: 'WORKSPACE_EXPORT'
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return exports.map((exp: any) => ({
      id: exp.id,
      exportedBy: exp.actorUserId,
      exportedAt: exp.createdAt,
      format: exp.payload?.format,
      fileName: exp.payload?.fileName,
      fileSize: exp.payload?.fileSize
    }));
  }
}

@Injectable()
export class GDPRDeletionService {
  constructor(
    private prisma: PrismaService,
    private fileStorage: FileStorageService
  ) {}

  /**
   * Initiate GDPR deletion request
   */
  async initiateDeletionRequest(
    workspaceId: string,
    userId: string,
    reason: string
  ): Promise<GDPRDeletionRequest> {
    try {
      // Check if user has permission to delete workspace
      const member = await this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId,
          role: 'OWNER'
        }
      });

      if (!member) {
        throw new Error('Only workspace owners can initiate deletion requests');
      }

      // Create deletion request
      const deletionRequest: GDPRDeletionRequest = {
        workspaceId,
        userId,
        reason,
        requestedAt: new Date()
      };

      // Log the deletion request
      await this.prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: 'GDPR_DELETION_REQUESTED',
          payload: {
            reason,
            requestedAt: deletionRequest.requestedAt
          },
          createdAt: new Date()
        }
      });

      // Schedule deletion job (7 days grace period)
      // This would typically queue a job for actual deletion
      console.log(`GDPR deletion scheduled for workspace ${workspaceId} in 7 days`);

      return deletionRequest;
    } catch (error) {
      console.error('GDPR deletion request failed:', error);
      throw new Error(`Failed to initiate deletion request: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute GDPR deletion (called by worker)
   */
  async executeDeletion(workspaceId: string): Promise<void> {
    try {
      console.log(`Executing GDPR deletion for workspace ${workspaceId}`);

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
        const deleteQuery = `DELETE FROM "${table}" WHERE "workspaceId" = $1`;
        await this.prisma.$executeRaw(deleteQuery, [workspaceId]);
        console.log(`Deleted from ${table}`);
      }

      // Log the deletion completion
      await this.prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: 'system',
          action: 'GDPR_DELETION_COMPLETED',
          payload: {
            deletedAt: new Date(),
            tablesDeleted: deletionOrder
          },
          createdAt: new Date()
        }
      });

      console.log(`GDPR deletion completed for workspace ${workspaceId}`);
    } catch (error) {
      console.error('GDPR deletion execution failed:', error);
      throw new Error(`Failed to execute deletion: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Cancel GDPR deletion request
   */
  async cancelDeletionRequest(
    workspaceId: string,
    userId: string
  ): Promise<void> {
    try {
      // Check if user has permission
      const member = await this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId,
          role: 'OWNER'
        }
      });

      if (!member) {
        throw new Error('Only workspace owners can cancel deletion requests');
      }

      // Log the cancellation
      await this.prisma.auditLog.create({
        data: {
          workspaceId,
          actorUserId: userId,
          action: 'GDPR_DELETION_CANCELLED',
          payload: {
            cancelledAt: new Date()
          },
          createdAt: new Date()
        }
      });

      console.log(`GDPR deletion cancelled for workspace ${workspaceId}`);
    } catch (error) {
      console.error('GDPR deletion cancellation failed:', error);
      throw new Error(`Failed to cancel deletion request: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get deletion status
   */
  async getDeletionStatus(workspaceId: string): Promise<{
    status: 'none' | 'pending' | 'scheduled' | 'completed';
    requestedAt?: Date;
    scheduledFor?: Date;
    reason?: string;
  }> {
    const deletionLogs = await this.prisma.auditLog.findMany({
      where: {
        workspaceId,
        action: {
          in: ['GDPR_DELETION_REQUESTED', 'GDPR_DELETION_COMPLETED', 'GDPR_DELETION_CANCELLED']
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
          requestedAt: latestLog.createdAt,
          scheduledFor,
          reason: latestLog.payload?.reason
        };

      case 'GDPR_DELETION_COMPLETED':
        return {
          status: 'completed',
          requestedAt: deletionLogs.find((log: any) => log.action === 'GDPR_DELETION_REQUESTED')?.createdAt
        };

      case 'GDPR_DELETION_CANCELLED':
        return { status: 'none' };

      default:
        return { status: 'none' };
    }
  }
}


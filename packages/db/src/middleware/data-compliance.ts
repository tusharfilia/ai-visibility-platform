/**
 * Data compliance middleware for GDPR and audit requirements
 * Provides data encryption, export, and deletion capabilities
 */

import { Prisma } from '@prisma/client';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface ComplianceOptions {
  enableEncryption?: boolean;
  auditLogging?: boolean;
  dataRetentionDays?: number;
}

export class DataComplianceManager {
  private encryptionKey: Buffer;
  private options: ComplianceOptions;

  constructor(encryptionKey: string, options: ComplianceOptions = {}) {
    this.encryptionKey = Buffer.from(encryptionKey, 'hex');
    this.options = {
      enableEncryption: true,
      auditLogging: true,
      dataRetentionDays: 2555, // 7 years default
      ...options
    };
  }

  /**
   * Encrypt sensitive data
   */
  encryptData(data: string): string {
    if (!this.options.enableEncryption) {
      return data;
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   */
  decryptData(encryptedData: string): string {
    if (!this.options.enableEncryption) {
      return encryptedData;
    }

    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Create audit log entry
   */
  async createAuditLog(
    prisma: any,
    workspaceId: string,
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details: any = {}
  ): Promise<void> {
    if (!this.options.auditLogging) {
      return;
    }

    try {
      await prisma.auditLog.create({
        data: {
          workspaceId,
          userId,
          action,
          resourceType,
          resourceId,
          details: JSON.stringify(details),
          timestamp: new Date(),
          ipAddress: details.ipAddress || null,
          userAgent: details.userAgent || null
        }
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }

  /**
   * Export workspace data for GDPR compliance
   */
  async exportWorkspaceData(prisma: any, workspaceId: string): Promise<any> {
    const exportData = {
      workspace: await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          members: true,
          engines: true,
          prompts: true,
          copilotRules: true
        }
      }),
      users: await prisma.user.findMany({
        where: {
          workspaceMembers: {
            some: { workspaceId }
          }
        }
      }),
      promptRuns: await prisma.promptRun.findMany({
        where: { workspaceId },
        include: {
          answers: {
            include: {
              citations: true
            }
          }
        }
      }),
      auditLogs: await prisma.auditLog.findMany({
        where: { workspaceId }
      }),
      exportedAt: new Date().toISOString(),
      workspaceId
    };

    return exportData;
  }

  /**
   * Delete workspace data for GDPR compliance
   */
  async deleteWorkspaceData(prisma: any, workspaceId: string): Promise<void> {
    const transaction = await prisma.$transaction(async (tx: any) => {
      // Delete in dependency order
      await tx.citation.deleteMany({ where: { answer: { promptRun: { workspaceId } } } });
      await tx.answer.deleteMany({ where: { promptRun: { workspaceId } } });
      await tx.promptRun.deleteMany({ where: { workspaceId } });
      await tx.prompt.deleteMany({ where: { workspaceId } });
      await tx.engine.deleteMany({ where: { workspaceId } });
      await tx.copilotRule.deleteMany({ where: { workspaceId } });
      await tx.workspaceMember.deleteMany({ where: { workspaceId } });
      await tx.auditLog.deleteMany({ where: { workspaceId } });
      await tx.workspace.delete({ where: { id: workspaceId } });
    });

    return transaction;
  }

  /**
   * Soft delete for audit trail preservation
   */
  async softDeleteResource(
    prisma: any,
    model: string,
    resourceId: string,
    workspaceId: string,
    userId: string
  ): Promise<void> {
    const transaction = await prisma.$transaction(async (tx: any) => {
      // Update resource with soft delete
      await (tx as any)[model].update({
        where: { id: resourceId, workspaceId },
        data: {
          deletedAt: new Date(),
          deletedBy: userId
        }
      });

      // Create audit log
      await this.createAuditLog(tx, workspaceId, userId, 'DELETE', model, resourceId);
    });

    return transaction;
  }

  /**
   * Check data retention policy
   */
  async checkDataRetention(prisma: any, workspaceId: string): Promise<void> {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - (this.options.dataRetentionDays || 2555));

    // Find old data to be purged
    const oldData = await prisma.auditLog.findMany({
      where: {
        workspaceId,
        timestamp: {
          lt: retentionDate
        }
      }
    });

    if (oldData.length > 0) {
      console.log(`Found ${oldData.length} old audit logs for workspace ${workspaceId}`);
      // Implement data purging logic here
    }
  }
}

/**
 * Prisma middleware for automatic data compliance
 */
export function createComplianceMiddleware(complianceManager: DataComplianceManager) {
  return async (params: Prisma.MiddlewareParams, next: Prisma.MiddlewareNext) => {
    // Add compliance logic here
    return next(params);
  };
}



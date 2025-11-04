import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '@ai-visibility/shared';
import { createHash, randomBytes } from 'crypto';

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  invitedBy: string;
  token: string;
  expiresAt: Date;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  createdAt: Date;
}

@Injectable()
export class WorkspaceInvitationsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService
  ) {}

  /**
   * Create workspace invitation
   */
  async createInvitation(
    workspaceId: string,
    email: string,
    role: 'ADMIN' | 'MEMBER' | 'VIEWER',
    invitedBy: string
  ): Promise<WorkspaceInvitation> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      // Check if user is already a member
      const existingMember = await this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId: existingUser.id
        }
      });

      if (existingMember) {
        throw new Error('User is already a member of this workspace');
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await this.prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email,
        status: 'PENDING'
      }
    });

    if (existingInvitation) {
      throw new Error('Invitation already exists for this email');
    }

    // Generate invitation token
    const token = this.generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create invitation
    const invitation = await this.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email,
        role,
        invitedBy,
        token,
        expiresAt,
        status: 'PENDING',
        createdAt: new Date()
      }
    });

    // Send invitation email
    await this.sendInvitationEmail(invitation);

    // Log the invitation
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: invitedBy,
        action: 'INVITATION_CREATED',
        payload: {
          invitedEmail: email,
          role
        },
        createdAt: new Date()
      }
    });

    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      role: invitation.role as any,
      invitedBy: invitation.invitedBy,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      status: invitation.status as any,
      createdAt: invitation.createdAt
    };
  }

  /**
   * Accept workspace invitation
   */
  async acceptInvitation(
    token: string,
    userId: string
  ): Promise<WorkspaceInvitation> {
    // Find invitation
    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: {
        token,
        status: 'PENDING'
      }
    });

    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }

    if (invitation.expiresAt < new Date()) {
      // Mark as expired
      await this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' }
      });
      throw new Error('Invitation has expired');
    }

    // Verify user email matches invitation
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.email !== invitation.email) {
      throw new Error('Email does not match invitation');
    }

    // Add user to workspace
    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        joinedAt: new Date()
      }
    });

    // Update invitation status
    const updatedInvitation = await this.prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED' }
    });

    // Log the acceptance
    await this.prisma.auditLog.create({
      data: {
        workspaceId: invitation.workspaceId,
        actorUserId: userId,
        action: 'INVITATION_ACCEPTED',
        payload: {
          invitedBy: invitation.invitedBy,
          role: invitation.role
        },
        createdAt: new Date()
      }
    });

    return {
      id: updatedInvitation.id,
      workspaceId: updatedInvitation.workspaceId,
      email: updatedInvitation.email,
      role: updatedInvitation.role as any,
      invitedBy: updatedInvitation.invitedBy,
      token: updatedInvitation.token,
      expiresAt: updatedInvitation.expiresAt,
      status: updatedInvitation.status as any,
      createdAt: updatedInvitation.createdAt
    };
  }

  /**
   * Revoke workspace invitation
   */
  async revokeInvitation(
    invitationId: string,
    revokedBy: string
  ): Promise<void> {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new Error('Can only revoke pending invitations');
    }

    // Update invitation status
    await this.prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' }
    });

    // Log the revocation
    await this.prisma.auditLog.create({
      data: {
        workspaceId: invitation.workspaceId,
        actorUserId: revokedBy,
        action: 'INVITATION_REVOKED',
        payload: {
          invitedEmail: invitation.email,
          role: invitation.role
        },
        createdAt: new Date()
      }
    });
  }

  /**
   * Get workspace invitations
   */
  async getWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' }
    });

    return invitations.map(invitation => ({
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      role: invitation.role as any,
      invitedBy: invitation.invitedBy,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      status: invitation.status as any,
      createdAt: invitation.createdAt
    }));
  }

  /**
   * Clean up expired invitations
   */
  async cleanupExpiredInvitations(): Promise<number> {
    const expiredInvitations = await this.prisma.workspaceInvitation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: new Date()
        }
      }
    });

    if (expiredInvitations.length === 0) {
      return 0;
    }

    // Mark as expired
    await this.prisma.workspaceInvitation.updateMany({
      where: {
        id: {
          in: expiredInvitations.map(inv => inv.id)
        }
      },
      data: {
        status: 'EXPIRED'
      }
    });

    return expiredInvitations.length;
  }

  /**
   * Generate invitation token
   */
  private generateInvitationToken(): string {
    const randomPart = randomBytes(16).toString('hex');
    const timestamp = Date.now().toString();
    const hash = createHash('sha256')
      .update(randomPart + timestamp)
      .digest('hex')
      .substring(0, 32);
    
    return `${hash}-${randomPart}`;
  }

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(invitation: any): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: invitation.workspaceId },
      select: { name: true }
    });

    const inviter = await this.prisma.user.findUnique({
      where: { id: invitation.invitedBy },
      select: { name: true, email: true }
    });

    const invitationUrl = `${process.env.FRONTEND_URL}/invite/${invitation.token}`;

    const subject = `You're invited to join ${workspace?.name || 'a workspace'}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You're invited to join ${workspace?.name || 'a workspace'}</h2>
        <p>${inviter?.name || inviter?.email} has invited you to join their workspace as a ${invitation.role.toLowerCase()}.</p>
        <p>Click the button below to accept the invitation:</p>
        <a href="${invitationUrl}" style="display: inline-block; background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Accept Invitation
        </a>
        <p>This invitation will expire on ${invitation.expiresAt.toLocaleDateString()}.</p>
        <p>If you can't click the button, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${invitationUrl}</p>
      </div>
    `;

    await this.emailService.sendEmail({
      to: invitation.email,
      subject,
      html: htmlContent
    });
  }
}


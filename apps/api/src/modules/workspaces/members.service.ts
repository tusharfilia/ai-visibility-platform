import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '@ai-visibility/shared/email.service';

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: Date;
  invitedBy?: string;
}

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
export class WorkspaceMembersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService
  ) {}

  /**
   * Get all members of a workspace
   */
  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { joinedAt: 'asc' }
    });

    return members.map(member => ({
      id: member.id,
      workspaceId: member.workspaceId,
      userId: member.userId,
      role: member.role as any,
      joinedAt: member.joinedAt,
      invitedBy: member.invitedBy
    }));
  }

  /**
   * Add a member to workspace
   */
  async addMember(
    workspaceId: string,
    userId: string,
    role: 'ADMIN' | 'MEMBER' | 'VIEWER',
    invitedBy: string
  ): Promise<WorkspaceMember> {
    // Check if user is already a member
    const existingMember = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId
      }
    });

    if (existingMember) {
      throw new Error('User is already a member of this workspace');
    }

    // Add member
    const member = await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role,
        invitedBy,
        joinedAt: new Date()
      }
    });

    return {
      id: member.id,
      workspaceId: member.workspaceId,
      userId: member.userId,
      role: member.role as any,
      joinedAt: member.joinedAt,
      invitedBy: member.invitedBy
    };
  }

  /**
   * Remove a member from workspace
   */
  async removeMember(
    workspaceId: string,
    userId: string,
    removedBy: string
  ): Promise<void> {
    // Check if user is the owner
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId
      }
    });

    if (!member) {
      throw new Error('Member not found');
    }

    if (member.role === 'OWNER') {
      throw new Error('Cannot remove workspace owner');
    }

    // Remove member
    await this.prisma.workspaceMember.delete({
      where: {
        id: member.id
      }
    });

    // Log the removal
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: removedBy,
        action: 'MEMBER_REMOVED',
        payload: {
          removedUserId: userId,
          removedUserRole: member.role
        },
        createdAt: new Date()
      }
    });
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    workspaceId: string,
    userId: string,
    newRole: 'ADMIN' | 'MEMBER' | 'VIEWER',
    updatedBy: string
  ): Promise<WorkspaceMember> {
    // Check if user is the owner
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId
      }
    });

    if (!member) {
      throw new Error('Member not found');
    }

    if (member.role === 'OWNER') {
      throw new Error('Cannot change owner role');
    }

    // Update role
    const updatedMember = await this.prisma.workspaceMember.update({
      where: {
        id: member.id
      },
      data: {
        role: newRole
      }
    });

    // Log the role change
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        actorUserId: updatedBy,
        action: 'MEMBER_ROLE_UPDATED',
        payload: {
          targetUserId: userId,
          oldRole: member.role,
          newRole
        },
        createdAt: new Date()
      }
    });

    return {
      id: updatedMember.id,
      workspaceId: updatedMember.workspaceId,
      userId: updatedMember.userId,
      role: updatedMember.role as any,
      joinedAt: updatedMember.joinedAt,
      invitedBy: updatedMember.invitedBy
    };
  }

  /**
   * Check if user has access to workspace
   */
  async hasAccess(workspaceId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId
      }
    });

    return !!member;
  }

  /**
   * Get user's role in workspace
   */
  async getUserRole(workspaceId: string, userId: string): Promise<string | null> {
    const member = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId
      }
    });

    return member?.role || null;
  }

  /**
   * Check if user has permission for action
   */
  async hasPermission(
    workspaceId: string,
    userId: string,
    permission: 'READ' | 'WRITE' | 'ADMIN' | 'OWNER'
  ): Promise<boolean> {
    const role = await this.getUserRole(workspaceId, userId);
    
    if (!role) return false;

    const permissions = {
      'OWNER': ['READ', 'WRITE', 'ADMIN', 'OWNER'],
      'ADMIN': ['READ', 'WRITE', 'ADMIN'],
      'MEMBER': ['READ', 'WRITE'],
      'VIEWER': ['READ']
    };

    return permissions[role]?.includes(permission) || false;
  }
}


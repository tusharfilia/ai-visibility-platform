/**
 * Authentication service
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async validateUser(email: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        members: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (user) {
      return user;
    }
    return null;
  }

  async getUserWorkspaces(userId: string): Promise<any[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: true,
      },
    });

    return memberships.map((membership: any) => membership.workspace);
  }
}

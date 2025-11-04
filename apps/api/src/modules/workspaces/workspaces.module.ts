import { Module } from '@nestjs/common';
import { WorkspaceMembersController } from './members.controller';
import { WorkspaceMembersService } from './members.service';
import { WorkspaceInvitationsService } from './invitations.service';
import { WorkspaceExportController } from './export.controller';
import { WorkspaceExportService, GDPRDeletionService } from './gdpr.service';
import { PrismaService } from '../database/prisma.service';
import { EmailService, FileStorageService } from '@ai-visibility/shared';

@Module({
  controllers: [
    WorkspaceMembersController,
    WorkspaceExportController
  ],
  providers: [
    WorkspaceMembersService,
    WorkspaceInvitationsService,
    WorkspaceExportService,
    GDPRDeletionService,
    PrismaService,
    EmailService,
    FileStorageService
  ],
  exports: [
    WorkspaceMembersService,
    WorkspaceInvitationsService,
    WorkspaceExportService,
    GDPRDeletionService
  ]
})
export class WorkspacesModule {}


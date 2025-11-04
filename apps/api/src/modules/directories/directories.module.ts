import { Module } from '@nestjs/common';
import { DirectoryController } from './directories.controller';
import { DirectoryAutomationService } from '@ai-visibility/automation/directory.service';

@Module({
  controllers: [DirectoryController],
  providers: [DirectoryAutomationService],
  exports: [DirectoryAutomationService],
})
export class DirectoriesModule {}


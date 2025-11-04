import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { PreSignupService, EnhancedCopilotService, DirectorySyncService } from '@ai-visibility/automation';

@Module({
  providers: [
    PreSignupService,
    EnhancedCopilotService,
    DirectorySyncService,
  ],
  controllers: [AutomationController],
  exports: [
    PreSignupService,
    EnhancedCopilotService,
    DirectorySyncService,
  ],
})
export class AutomationModule {}


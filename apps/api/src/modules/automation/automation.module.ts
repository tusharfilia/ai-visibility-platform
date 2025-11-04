import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { PreSignupService } from '@ai-visibility/automation/pre-signup.service';
import { EnhancedCopilotService } from '@ai-visibility/automation/enhanced-copilot.service';
import { DirectorySyncService } from '@ai-visibility/automation/directory-sync.service';

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


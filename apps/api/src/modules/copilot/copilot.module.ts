import { Module } from '@nestjs/common';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';

@Module({
  providers: [CopilotService],
  controllers: [CopilotController],
})
export class CopilotModule {}

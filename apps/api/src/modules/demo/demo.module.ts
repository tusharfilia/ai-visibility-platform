import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { LLMConfigService, LLMRouterService } from '@ai-visibility/shared';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [ConfigModule, BullModule.registerQueue({ name: 'runPrompt' })],
  controllers: [DemoController],
  providers: [DemoService, LLMRouterService, LLMConfigService],
  exports: [DemoService],
})
export class DemoModule {}


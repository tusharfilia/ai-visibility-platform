import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SettingsController } from './settings.controller';
import { LLMConfigService, LLMRouterService } from '@ai-visibility/shared';

@Module({
  imports: [ConfigModule],
  controllers: [SettingsController],
  providers: [LLMConfigService, LLMRouterService],
  exports: [LLMConfigService, LLMRouterService],
})
export class SettingsModule {}


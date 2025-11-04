import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentGeneratorService } from '@ai-visibility/content/generator.service';
import { LLMConfigService, LLMRouterService } from '@ai-visibility/shared';

@Module({
  controllers: [ContentController],
  providers: [ContentGeneratorService, LLMConfigService, LLMRouterService],
  exports: [ContentGeneratorService],
})
export class ContentModule {}


import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { LLMConfigService, LLMRouterService } from '@ai-visibility/shared';
import { 
  EntityExtractorService, 
  CompetitorDetectorService, 
  DiagnosticInsightsService,
  SchemaAuditorService,
  PageStructureAnalyzerService,
  FactExtractorService as EvidenceFactExtractorService,
} from '@ai-visibility/geo';
import { IntentClustererService } from '@ai-visibility/prompts';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [ConfigModule, BullModule.registerQueue({ name: 'runPrompt' })],
  controllers: [DemoController],
  providers: [
    DemoService, 
    LLMRouterService, 
    LLMConfigService, 
    EntityExtractorService, 
    CompetitorDetectorService, 
    IntentClustererService, 
    DiagnosticInsightsService,
    // Dependencies for EntityExtractorService
    SchemaAuditorService,
    PageStructureAnalyzerService,
    EvidenceFactExtractorService,
  ],
  exports: [DemoService],
})
export class DemoModule {}


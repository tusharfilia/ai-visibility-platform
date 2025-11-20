import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { LLMConfigService, LLMRouterService } from '@ai-visibility/shared';
import { 
  EntityExtractorService, 
  CompetitorDetectorService, 
  DiagnosticInsightsService,
  SchemaAuditorService,
  PageStructureAnalyzerService,
  FactExtractorService as EvidenceFactExtractorService,
  StructuralScoringService,
  FreshnessAnalyzerService,
  TrustSignalAggregator,
  ShareOfVoiceCalculatorService,
} from '@ai-visibility/geo';
import { IntentClustererService } from '@ai-visibility/prompts';
import { PrismaService } from '../database/prisma.service';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [ConfigModule, BullModule.registerQueue({ name: 'runPrompt' })],
  controllers: [DemoController],
  providers: [
    // Core services (order matters - dependencies first)
    ConfigService,      // Explicitly provide ConfigService (though it's global, this ensures it's available)
    LLMConfigService,  // Must be before LLMRouterService, depends on ConfigService
    LLMRouterService,  // Depends on LLMConfigService
    PrismaService,     // Needed by ShareOfVoiceCalculatorService
    
    // GEO services dependencies (no constructor dependencies)
    SchemaAuditorService,
    PageStructureAnalyzerService,
    EvidenceFactExtractorService,
    FreshnessAnalyzerService,  // Needed by StructuralScoringService
    StructuralScoringService,  // Depends on SchemaAuditorService, FreshnessAnalyzerService, PageStructureAnalyzerService
    TrustSignalAggregator,
    ShareOfVoiceCalculatorService,  // Depends on PrismaService
    
    // Main services (depend on LLMRouterService and other services)
    EntityExtractorService,  // Depends on LLMRouterService, SchemaAuditorService, PageStructureAnalyzerService, EvidenceFactExtractorService
    CompetitorDetectorService,  // Depends on LLMRouterService
    IntentClustererService,  // Depends on LLMRouterService
    DiagnosticInsightsService,  // Depends on SchemaAuditorService, StructuralScoringService, TrustSignalAggregator, ShareOfVoiceCalculatorService
    
    // Demo service (depends on all above)
    DemoService,
  ],
  exports: [DemoService],
})
export class DemoModule {}


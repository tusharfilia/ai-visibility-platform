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
  StructuralScoringService,
  FreshnessAnalyzerService,
  TrustSignalAggregator,
  ShareOfVoiceCalculatorService,
  EVIDENCE_FACT_EXTRACTOR_TOKEN,
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
    // ConfigService is global (from ConfigModule.forRoot), so we don't need to provide it
    LLMConfigService,  // Depends on ConfigService (global)
    LLMRouterService,  // Depends on LLMConfigService
    PrismaService,     // Needed by ShareOfVoiceCalculatorService
    
    // GEO services dependencies (no constructor dependencies)
    SchemaAuditorService,
    PageStructureAnalyzerService,
    // Provide FactExtractorService from evidence package using custom token
    // EntityExtractorService and EvidenceGraphBuilderService use @Inject(EVIDENCE_FACT_EXTRACTOR_TOKEN)
    // to avoid conflicts with the validation package's FactExtractorService
    {
      provide: EVIDENCE_FACT_EXTRACTOR_TOKEN,
      useClass: EvidenceFactExtractorService,
    },
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


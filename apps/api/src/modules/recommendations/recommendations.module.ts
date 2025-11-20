import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { PrescriptiveRecommendationEngine } from '@ai-visibility/geo';
import { 
  GEOMaturityCalculatorService, 
  StructuralScoringService, 
  EvidenceGraphBuilderService,
  SchemaAuditorService,
  FreshnessAnalyzerService,
  PageStructureAnalyzerService,
  CitationClassifierService,
  EvidenceFactExtractorService,
  EVIDENCE_FACT_EXTRACTOR_TOKEN,
} from '@ai-visibility/geo';
import { LLMRouterService, LLMConfigService } from '@ai-visibility/shared';
import { EventEmitterService } from '../events/event-emitter.service';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'recommendationRefresh' }),
  ],
  providers: [
    // Core LLM services (needed by FactExtractorService from validation package if it's used)
    LLMConfigService,
    LLMRouterService,
    // Dependencies for StructuralScoringService
    SchemaAuditorService,
    FreshnessAnalyzerService,
    PageStructureAnalyzerService,
    // Dependencies for EvidenceGraphBuilderService
    CitationClassifierService,
    // Provide FactExtractorService from evidence package using custom token
    // EvidenceGraphBuilderService uses @Inject(EVIDENCE_FACT_EXTRACTOR_TOKEN) to avoid conflicts
    // with the validation package's FactExtractorService
    {
      provide: EVIDENCE_FACT_EXTRACTOR_TOKEN, // Use the symbol token
      useClass: EvidenceFactExtractorService, // Provide the evidence package's FactExtractorService
    },
    // Main services
    PrescriptiveRecommendationEngine,
    GEOMaturityCalculatorService,
    StructuralScoringService,
    EvidenceGraphBuilderService,
    EventEmitterService,
  ],
  controllers: [RecommendationsController],
  exports: [PrescriptiveRecommendationEngine],
})
export class RecommendationsModule {}



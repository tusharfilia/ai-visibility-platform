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
    // EvidenceFactExtractorService is the alias for FactExtractorService from evidence package
    // NestJS will resolve it correctly because the class name is FactExtractorService internally
    EvidenceFactExtractorService,
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



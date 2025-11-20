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
// Import FactExtractorService directly from evidence package (the one EvidenceGraphBuilderService uses)
// This avoids naming conflict with validation FactExtractorService
import { FactExtractorService } from '@ai-visibility/geo/src/evidence/fact-extractor.service';

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
    // Provide FactExtractorService from evidence package (the one EvidenceGraphBuilderService expects)
    // Use the actual class name to match what EvidenceGraphBuilderService imports
    FactExtractorService,
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



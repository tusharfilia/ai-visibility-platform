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
} from '@ai-visibility/geo';
import { EventEmitterService } from '../events/event-emitter.service';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'recommendationRefresh' }),
  ],
  providers: [
    // Dependencies for StructuralScoringService
    SchemaAuditorService,
    FreshnessAnalyzerService,
    PageStructureAnalyzerService,
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



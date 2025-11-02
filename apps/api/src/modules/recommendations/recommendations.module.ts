import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { PrescriptiveRecommendationEngine } from '@ai-visibility/geo';
import { GEOMaturityCalculatorService, StructuralScoringService, EvidenceGraphBuilderService } from '@ai-visibility/geo';
import { EventEmitterService } from '../events/event-emitter.service';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'recommendationRefresh' }),
  ],
  providers: [
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



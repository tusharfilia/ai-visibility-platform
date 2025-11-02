import { Module } from '@nestjs/common';
import { GEOOptimizationController } from './geo-optimization.controller';
import { EvidenceController } from './evidence.controller';
import { MaturityController } from './maturity.controller';
import { EEATController } from './eeat.controller';
import { DashboardController } from './dashboard.controller';
import { GEODataService } from './geo-data.service';
import { 
  EnhancedGEOScoringService,
  KnowledgeGraphBuilder,
  TrustSignalAggregator,
  EvidenceGraphBuilderService,
  GEOMaturityCalculatorService,
  StructuralScoringService,
  PrescriptiveRecommendationEngine,
  SchemaAuditorService,
  FreshnessAnalyzerService,
  PageStructureAnalyzerService,
  CitationClassifierService,
  CitationAuthorityService,
  DirectoryPresenceAnalyzerService,
  EEATCalculatorService,
  FactExtractorService,
  DashboardAggregatorService,
} from '@ai-visibility/geo';
import { PrismaService } from '../database/prisma.service';
import { EventEmitterService } from '../events/event-emitter.service';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'maturityRecompute' },
      { name: 'recommendationRefresh' }
    ),
  ],
  providers: [
    GEODataService,
    EnhancedGEOScoringService,
    KnowledgeGraphBuilder,
    TrustSignalAggregator,
    EvidenceGraphBuilderService,
    GEOMaturityCalculatorService,
    StructuralScoringService,
    PrescriptiveRecommendationEngine,
    SchemaAuditorService,
    FreshnessAnalyzerService,
    PageStructureAnalyzerService,
    CitationClassifierService,
    CitationAuthorityService,
    DirectoryPresenceAnalyzerService,
    EEATCalculatorService,
    FactExtractorService,
    DashboardAggregatorService,
    PrismaService,
    EventEmitterService,
  ],
  controllers: [
    GEOOptimizationController,
    EvidenceController,
    MaturityController,
    EEATController,
    DashboardController,
  ],
  exports: [
    EnhancedGEOScoringService,
    KnowledgeGraphBuilder,
    TrustSignalAggregator,
    EvidenceGraphBuilderService,
    GEOMaturityCalculatorService,
    StructuralScoringService,
    PrescriptiveRecommendationEngine,
    EEATCalculatorService,
    DashboardAggregatorService,
  ],
})
export class GEOModule {}

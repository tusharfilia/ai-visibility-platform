import { Module, Provider } from '@nestjs/common';
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
  FactExtractorService as EvidenceFactExtractorService,
  DashboardAggregatorService,
} from '@ai-visibility/geo';
import { PrismaService } from '../database/prisma.service';
import { EventsModule } from '../events/events.module';
import { BullModule } from '@nestjs/bullmq';
import { LLMRouterService, LLMConfigService } from '@ai-visibility/shared';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'maturityRecompute' },
      { name: 'recommendationRefresh' }
    ),
    EventsModule,
  ],
  providers: [
    // Core LLM services (needed if FactExtractorService from validation package is resolved)
    LLMConfigService,
    LLMRouterService,
    // Dependencies for EvidenceGraphBuilderService
    CitationClassifierService,
    // Provide FactExtractorService from evidence package (the one EvidenceGraphBuilderService expects)
    // EvidenceFactExtractorService is an alias for FactExtractorService from evidence package
    // Since EvidenceGraphBuilderService uses @Inject(FactExtractorService), we need to provide it
    // with the class name as the token. EvidenceFactExtractorService has the class name FactExtractorService,
    // so providing it should work, but we use a custom provider to be explicit.
    {
      provide: EvidenceFactExtractorService, // Use the alias class as the token
      useClass: EvidenceFactExtractorService, // Provide the evidence package's FactExtractorService
    },
    // Also provide it with the actual class name (FactExtractorService) so @Inject(FactExtractorService) works
    // EvidenceFactExtractorService is just an alias, the actual class name is FactExtractorService
    EvidenceFactExtractorService,
    // Main services (depend on above)
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
    CitationAuthorityService,
    DirectoryPresenceAnalyzerService,
    EEATCalculatorService,
    DashboardAggregatorService,
    PrismaService,
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

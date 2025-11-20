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
// Import the actual FactExtractorService class from evidence package
// We need the actual class reference (not the alias) to use as the provider token
import { FactExtractorService as EvidenceFactExtractorServiceClass } from '@ai-visibility/geo/src/evidence/fact-extractor.service';

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
    // Provide FactExtractorService from evidence package explicitly
    // EvidenceGraphBuilderService uses @Inject(FactExtractorService) where FactExtractorService
    // is imported from './fact-extractor.service' (the evidence package). We need to provide
    // the evidence package's FactExtractorService with the class reference as the token.
    // Using the actual class reference ensures NestJS resolves to the correct implementation.
    {
      provide: EvidenceFactExtractorServiceClass, // Use the actual class from evidence package as token
      useClass: EvidenceFactExtractorServiceClass, // Provide the evidence package's FactExtractorService
    },
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

/**
 * GEO Module (Test Mode - No Controllers)
 * Only provides services, controllers are registered separately in test app module
 */

import { Module } from '@nestjs/common';
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
// EventEmitterService removed - optional dependency
// BullModule removed - requires Redis, not needed for basic testing

@Module({
  imports: [
    // BullModule removed - requires Redis
  ],
  providers: [
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
    // EventEmitterService removed - optional dependency
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
export class GEOModuleTest {}


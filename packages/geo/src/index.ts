// Core GEO services
export * from './scoring/visibility-score';
export * from './scoring/mention-detector';
export * from './scoring/ranking-calculator';
export { CitationAuthorityService, type CitationAuthority } from './scoring/citation-authority.service';
export * from './scoring/engine-bias.config';

// Enhanced GEO services
export * from './scoring/enhanced-scoring.service';

// Knowledge graph services
export * from './knowledge/knowledge-graph-builder.service';

// Trust signal services
export * from './trust/trust-signal-aggregator.service';
export * from './trust/eeat-calculator.service';
export type { EEATScore } from './trust/eeat-calculator.service';

// Citation services
export * from './citations/opportunity.service';
export * from './citations/domain-analyzer';
export * from './citations/impact-calculator';
export { CitationClassifierService, CitationSourceType, type ClassificationResult } from './citations/citation-classifier.service';

// Evidence services
export * from './evidence/evidence-graph.builder';
export * from './evidence/fact-extractor.service';
export type { EntityEvidenceGraph, FactConsensusScore } from './evidence/evidence-graph.builder';

// Structural services
export * from './structural/structural-scoring.service';
export * from './structural/schema-auditor';
export * from './structural/freshness-analyzer';
export * from './structural/page-structure-analyzer';

// Maturity services
export * from './maturity/maturity-calculator.service';
export * from './maturity/prescriptive-recommendations.service';
export type { GEOMaturityScore } from './maturity/maturity-calculator.service';
export type { Recommendation } from './maturity/prescriptive-recommendations.service';

// Directory services
export * from './directory/directory-presence.analyzer';
export * from './directory/directory-constants';

// Dashboard services
export * from './dashboard/dashboard-aggregator.service';

// Validation services
export * from './validation/hallucination-detector';
export * from './validation/fact-extractor';
export * from './validation/fact-validator';

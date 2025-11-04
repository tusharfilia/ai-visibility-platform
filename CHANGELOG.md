# Changelog

## [Unreleased] - GEO Compliance Enhancements

### Added

#### Entity Evidence Graph
- New `EntityEvidence` model for tracking entity-to-evidence relationships across the web
- `EvidenceGraphBuilderService` aggregates citations and mentions into evidence graphs with credibility, freshness, and verification flags
- Evidence graph API endpoint: `GET /v1/geo/evidence/graph`
- Background worker for evidence graph building

#### Engine-Aware Scoring
- Engine-specific bias configuration (`engine-bias.config.ts`) with source weights and multipliers per audit
- `CitationAuthorityService` calculates authority with engine-specific multipliers (licensed 3x, curated 2x, directory 1.5x, reddit engine-dependent)
- Updated `VisibilityScoreCalculator` to accept `engineKey` parameter and apply engine-aware citation scoring
- Freshness decay algorithm (exponential half-life ~180 days)

#### Citation Intelligence
- `CitationClassifierService` classifies citations as: `licensed_publisher`, `curated`, `directory`, `reddit`, `user_generated`
- Licensed publisher detection (News Corp, FT, Axel Springer, AP)
- Reddit thread detection and tracking
- Directory detection (GBP, Bing Places, Apple Business, G2, Capterra, Trustpilot, Yelp)
- Extended `Citation` model with classification fields

#### Structural Scoring
- `SchemaAuditorService` validates Organization, LocalBusiness, Product, FAQ, HowTo schema.org markup
- `FreshnessAnalyzerService` extracts last-updated timestamps and calculates freshness scores
- `PageStructureAnalyzerService` detects atomic page structure (TL;DR, headings, citations, bullet points, focused length)
- `StructuralScoringService` orchestrates structural analysis with Redis caching
- Structural score (10% weight) integrated into overall visibility score

#### GEO Maturity Model
- New `GEOMaturityScore` model with 4 dimensions: Entity Strength, Citation Depth, Structural Clarity, Update Cadence
- `GEOMaturityCalculatorService` calculates composite maturity score with exact weights from audit
- Maturity level bucketing: beginner (<40), intermediate (40-60), advanced (60-80), expert (80+)
- Maturity API endpoints: `GET /v1/geo/maturity`, `POST /v1/geo/recompute`
- Background worker for maturity recomputation

#### Prescriptive Recommendations
- `PrescriptiveRecommendationEngine` generates actionable, count-based recommendations
- Recommendations include: citation gaps, schema gaps, Reddit presence, freshness gaps
- Recommendation API endpoints: `GET /v1/recommendations`, `POST /v1/recommendations/refresh`
- Background worker for recommendation refresh

#### Directory Presence Analysis
- `DirectoryPresenceAnalyzerService` analyzes directory listing presence, NAP consistency, and listing quality
- Directory coverage percentage calculation
- NAP consistency verification across directories
- Directory presence API endpoint: `GET /v1/directory/presence`

### Changed

- Updated `VisibilityScoreCalculator` weights: mention 0.35 (was 0.4), ranking 0.25 (was 0.3), citation 0.20, competitor 0.10, structural 0.10 (NEW)
- Extended `Citation` model with nullable fields for source classification and authority scoring
- Updated queue definitions to include `evidenceGraph`, `maturityRecompute`, `recommendationRefresh` queues
- Extended SSE event types to include `maturity.updated`, `geo.recommendations.updated`, `evidence.progress`, `evidence.complete`

### Technical Details

- All new features integrate with existing multi-tenant architecture, SSE infrastructure, and queue system
- Backward compatibility maintained: all new Citation fields are nullable
- Idempotency: All new workers use existing idempotency patterns
- Workspace isolation: All new APIs and workers respect workspace boundaries
- Performance: Structural scores cached in Redis (TTL 1 hour)



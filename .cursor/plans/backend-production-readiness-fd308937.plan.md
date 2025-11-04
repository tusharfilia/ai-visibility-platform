<!-- fd308937-3c6d-4692-984c-ee5eae4d343a 821bbd02-3210-48b3-9db8-4b37821aaf95 -->
# GEO Compliance Enhancements Implementation Plan

## Overview

Implement 7 major GEO enhancements from the compliance audit, adding entity-level evidence tracking, engine-aware scoring, citation intelligence, structural analysis, maturity modeling, prescriptive recommendations, and directory presence analysis. All changes integrate with existing multi-tenant, SSE, queue, and scoring infrastructure.

## Prerequisites (Preserved)

- Multi-tenancy with workspace isolation
- SSE infrastructure with Redis Pub/Sub
- Queue architecture with BullMQ
- Idempotency framework
- Existing GEO scoring algorithms
- AI provider orchestration

## Implementation Phases

### Phase 1: Database Schema & Core Models

**File**: `packages/db/prisma/schema.prisma`

1. Add `EntityEvidence` model:

   - Fields: id, workspaceId, entityType, sourceType, sourceDomain, citationUrl, evidenceText, authorityScore, freshness, verified, createdAt
   - Index on [workspaceId, sourceType]

2. Add `GEOMaturityScore` model:

   - Fields: id, workspaceId (unique), entityStrength, citationDepth, structuralClarity, updateCadence, overallScore, maturityLevel, recommendations (Json), timestamps
   - Index on [workspaceId, overallScore]

3. Extend `Citation` model:

   - Add nullable fields: sourceType, isLicensed (default false), publisherName, directoryType, redditThread, authorityScore (default 0), freshness
   - Maintain backward compatibility (all new fields nullable)

4. Create migration:

   - Generate Prisma migration: `pnpm --filter @ai-visibility/db prisma migrate dev --name add_geo_enhancements`
   - Migration handles: new tables, new Citation fields (nullable), indexes

**File**: `packages/db/prisma/seed.ts`

- Seed initial engine bias configs (default values)
- Seed directory constants

### Phase 2: Classification & Evidence Infrastructure

**File**: `packages/geo/assets/licensed_publishers.json` (new)

```json
{
  "domains": [
    "wsj.com", "dowjones.com",
    "ft.com", "financialtimes.com",
    "welt.de", "bild.de", "axel-springer.de",
    "apnews.com", "ap.org"
  ],
  "publishers": {
    "wsj.com": "News Corp",
    "ft.com": "Financial Times",
    "welt.de": "Axel Springer",
    "apnews.com": "Associated Press"
  }
}
```

**File**: `packages/geo/assets/known_directories.json` (new)

```json
{
  "directories": [
    { "domain": "google.com/maps", "type": "gbp", "name": "Google Business Profile" },
    { "domain": "bing.com/maps", "type": "bing_places", "name": "Bing Places" },
    { "domain": "apple.com/maps", "type": "apple_business", "name": "Apple Business Connect" },
    { "domain": "g2.com", "type": "g2", "name": "G2" },
    { "domain": "capterra.com", "type": "capterra", "name": "Capterra" },
    { "domain": "trustpilot.com", "type": "trustpilot", "name": "Trustpilot" },
    { "domain": "yelp.com", "type": "yelp", "name": "Yelp" }
  ]
}
```

**File**: `packages/geo/assets/reddit_domains.json` (new)

```json
{
  "domains": ["reddit.com", "redd.it", "redditstatic.com"],
  "patterns": ["/r/", "/u/", "/user/"]
}
```

**File**: `packages/geo/src/citations/citation-classifier.service.ts` (new)

- `CitationClassifierService` class
- Methods: `classifyCitation(citation)`, `detectLicensedPublisher(domain)`, `detectReddit(url)`, `detectDirectory(domain)`
- Loads asset JSON files
- Returns `CitationSourceType` enum: 'licensed_publisher' | 'curated' | 'directory' | 'reddit' | 'user_generated'
- Accuracy target: >95% on fixtures

**File**: `packages/geo/src/evidence/evidence-graph.builder.ts` (new)

- `EvidenceGraphBuilderService` class
- Methods: `buildEvidenceGraph(workspaceId)`, `aggregateEvidence(citations, mentions)`, `calculateConsensusScore(evidenceNodes)`, `linkEntityToEvidence(entity, evidence)`
- Returns `EntityEvidenceGraph` interface with nodes, edges, consensusScore
- Integrates with existing KnowledgeGraphBuilderService

### Phase 3: Engine Bias & Scoring Updates

**File**: `packages/geo/src/scoring/engine-bias.config.ts` (new)

```typescript
export const ENGINE_BIAS_CONFIG: Record<EngineKey, EngineBiasConfig> = {
  PERPLEXITY: {
    sourceWeights: { reddit: 0.066, wikipedia: 0.03, licensed_publisher: 0.20, curated: 0.15, directory: 0.10 },
    redditMultiplier: 1.5,
    citationPatterns: { reddit: 0.066 }
  },
  OPENAI: {
    sourceWeights: { reddit: 0.018, wikipedia: 0.078, licensed_publisher: 0.30, curated: 0.20, directory: 0.10 },
    licensedPublisherMultiplier: 3.0,
    citationPatterns: { licensed_publisher: 0.30, wikipedia: 0.078 }
  },
  AIO: {
    sourceWeights: { reddit: 0.022, wikipedia: 0.006, licensed_publisher: 0.15, curated: 0.40, directory: 0.12 },
    curatedMultiplier: 2.5,
    redditPenalty: 0.8,
    citationPatterns: { curated: 0.40 }
  },
  // ... other engines with default weights
};
```

**File**: `packages/geo/src/scoring/visibility-score.ts` (modify)

1. Update `VisibilityScoreCalculator` class:

   - Add `engineKey` parameter to `calculateScore()`
   - Add `structuralScore` input to `VisibilityScoreInput` interface
   - Modify weights: mentionScore 0.35 (was 0.4), rankingScore 0.25 (was 0.3), citationScore 0.20, competitorScore 0.10, structuralScore 0.10 (NEW)
   - Add `calculateEngineAwareCitationScore(citations, engineKey)` method
   - Apply engine-specific multipliers per `engine-bias.config.ts`
   - Apply freshness decay: exponential half-life ~180 days

2. Update `calculateCitationScore()`:

   - Use `CitationClassifierService` to get sourceType
   - Apply authority multipliers: licensed 3x, curated 2x, directory 1.5x, reddit engine-dependent
   - Apply freshness decay algorithm

**File**: `packages/geo/src/scoring/citation-authority.service.ts` (new)

- `CitationAuthorityService` class
- Methods: `calculateAuthority(citation, engineKey)`, `applyFreshnessDecay(authority, freshness)`, `applySourceMultipliers(baseAuthority, sourceType, engineKey)`
- Implements audit algorithms exactly

### Phase 4: Structural Scoring

**File**: `packages/geo/src/structural/schema-auditor.ts` (new)

- `SchemaAuditorService` class
- Methods: `auditPage(url)`, `validateSchemaTypes(html)`, `detectSchemaTypes()`: Organization, LocalBusiness, Product, FAQ, HowTo
- Parses JSON-LD and microdata
- Returns schema coverage score (0-100)

**File**: `packages/geo/src/structural/freshness-analyzer.ts` (new)

- `FreshnessAnalyzerService` class
- Methods: `analyzeFreshness(url)`, `extractLastUpdated(html)`, `calculateFreshnessScore(lastUpdated)`
- Looks for: `<time>`, `last-modified` header, `"datePublished"`/`"dateModified"` in schema
- Returns freshness score (0-100) with decay calculation

**File**: `packages/geo/src/structural/page-structure-analyzer.ts` (new)

- `PageStructureAnalyzerService` class
- Methods: `analyzeStructure(url)`, `detectAtomicPage(html)`
- Checks: has TL;DR/summary, clear headings (>=3), external citations (>=1), bullet points (>=3), focused length (<2000 words)
- Returns structure score (0-100)

**File**: `packages/geo/src/structural/structural-scoring.service.ts` (new)

- `StructuralScoringService` class (orchestrates above services)
- Methods: `calculateStructuralScore(workspaceId)`
- Aggregates: schemaScore, freshnessScore, structureScore
- Returns overall structural score (0-100)
- Caches results in Redis (TTL 1 hour)

### Phase 5: GEO Maturity Model

**File**: `packages/geo/src/maturity/maturity-calculator.service.ts` (new)

- `GEOMaturityCalculatorService` class
- Methods:
  - `calculateMaturityScore(workspaceId)`: Main orchestrator
  - `calculateEntityStrength(workspaceId)`: KG completeness, verified presence (0-100)
  - `calculateCitationDepth(workspaceId)`: Count + quality across source types (0-100)
  - `calculateStructuralClarity(workspaceId)`: Uses StructuralScoringService (0-100)
  - `calculateUpdateCadence(workspaceId)`: Freshness analysis across key pages (0-100)
  - `determineMaturityLevel(overallScore)`: 'beginner' (<40), 'intermediate' (40-60), 'advanced' (60-80), 'expert' (80+)
- Weights: entityStrength 0.30, citationDepth 0.35, structuralClarity 0.20, updateCadence 0.15
- Stores results in `GEOMaturityScore` table
- Emits SSE event: `maturity.updated`

**File**: `packages/geo/src/maturity/prescriptive-recommendations.service.ts` (new)

- `PrescriptiveRecommendationEngine` class
- Methods:
  - `generateRecommendations(workspaceId)`: Main generator
  - `analyzeCitationGaps(maturityScore)`: Count needed citations by type
  - `analyzeSchemaGaps(workspaceId)`: Missing schema types per page
  - `analyzeRedditPresence(workspaceId)`: Reddit mention count, recommend threads
  - `analyzeFreshnessGaps(workspaceId)`: Stale pages (>180 days)
- Returns `Recommendation[]` interface:
  ```typescript
  interface Recommendation {
    type: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    action: CopilotActionType;
    estimatedImpact: number;
    effort: 'low' | 'medium' | 'high';
    targetUrl?: string;
    targetDomain?: string;
  }
  ```

- Examples: "You need 2 more trusted citations from licensed publishers", "Schema missing in About page - add Organization markup"
- Stores in `GEOMaturityScore.recommendations` JSON field
- Emits SSE event: `geo.recommendations.updated`

### Phase 6: Directory Presence Analysis

**File**: `packages/geo/src/directory/directory-constants.ts` (new)

- Defines directory domains, NAP field mappings
- Directory type enum
- Exports `DIRECTORY_CONFIGS`, `ALL_DIRECTORY_TYPES`, `DirectoryType`

**File**: `packages/geo/src/directory/directory-presence.analyzer.ts` (new)

- `DirectoryPresenceAnalyzerService` class
- Methods: `analyzeDirectoryPresence(workspaceId)`, `checkDirectoryListing(type, workspaceId)`, `calculateNAPConsistency(listings)`, `calculateListingQuality(listing)`
- Returns `DirectoryPresenceReport` interface with: coverage (0-100%), NAP consistency (0-100%), listing quality (0-100 average), missing directories, listings array, recommendations
- Analyzes all 7 directory types: GBP, Bing Places, Apple Business, G2, Capterra, Trustpilot, Yelp

**File**: `apps/api/src/modules/directory/presence.controller.ts` (new)

- `DirectoryPresenceController` class
- Endpoint: `GET /v1/directory/presence?workspaceId=xxx`
- Returns directory presence report with coverage metrics and recommendations

**File**: `apps/api/src/modules/directory/directory.module.ts` (new)

- `DirectoryModule` that imports `DirectoryPresenceController` and `DirectoryPresenceAnalyzerService`
- Registered in `app.module.ts`

### To-dos

- [x] Simplify readiness check to allow Railway deployment
- [x] Deploy working API foundation to Railway
- [x] Test /healthz endpoint to confirm API is responding
- [x] Execute backend production readiness plan systematically
- [x] Phase 1: Environment setup & configuration
- [x] Phase 2: Database & Infrastructure Setup
- [ ] Phase 3: Provider integration & testing
- [ ] Phase 4: API integration & endpoint testing
- [ ] Phase 5: Queue & worker testing
- [ ] Start Docker Compose infrastructure
- [ ] Generate Prisma client and run migrations
- [ ] Create seed script and demo data
- [ ] Verify infrastructure connectivity
- [ ] Create comprehensive .env.example and .env files with all required variables
- [ ] Update JWT authentication to support JWKS URL and DEBUG_JWT_MODE
- [ ] Configure CORS for localhost:5173 and dynamic origins
- [ ] Initialize database with migrations and seed data
- [ ] Configure providers to respect MOCK_PROVIDERS environment variable
- [ ] Test all API endpoints with mock data and fix missing implementations
- [ ] Generate and export OpenAPI specification for frontend client
- [ ] Test BullMQ queues and workers end-to-end
- [ ] Test Copilot automation flow with planner and executor
- [ ] Verify Prometheus metrics, logging, and health checks
- [ ] Test JWT authentication, rate limiting, and input validation
- [ ] Build and test Docker images for API and Jobs apps
- [ ] Create fly.toml configurations for Fly.io deployment
- [ ] Create GitHub Actions workflows for CI/CD
- [ ] Run end-to-end testing of complete user flows
- [ ] Update all documentation with deployment guides and checklists
- [ ] Implement multi-tenant foundation with workspace isolation, idempotency, and data compliance
- [ ] Build SSE infrastructure for real-time progress updates and event streaming
- [ ] Create scalable queue architecture with priority queues and parallel AI orchestration
- [ ] Build GEO optimization engine with scoring, knowledge graph, and trust signals
- [ ] Implement pre-signup AI summary flow with async scanning and progress tracking
- [ ] Build GEO Copilot automation engine with rules, approvals, and execution
- [ ] Create directory sync infrastructure with OAuth and aggregator integrations
- [ ] Add enhanced observability with workspace metrics, tracing, and logging
- [ ] Configure Railway production deployment with migrations and monitoring
- [ ] Complete comprehensive testing and operational documentation
- [x] Implement workspace isolation middleware and context service
- [x] Create idempotency framework with middleware and utilities
- [x] Add data compliance and audit logging capabilities
- [x] Build SSE event system with heartbeat and Last-Event-ID support
- [x] Create progress tracking system for long-running operations
- [x] Implement priority queue system with workspace tier-based priority
- [x] Create parallel AI provider orchestration with circuit breaker
- [x] Add job idempotency and deduplication for BullMQ workers
- [x] Implement GEO visibility scoring algorithm
- [x] Build knowledge graph builder for business entities
- [x] Create trust signal aggregation system
- [ ] Implement multi-tenant foundation with workspace isolation, idempotency, and data compliance
- [ ] Build SSE infrastructure for real-time progress updates and event streaming
- [ ] Create scalable queue architecture with priority queues and parallel AI orchestration
- [ ] Build GEO optimization engine with scoring, knowledge graph, and trust signals
- [ ] Implement pre-signup AI summary flow with async scanning and progress tracking
- [ ] Build GEO Copilot automation engine with rules, approvals, and execution
- [ ] Create directory sync infrastructure with OAuth and aggregator integrations
- [ ] Add enhanced observability with workspace metrics, tracing, and logging
- [ ] Configure Railway production deployment with migrations and monitoring
- [ ] Complete comprehensive testing and operational documentation
- [x] Phase 1: LLM Engine Coverage Layer - Create LLM providers and integrate with orchestrator
- [x] Phase 2: Prompt Discovery & Intent Clustering - Implement automatic prompt generation and clustering
- [x] Phase 3: Citation Opportunity Graph - Implement opportunity detection and impact scoring
- [x] Phase 4: Hallucination Defense System - Implement hallucination detection and correction
- [ ] Implement multi-tenant foundation with workspace isolation, idempotency, and data compliance
- [ ] Build SSE infrastructure for real-time progress updates and event streaming
- [ ] Create scalable queue architecture with priority queues and parallel AI orchestration
- [ ] Build GEO optimization engine with scoring, knowledge graph, and trust signals
- [ ] Implement pre-signup AI summary flow with async scanning and progress tracking
- [ ] Build GEO Copilot automation engine with rules, approvals, and execution
- [ ] Create directory sync infrastructure with OAuth and aggregator integrations
- [ ] Add enhanced observability with workspace metrics, tracing, and logging
- [ ] Configure Railway production deployment with migrations and monitoring
- [ ] Complete comprehensive testing and operational documentation
- [ ] Implement multi-tenant foundation with workspace isolation, idempotency, and data compliance
- [ ] Build SSE infrastructure for real-time progress updates and event streaming
- [ ] Create scalable queue architecture with priority queues and parallel AI orchestration
- [ ] Build GEO optimization engine with scoring, knowledge graph, and trust signals
- [ ] Implement pre-signup AI summary flow with async scanning and progress tracking
- [ ] Build GEO Copilot automation engine with rules, approvals, and execution
- [ ] Create directory sync infrastructure with OAuth and aggregator integrations
- [ ] Add enhanced observability with workspace metrics, tracing, and logging
- [ ] Configure Railway production deployment with migrations and monitoring
- [ ] Complete comprehensive testing and operational documentation
- [x] Implement Prompt Discovery & Intent Clustering system with embeddings and clustering
- [x] Build Citation Opportunity Graph with domain analysis and impact scoring
- [ ] Implement multi-tenant foundation with workspace isolation, idempotency, and data compliance
- [ ] Build SSE infrastructure for real-time progress updates and event streaming
- [ ] Create scalable queue architecture with priority queues and parallel AI orchestration
- [ ] Build GEO optimization engine with scoring, knowledge graph, and trust signals
- [ ] Implement pre-signup AI summary flow with async scanning and progress tracking
- [ ] Build GEO Copilot automation engine with rules, approvals, and execution
- [ ] Create directory sync infrastructure with OAuth and aggregator integrations
- [ ] Add enhanced observability with workspace metrics, tracing, and logging
- [ ] Configure Railway production deployment with migrations and monitoring
- [ ] Complete comprehensive testing and operational documentation
- [x] Implement Hallucination Defense System with fact extraction, validation, and correction
- [ ] Implement multi-tenant foundation with workspace isolation, idempotency, and data compliance
- [ ] Build SSE infrastructure for real-time progress updates and event streaming
- [ ] Create scalable queue architecture with priority queues and parallel AI orchestration
- [ ] Build GEO optimization engine with scoring, knowledge graph, and trust signals
- [ ] Implement pre-signup AI summary flow with async scanning and progress tracking
- [ ] Build GEO Copilot automation engine with rules, approvals, and execution
- [ ] Create directory sync infrastructure with OAuth and aggregator integrations
- [ ] Add enhanced observability with workspace metrics, tracing, and logging
- [ ] Configure Railway production deployment with migrations and monitoring
- [ ] Complete comprehensive testing and operational documentation
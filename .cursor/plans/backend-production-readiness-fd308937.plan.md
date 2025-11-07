<!-- fd308937-3c6d-4692-984c-ee5eae4d343a 821bbd02-3210-48b3-9db8-4b37821aaf95 -->
# Demo Self-Serve Implementation Plan

## Phase 1 – Scaffolding

- a. Add `demo_runs` migration (id, workspaceId, status, timestamps, progress, error).
- b. Create `apps/api/src/modules/demo/` with controller/service DTO scaffolding.
- c. Register `DemoModule` in `AppModule`; stub controller methods returning 202.
- d. Document flow in Swagger (summary of steps, link to status endpoint).

## Phase 2 – Domain Intake & AI Summary

- a. Implement `POST /v1/demo/summary` to accept domain/brand and optional override text.
- b. Call LLM via `LLMRouterService` to generate summary; persist to `WorkspaceProfile`.
- c. Create workspace & demo run record if absent; update status `summary_ready`.

## Phase 3 – Prompt Generation & Confirmation

- a. Implement `POST /v1/demo/prompts` taking `seedPrompts` and optional `useSuggested` flag.
- b. Use summary to generate additional prompts (LLM) and dedupe.
- c. Save final prompt list to `prompts` table; update status `prompts_ready`.

## Phase 4 – Competitor Discovery & Confirmation

- a. Implement `POST /v1/demo/competitors` to run lightweight searches for each prompt.
- b. Parse competitor domains from responses (reuse parser utilities); return suggestions.
- c. Persist confirmed competitor set; update status `competitors_ready`.

## Phase 5 – Run Analysis Jobs

- a. Implement `POST /v1/demo/run` to seed default engines and enqueue `runPrompt` jobs for brand & competitors.
- b. Extend job payloads to include `demoRunId` for progress tracking.
- c. Update workers to record completion/progress in `demo_runs`; expose `/v1/demo/status/{jobId}`.

## Phase 6 – Insights & Recommendations

- a. Aggregate prompt run outputs for visibility metrics (brand vs competitors) in `DemoService`.
- b. Implement `/v1/demo/insights` and `/v1/demo/recommendations` endpoints.
- c. Leverage existing GEO & recommendations services; map results to concise JSON for Swagger.

## Phase 7 – Polish & Docs

- a. Add validation & error handling (missing keys, invalid step order).
- b. Update README/Swagger descriptions with end-to-end usage instructions.
- c. Add optional cleanup script or endpoint to delete demo workspaces. 

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
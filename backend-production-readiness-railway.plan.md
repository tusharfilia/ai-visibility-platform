# Backend Production Readiness Plan (Railway Edition)

## Phase 1: Environment Setup & Configuration ✅ COMPLETED

### 1.1 Create Comprehensive Environment File ✅
- ✅ Created `.env.example` with all required variables
- ✅ Created `.env` for local development
- ✅ Railway environment variables configured

### 1.2 Update JWT Authentication ✅
- ✅ Modified `apps/api/src/modules/auth/jwt.strategy.ts` for JWKS
- ✅ Added `DEBUG_JWT_MODE` support
- ✅ Updated `JwtAuthGuard` for debug mode

### 1.3 Configure CORS ✅
- ✅ Updated CORS configuration in `apps/api/src/main.ts`
- ✅ Added localhost:5173 support
- ✅ Dynamic origins from `CORS_ALLOWED_ORIGINS`

## Phase 2: Database & Infrastructure Setup (Railway)

### 2.1 Initialize Database (Railway Setup)
- ✅ Railway PostgreSQL service configured
- ✅ Railway Redis service configured
- 🔄 Generate Prisma client: `pnpm --filter @ai-visibility/db prisma generate`
- 🔄 Run migrations on Railway: `pnpm --filter @ai-visibility/db prisma migrate deploy`
- 🔄 Create seed script if missing in `packages/db/prisma/seed.ts`
- 🔄 Seed demo data with sample workspaces, prompts, and engines

### 2.2 Verify Infrastructure Connectivity
- 🔄 Test PostgreSQL connection via Prisma
- 🔄 Test Redis connection via ioredis
- ✅ Verify health check endpoints (`/healthz`, `/readyz`)

## Phase 3: Provider Integration & Testing

### 3.1 Configure Mock Providers
- 🔄 Update `packages/providers/src/perplexity-provider.ts`
- 🔄 Update `packages/providers/src/aio-provider.ts`
- 🔄 Update `packages/providers/src/brave-provider.ts`
- 🔄 Ensure fixture loading works correctly

### 3.2 Test Provider Interfaces
- 🔄 Verify all provider methods work in mock mode
- 🔄 Test `ask()`, `healthCheck()`, `getCostEstimate()`
- 🔄 Test parsing logic for mentions, citations, sentiment

## Phase 4: API Integration & Endpoint Testing

### 4.1 Test Core Endpoints
- 🔄 Health: `GET /healthz`, `GET /readyz`
- 🔄 Metrics: `GET /v1/metrics/overview`, `GET /v1/metrics/citations/top-domains`
- 🔄 Prompts: `GET /v1/prompts`, `POST /v1/prompts`
- 🔄 Engines: `GET /v1/engines`, `PUT /v1/engines/:id`
- 🔄 Copilot: `GET /v1/copilot/rules`, `GET /v1/copilot/actions`
- 🔄 Connections: `GET /v1/connections`
- 🔄 Alerts: `GET /v1/alerts`
- 🔄 Reports: `GET /v1/reports`
- 🔄 Admin: `GET /v1/admin/system`

### 4.2 Fix Any Missing Implementations
- 🔄 Check each controller/service for missing implementations
- 🔄 Add mock responses where needed

### 4.3 Generate OpenAPI Specification
- 🔄 Start API server: `pnpm --filter @ai-visibility/api dev`
- 🔄 Access Swagger UI at `http://localhost:8080/v1/docs`
- 🔄 Export OpenAPI JSON spec for frontend client generation

## Phase 5: Queue & Worker Testing

### 5.1 Verify Queue Infrastructure
- 🔄 Test BullMQ queues with Railway Redis
- 🔄 `runPrompt` queue for individual prompt runs
- 🔄 `runBatch` queue for batch processing
- 🔄 `dailyAggregations` queue for metrics aggregation
- 🔄 `copilotPlanner` queue for automated actions

### 5.2 Test Workers End-to-End
- 🔄 Start jobs worker: `pnpm --filter @ai-visibility/jobs dev`
- 🔄 Trigger test jobs via API endpoints
- 🔄 Verify job processing in logs
- 🔄 Check DLQ (dead letter queue) handling

### 5.3 Test Copilot Automation
- 🔄 Create test copilot rules
- 🔄 Trigger planner worker
- 🔄 Verify proposed actions are created
- 🔄 Test approval workflow

## Phase 6: Observability & Monitoring

### 6.1 Prometheus Metrics
- 🔄 Verify metrics endpoint: `GET /metrics`
- 🔄 Check HTTP request metrics
- 🔄 Check queue job metrics
- 🔄 Check provider API call metrics

### 6.2 Logging & Error Tracking
- 🔄 Verify structured logging with Pino
- 🔄 Test correlation ID propagation
- 🔄 Verify exception filter catches errors

### 6.3 Health Checks
- ✅ Verify `/healthz` returns basic health
- 🔄 Verify `/readyz` checks database and Redis connectivity
- 🔄 Test `/v1/admin/system` returns comprehensive system metrics

## Phase 7: Security & Rate Limiting

### 7.1 JWT Authentication
- 🔄 Test protected endpoints require valid JWT
- 🔄 Test `DEBUG_JWT_MODE=true` allows unauthenticated requests
- 🔄 Test `DEBUG_JWT_MODE=false` enforces authentication
- 🔄 Verify JWT payload extraction

### 7.2 Rate Limiting
- 🔄 Verify Throttler guard is applied globally
- 🔄 Test rate limit headers in responses
- 🔄 Test rate limit enforcement

### 7.3 Input Validation
- 🔄 Verify ValidationPipe is working
- 🔄 Test malformed request bodies are rejected
- 🔄 Test SQL injection protection via Prisma

## Phase 8: Production Deployment Preparation (Railway)

### 8.1 Docker Build & Test
- ✅ Railway deployment working with standalone server
- 🔄 Build full NestJS API with all features
- 🔄 Test API with Railway PostgreSQL and Redis
- 🔄 Verify all endpoints work in production

### 8.2 Railway Production Configuration
- ✅ Railway PostgreSQL service configured
- ✅ Railway Redis service configured
- ✅ Environment variables set
- 🔄 Configure Railway health checks
- 🔄 Set up Railway monitoring

### 8.3 Deployment Scripts & Documentation
- 🔄 Create Railway deployment guide
- 🔄 Document Railway database setup
- 🔄 Document Railway Redis setup
- 🔄 Add troubleshooting section

## Phase 9: CI/CD Pipeline

### 9.1 Create GitHub Actions Workflow
- 🔄 Create `.github/workflows/ci.yml`
- 🔄 Run tests on PR
- 🔄 Run linting and type checking
- 🔄 Build and test with Railway services

### 9.2 Railway Deployment
- 🔄 Deploy to Railway on main branch push
- 🔄 Run database migrations
- 🔄 Verify deployment health

## Phase 10: Final Verification & Documentation

### 10.1 End-to-End Testing
- 🔄 Start all services on Railway
- 🔄 Run through complete user flow
- 🔄 Test all API endpoints
- 🔄 Verify database operations
- 🔄 Test queue processing

### 10.2 Update Documentation
- 🔄 Update `README.md` with Railway quick start
- 🔄 Verify `RUNBOOK.md` has operational procedures
- 🔄 Document Railway environment variables
- 🔄 Create API usage examples

### 10.3 Production Readiness Checklist
- 🔄 All tests passing
- 🔄 Railway deployment working
- 🔄 Health checks working
- 🔄 Database connectivity verified
- 🔄 Redis connectivity verified
- 🔄 JWT authentication configured
- 🔄 Rate limiting enabled
- 🔄 Database migrations ready
- 🔄 Environment variables documented
- 🔄 Monitoring setup

## Current Status: Phase 2 - Database & Infrastructure Setup

### Next Steps:
1. **Generate Prisma client**: `pnpm --filter @ai-visibility/db prisma generate`
2. **Run migrations on Railway**: `pnpm --filter @ai-visibility/db prisma migrate deploy`
3. **Test database connectivity**
4. **Move to Phase 3: Provider Integration**



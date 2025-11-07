# AI Visibility Platform

A production-ready monorepo for AI-powered content visibility and brand monitoring, built with TypeScript, NestJS, and React.

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Environment Setup

1. **Copy environment variables:**
```bash
cp .env.example .env
```

2. **Configure your environment:**
Edit `.env` with your API keys and settings:
- `PERPLEXITY_API_KEY` - Perplexity API key
- `SERPAPI_KEY` - SerpAPI key for Google AI Overviews
- `BRAVE_API_KEY` - Brave Search API key
- `JWT_SECRET` - JWT signing secret
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

### Development

1. **Install dependencies:**
```bash
pnpm install
```

2. **Start infrastructure:**
```bash
docker-compose -f infra/docker-compose.yml up -d
```

3. **Run database migrations:**
```bash
pnpm --filter @ai-visibility-platform/db prisma migrate dev
```

4. **Seed demo data:**
```bash
pnpm --filter @ai-visibility-platform/db prisma db seed
```

5. **Start all services:**
```bash
pnpm dev
```

This will start:
- API server on `http://localhost:3000`
- Jobs worker
- React SPA on `http://localhost:5173`

## Quickstart (dev)

```bash
pnpm i
docker compose -f infra/docker-compose.yml up -d

# envs
cp .env.example .env

# prisma
pnpm --filter @ai-visibility-platform/db prisma migrate dev
pnpm --filter @ai-visibility-platform/db prisma db seed

# run api and workers
pnpm --filter @apps/api dev
pnpm --filter @apps/jobs dev
```

API: http://localhost:8080

Swagger: http://localhost:8080/v1/docs

Health: /healthz, /readyz, /metrics

Admin: /v1/admin/system (JWT protected; use DEBUG_JWT_MODE in dev)

### API Documentation

Once running, visit:
- **Swagger UI**: `http://localhost:3000/api`
- **Health Check**: `http://localhost:3000/healthz`
- **Metrics**: `http://localhost:3000/metrics`

### Self-Serve Demo via Swagger

To run the live demo workflow end-to-end, follow the step-by-step guide in `docs/demo-swagger-guide.md`. It covers generating the summary, expanding prompts, selecting competitors, queuing the analysis run, tracking progress, and reviewing the resulting insights/recommendations directly from Swagger.

## Architecture

### Monorepo Structure
```
ai-visibility-platform/
├── apps/
│   ├── api/          # NestJS REST API
│   └── jobs/         # BullMQ workers & schedulers
├── packages/
│   ├── shared/       # Types, schemas, client
│   ├── db/           # Prisma schema & migrations
│   ├── providers/    # AI provider integrations
│   ├── parser/       # Content parsing utilities
│   ├── optimizer/    # Content optimization
│   └── copilot/      # Rules engine & automation
└── infra/
    └── docker-compose.yml
```

### Key Features

- **Multi-Provider AI**: Perplexity, Google AI Overviews, Brave Search
- **Content Optimization**: TL;DR, FAQ blocks, JSON-LD, unified diff
- **Brand Defense**: Hallucination detection, automated responses
- **Observability**: Sentry, OpenTelemetry, Prometheus metrics
- **Cost Management**: Per-workspace budgets, auto-throttling
- **Security**: JWT auth, rate limiting, input validation
- **Testing**: Unit, contract, E2E tests with fixtures

## API Endpoints

### Core Endpoints
- `POST /v1/instant-summary` - Generate instant summaries
- `GET /v1/metrics/overview` - Workspace metrics
- `GET /v1/citations/top-domains` - Top citation domains
- `GET /v1/prompts` - List prompts
- `GET /v1/engines` - Available AI engines
- `GET /v1/copilot/rules` - Copilot rules
- `GET /v1/copilot/actions` - Copilot actions
- `GET /v1/connections` - Data connections
- `GET /v1/alerts` - System alerts
- `GET /v1/reports` - Generated reports

### Admin Endpoints
- `GET /v1/admin/system` - System metrics
- `GET /healthz` - Health check
- `GET /readyz` - Readiness check

## CORS Configuration

The API is configured for CORS with the following settings:
- **Allowed Origins**: `http://localhost:5173` (development), `https://yourdomain.com` (production)
- **Allowed Methods**: `GET, POST, PUT, DELETE, OPTIONS`
- **Allowed Headers**: `Content-Type, Authorization, X-Requested-With`
- **Credentials**: `true`

## JWT Authentication

The API uses JWT tokens for authentication:
- **Header**: `Authorization: Bearer <token>`
- **Strategy**: Lovable Cloud JWKS
- **Guard**: Applied to all protected routes
- **Claims**: User ID, workspace ID, permissions

## Provider Switching

The platform supports multiple AI providers:

### Perplexity
- **Endpoint**: `https://api.perplexity.ai/chat/completions`
- **Models**: `llama-3.1-sonar-small-128k-online`, `llama-3.1-sonar-large-128k-online`
- **Features**: Real-time web search, citations
- **Cost**: $0.20/1M input tokens, $0.20/1M output tokens

### Google AI Overviews (via SerpAPI)
- **Endpoint**: `https://serpapi.com/search`
- **Features**: Google AI Overviews, search results
- **Cost**: $50/1M searches

### Brave Search
- **Endpoint**: `https://api.search.brave.com/res/v1/web/search`
- **Features**: Web search, summarization
- **Cost**: $3/1M queries

## Deployment

### Production Environment Variables
```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"
REDIS_URL="redis://host:6379"

# Observability
SENTRY_DSN="https://your-sentry-dsn"
OTEL_EXPORTER_OTLP_ENDPOINT="https://your-otel-endpoint"

# Feature Flags
FEATURE_FLAGS_ENABLED=true
FEATURE_FLAGS_API_KEY="your-flags-api-key"

# Storage
STORAGE_PROVIDER="s3"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
S3_BUCKET="your-bucket"
```

### Docker Deployment
```bash
# Build images
docker build -t ai-visibility-api apps/api/
docker build -t ai-visibility-jobs apps/jobs/

# Run with docker-compose
docker-compose up -d
```

### Health Checks
- **Health**: `GET /healthz` - Basic health check
- **Readiness**: `GET /readyz` - Ready to serve traffic
- **Metrics**: `GET /metrics` - Prometheus metrics

## Monitoring

### Metrics
- **HTTP Requests**: Duration, status codes, error rates
- **Queue Metrics**: Job processing, failures, retries
- **Provider Metrics**: API calls, costs, rate limits
- **Database Metrics**: Connection pool, query performance

### Alerts
- **Budget Alerts**: Cost threshold exceeded
- **Rate Limit Alerts**: Provider rate limits hit
- **Error Alerts**: High error rates
- **Performance Alerts**: Slow response times

## Testing

### Run Tests
```bash
# All tests
pnpm test

# Specific package
pnpm --filter @ai-visibility-platform/shared test

# E2E tests
pnpm --filter @ai-visibility-platform/api test:e2e
```

### Test Types
- **Unit Tests**: Jest with mocks
- **Contract Tests**: Provider API contracts
- **E2E Tests**: Full integration with docker-compose
- **Fixtures**: Record/replay for external APIs

## Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Run tests**: `pnpm test`
5. **Run linting**: `pnpm lint`
6. **Submit a pull request**

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- **GitHub Issues**: Report bugs and feature requests
- **Documentation**: Check the `/docs` directory
- **Runbook**: See `RUNBOOK.md` for operational procedures
# Railway deployment trigger Sat Oct 25 13:12:26 IST 2025

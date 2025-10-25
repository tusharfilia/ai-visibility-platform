# AI Visibility Platform - Runbook

Operational procedures and troubleshooting guide for the AI Visibility Platform.

## Table of Contents
1. [System Overview](#system-overview)
2. [Health Checks](#health-checks)
3. [Monitoring & Alerts](#monitoring--alerts)
4. [Common Issues](#common-issues)
5. [Deployment Procedures](#deployment-procedures)
6. [Database Operations](#database-operations)
7. [Queue Management](#queue-management)
8. [Provider Management](#provider-management)
9. [Security Procedures](#security-procedures)
10. [Emergency Procedures](#emergency-procedures)

## System Overview

### Architecture
- **API Server**: NestJS REST API on port 3000
- **Jobs Worker**: BullMQ workers for background processing
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis for caching and job queues
- **Frontend**: React SPA on port 5173

### Key Components
- **Providers**: Perplexity, Google AI Overviews, Brave Search
- **Queues**: runPrompt, runBatch, dailyAggregations, copilotPlanner
- **Modules**: Auth, Metrics, Prompts, Engines, Copilot, Connections, Alerts, Reports

## Health Checks

### Basic Health Check
```bash
curl http://localhost:3000/healthz
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

### Readiness Check
```bash
curl http://localhost:3000/readyz
```

**Expected Response:**
```json
{
  "status": "ready",
  "database": "connected",
  "redis": "connected",
  "queues": "healthy"
}
```

### Detailed Health Check
```bash
curl http://localhost:3000/v1/admin/system
```

**Expected Response:**
```json
{
  "system": {
    "uptime": 3600,
    "memory": {
      "used": "100MB",
      "total": "512MB"
    },
    "database": {
      "connections": 5,
      "maxConnections": 20
    },
    "queues": {
      "runPrompt": { "waiting": 0, "active": 2, "completed": 100 },
      "runBatch": { "waiting": 0, "active": 1, "completed": 50 },
      "dailyAggregations": { "waiting": 0, "active": 0, "completed": 7 },
      "copilotPlanner": { "waiting": 0, "active": 0, "completed": 3 }
    },
    "providers": {
      "perplexity": { "status": "healthy", "rateLimit": "100/100" },
      "aio": { "status": "healthy", "rateLimit": "1000/1000" },
      "brave": { "status": "healthy", "rateLimit": "100/100" }
    }
  }
}
```

## Monitoring & Alerts

### Key Metrics
- **HTTP Metrics**: Request duration, status codes, error rates
- **Queue Metrics**: Job processing, failures, retries
- **Provider Metrics**: API calls, costs, rate limits
- **Database Metrics**: Connection pool, query performance

### Alert Conditions
- **Budget Alerts**: Cost threshold exceeded (>$100/day)
- **Rate Limit Alerts**: Provider rate limits hit (>90%)
- **Error Alerts**: High error rates (>5% in 5 minutes)
- **Performance Alerts**: Slow response times (>2s p95)

### Prometheus Metrics
```bash
curl http://localhost:3000/metrics
```

**Key Metrics:**
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration
- `queue_jobs_total` - Queue job counts
- `provider_api_calls_total` - Provider API calls
- `database_connections_active` - Active database connections

## Common Issues

### 1. Database Connection Issues

**Symptoms:**
- 500 errors on API endpoints
- "Database connection failed" in logs
- Health check shows database as "disconnected"

**Diagnosis:**
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
curl http://localhost:3000/v1/admin/system | jq '.system.database'
```

**Resolution:**
1. Check database URL in `.env`
2. Verify database is running: `docker-compose ps`
3. Check connection limits in Prisma schema
4. Restart API server: `pnpm --filter @ai-visibility-platform/api restart`

### 2. Redis Connection Issues

**Symptoms:**
- Queue jobs not processing
- Cache misses
- "Redis connection failed" in logs

**Diagnosis:**
```bash
# Check Redis connectivity
redis-cli -u $REDIS_URL ping

# Check queue status
curl http://localhost:3000/v1/admin/system | jq '.system.queues'
```

**Resolution:**
1. Check Redis URL in `.env`
2. Verify Redis is running: `docker-compose ps`
3. Check Redis memory usage: `redis-cli info memory`
4. Restart jobs worker: `pnpm --filter @ai-visibility-platform/jobs restart`

### 3. Provider API Issues

**Symptoms:**
- Provider errors in logs
- Rate limit exceeded errors
- High provider costs

**Diagnosis:**
```bash
# Check provider status
curl http://localhost:3000/v1/admin/system | jq '.system.providers'

# Check provider logs
grep "ProviderError" logs/api.log
```

**Resolution:**
1. Check API keys in `.env`
2. Verify provider rate limits
3. Check provider costs in cost ledger
4. Enable auto-throttling if needed

### 4. Queue Processing Issues

**Symptoms:**
- Jobs stuck in queue
- High queue latency
- Failed job retries

**Diagnosis:**
```bash
# Check queue status
curl http://localhost:3000/v1/admin/system | jq '.system.queues'

# Check failed jobs
redis-cli -u $REDIS_URL llen "bull:runPrompt:failed"
```

**Resolution:**
1. Check worker logs: `pnpm --filter @ai-visibility-platform/jobs logs`
2. Restart workers: `pnpm --filter @ai-visibility-platform/jobs restart`
3. Clear failed jobs if needed
4. Check job payloads for errors

## Deployment Procedures

### Pre-deployment Checklist
- [ ] All tests passing: `pnpm test`
- [ ] Linting clean: `pnpm lint`
- [ ] Type checking: `pnpm typecheck`
- [ ] Database migrations ready
- [ ] Environment variables configured
- [ ] Feature flags set appropriately

### Deployment Steps

1. **Build applications:**
```bash
pnpm build
```

2. **Run database migrations:**
```bash
pnpm --filter @ai-visibility-platform/db prisma migrate deploy
```

3. **Deploy API server:**
```bash
# Using Docker
docker build -t ai-visibility-api apps/api/
docker run -d --name api-server ai-visibility-api

# Using PM2
pm2 start apps/api/dist/main.js --name api-server
```

4. **Deploy jobs worker:**
```bash
# Using Docker
docker build -t ai-visibility-jobs apps/jobs/
docker run -d --name jobs-worker ai-visibility-jobs

# Using PM2
pm2 start apps/jobs/dist/index.js --name jobs-worker
```

5. **Verify deployment:**
```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/readyz
```

### Rollback Procedures

1. **Stop current services:**
```bash
docker stop api-server jobs-worker
# or
pm2 stop api-server jobs-worker
```

2. **Revert to previous version:**
```bash
git checkout previous-version
pnpm build
docker build -t ai-visibility-api apps/api/
docker run -d --name api-server ai-visibility-api
```

3. **Verify rollback:**
```bash
curl http://localhost:3000/healthz
```

## Database Operations

### Migrations

**Create migration:**
```bash
pnpm --filter @ai-visibility-platform/db prisma migrate dev --name migration-name
```

**Apply migrations:**
```bash
pnpm --filter @ai-visibility-platform/db prisma migrate deploy
```

**Reset database:**
```bash
pnpm --filter @ai-visibility-platform/db prisma migrate reset
```

### Seeding

**Seed demo data:**
```bash
pnpm --filter @ai-visibility-platform/db prisma db seed
```

**Custom seed script:**
```bash
pnpm --filter @ai-visibility-platform/db prisma db seed --script custom-seed.ts
```

### Backup & Restore

**Backup database:**
```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

**Restore database:**
```bash
psql $DATABASE_URL < backup-20240101.sql
```

## Queue Management

### Queue Operations

**Check queue status:**
```bash
curl http://localhost:3000/v1/admin/system | jq '.system.queues'
```

**Pause queue:**
```bash
redis-cli -u $REDIS_URL lpush "bull:runPrompt:paused" "true"
```

**Resume queue:**
```bash
redis-cli -u $REDIS_URL del "bull:runPrompt:paused"
```

**Clear failed jobs:**
```bash
redis-cli -u $REDIS_URL del "bull:runPrompt:failed"
```

### Job Management

**Retry failed job:**
```bash
redis-cli -u $REDIS_URL lpush "bull:runPrompt:waiting" '{"id":"job-id","data":{...}}'
```

**Check job status:**
```bash
redis-cli -u $REDIS_URL hgetall "bull:runPrompt:job-id"
```

## Provider Management

### Provider Configuration

**Check provider status:**
```bash
curl http://localhost:3000/v1/admin/system | jq '.system.providers'
```

**Update provider settings:**
```bash
# Update environment variables
export PERPLEXITY_API_KEY="new-key"
export SERPAPI_KEY="new-key"
export BRAVE_API_KEY="new-key"

# Restart services
pnpm --filter @ai-visibility-platform/api restart
pnpm --filter @ai-visibility-platform/jobs restart
```

### Cost Management

**Check costs:**
```bash
# Query cost ledger
psql $DATABASE_URL -c "SELECT * FROM cost_ledger ORDER BY created_at DESC LIMIT 10;"
```

**Set budget alerts:**
```bash
# Update workspace budget
psql $DATABASE_URL -c "UPDATE workspaces SET budget_daily = 100 WHERE id = 'workspace-id';"
```

## Security Procedures

### Authentication Issues

**Check JWT configuration:**
```bash
# Verify JWT secret
echo $JWT_SECRET

# Check JWKS endpoint
curl https://your-jwks-endpoint/.well-known/jwks.json
```

**Token validation:**
```bash
# Test token validation
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/v1/admin/system
```

### Rate Limiting

**Check rate limits:**
```bash
# Check current rate limit status
curl http://localhost:3000/v1/admin/system | jq '.system.rateLimits'
```

**Adjust rate limits:**
```bash
# Update rate limit configuration
export RATE_LIMIT_REQUESTS_PER_MINUTE=100
export RATE_LIMIT_BURST=200
```

## Emergency Procedures

### System Down

1. **Check health endpoints:**
```bash
curl http://localhost:3000/healthz
curl http://localhost:3000/readyz
```

2. **Check logs:**
```bash
tail -f logs/api.log
tail -f logs/jobs.log
```

3. **Restart services:**
```bash
pnpm --filter @ai-visibility-platform/api restart
pnpm --filter @ai-visibility-platform/jobs restart
```

4. **Check infrastructure:**
```bash
docker-compose ps
docker-compose logs
```

### Database Issues

1. **Check database connectivity:**
```bash
psql $DATABASE_URL -c "SELECT 1"
```

2. **Check connection pool:**
```bash
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity;"
```

3. **Restart database:**
```bash
docker-compose restart postgres
```

### High Load

1. **Check queue status:**
```bash
curl http://localhost:3000/v1/admin/system | jq '.system.queues'
```

2. **Scale workers:**
```bash
# Increase worker concurrency
export WORKER_CONCURRENCY=10
pnpm --filter @ai-visibility-platform/jobs restart
```

3. **Enable auto-throttling:**
```bash
export AUTO_THROTTLE_ENABLED=true
export AUTO_THROTTLE_THRESHOLD=0.8
```

### Security Incident

1. **Check audit logs:**
```bash
psql $DATABASE_URL -c "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100;"
```

2. **Check for suspicious activity:**
```bash
grep "ERROR" logs/api.log | grep -i "auth\|security"
```

3. **Revoke compromised tokens:**
```bash
# Update JWT secret
export JWT_SECRET="new-secret"
pnpm --filter @ai-visibility-platform/api restart
```

4. **Enable additional monitoring:**
```bash
export SENTRY_DSN="your-sentry-dsn"
export OTEL_EXPORTER_OTLP_ENDPOINT="your-otel-endpoint"
```

## Contact Information

- **On-call Engineer**: [Your contact info]
- **Escalation**: [Manager contact info]
- **Emergency**: [Emergency contact info]

## Additional Resources

- **GitHub Repository**: [Repository URL]
- **Documentation**: [Documentation URL]
- **Monitoring Dashboard**: [Dashboard URL]
- **Logs**: [Logs URL]

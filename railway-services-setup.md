# Railway Services Setup Guide

## Step 1: Add PostgreSQL Service
1. Go to your Railway project dashboard
2. Click "New Service" → "Database" → "PostgreSQL"
3. Railway will automatically set `DATABASE_URL` environment variable

## Step 2: Add Redis Service  
1. Click "New Service" → "Database" → "Redis"
2. Railway will automatically set `REDIS_URL` environment variable

## Step 3: Configure Environment Variables
Copy these to your Railway environment variables:

### Core Server
- `PORT=8080`
- `NODE_ENV=production`
- `CORS_ALLOWED_ORIGINS=https://ai-visibility-platform-production.up.railway.app`

### Auth (Lovable Cloud)
- `AUTH_JWT_ISSUER=https://auth.lovable.dev`
- `AUTH_JWT_AUDIENCE=ai-visibility-platform`
- `AUTH_JWT_JWKS_URL=https://auth.lovable.dev/.well-known/jwks.json`
- `DEBUG_JWT_MODE=false`

### Providers (Set your actual API keys)
- `MOCK_PROVIDERS=false`
- `PERPLEXITY_API_KEY=your_actual_perplexity_key`
- `SERPAPI_KEY=your_actual_serpapi_key`
- `BRAVE_API_KEY=your_actual_brave_key`

### Feature Flags
- `PERPLEXITY_ENABLED=true`
- `AIO_ENABLED=true`
- `BRAVE_ENABLED=true`
- `FULL_AUTO_DEFAULT=false`
- `BRAND_DEFENSE_ENABLED=true`

### Observability (Optional for now)
- `SENTRY_DSN=your_sentry_dsn`
- `OTEL_EXPORTER_OTLP_ENDPOINT=your_otel_endpoint`
- `PROMETHEUS_ENABLED=true`
- `PROMETHEUS_METRICS_PORT=9464`

### Cost Management
- `BUDGET_DAILY_DEFAULT=500`
- `AUTO_THROTTLE_ENABLED=true`

## Step 4: Verify Services
After adding services, verify:
1. PostgreSQL service is running
2. Redis service is running  
3. Environment variables are set
4. Your app can connect to both services



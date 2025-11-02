# 🚀 Quick Git Push for Railway Deployment

## Critical Files to Push

For Railway to deploy with **real API integrations**, you need to push:

### ✅ Must Push (Critical for Production):
1. **Provider Real API Implementations:**
   - `packages/providers/src/perplexity-provider.ts` (real API calls)
   - `packages/providers/src/brave-provider.ts` (real API calls)
   - `packages/providers/src/aio-provider.ts` (real SerpAPI calls)

2. **Railway Configuration:**
   - `railway.toml` (fixed port to 8080)

3. **Database Schema:**
   - `packages/db/prisma/schema.prisma` (includes all GEO enhancements)

4. **Core Module Updates:**
   - `apps/api/src/app.module.ts` (registers all modules)
   - `apps/api/package.json` (dependencies)
   - `apps/jobs/src/index.ts` (registers all workers)
   - `apps/jobs/src/queues/index.ts` (all queues)
   - `package.json` (root workspace config)

5. **GEO Data Service (Real DB Queries):**
   - `apps/api/src/modules/geo/geo-data.service.ts` (real queries)
   - `apps/api/src/modules/geo/geo-optimization.controller.ts` (uses real data)

---

## Quick Commit & Push

### Option 1: Commit Everything (Recommended)

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "feat: Add real API integrations (Perplexity, Brave, SerpAPI) and Railway deployment config

- Implement real Perplexity API calls with citation extraction
- Implement real Brave Search API integration
- Implement real Google AI Overviews via SerpAPI
- Replace mock data with real database queries in GEODataService
- Fix railway.toml port configuration (8080)
- Add all environment variables configuration
- Update providers to use MOCK_PROVIDERS=false for production"

# Push to GitHub (triggers Railway auto-deploy)
git push origin main
```

### Option 2: Commit Only Critical Files (Selective)

```bash
# Stage only critical production files
git add railway.toml
git add packages/providers/src/perplexity-provider.ts
git add packages/providers/src/brave-provider.ts
git add packages/providers/src/aio-provider.ts
git add packages/db/prisma/schema.prisma
git add apps/api/src/app.module.ts
git add apps/api/src/modules/geo/
git add apps/api/package.json
git add apps/jobs/src/index.ts
git add apps/jobs/src/queues/index.ts
git add apps/jobs/src/workers/run-prompt-worker.ts
git add package.json
git add railway.env.example
git add docs/

# Commit
git commit -m "feat: Production-ready real API integrations and Railway config"

# Push
git push origin main
```

---

## After Push

1. **Railway Auto-Deploys:**
   - Railway detects push to `main` branch
   - Triggers new deployment automatically
   - Uses `railway.toml` for build/deploy config

2. **Add Environment Variables:**
   - Go to Railway Dashboard → Variables tab
   - Add all from `railway.env.example`

3. **Run Migrations:**
   - After deployment, run: `railway run pnpm --filter @ai-visibility/db prisma migrate deploy`

4. **Verify:**
   - Check logs: Railway Dashboard → Logs
   - Health check: `curl https://your-app.railway.app/healthz`

---

## What Gets Deployed

After push, Railway will:
- ✅ Build with `pnpm install && pnpm build`
- ✅ Start with `pnpm --filter @ai-visibility/api start`
- ✅ Use port 8080 (from railway.toml)
- ✅ Health check on `/healthz`

**But remember:** Environment variables (API keys) still need to be added in Railway Dashboard!

---

## Recommended: Commit Everything

Since you have comprehensive changes (real APIs, GEO enhancements, infrastructure), I recommend committing everything:

```bash
git add .
git commit -m "feat: Complete production deployment - Real API integrations, Railway config, GEO enhancements

- Real Perplexity, Brave, SerpAPI integrations
- Real database queries (no mock data)
- Railway deployment configuration
- Complete GEO compliance enhancements
- All infrastructure modules and workers"

git push origin main
```

**This ensures Railway has ALL the latest code!**


# Current Railway Configuration Summary

## ✅ What's Already Configured

### 1. `railway.toml` File (Root)
```toml
[build]
builder = "nixpacks"
buildCommand = "pnpm install && pnpm build"

[deploy]
startCommand = "pnpm --filter @ai-visibility/api start"
healthcheckPath = "/healthz"
healthcheckTimeout = 300
restartPolicyType = "always"

[env]
NODE_ENV = "production"
PORT = "8080"

[scale]
minInstances = 1
maxInstances = 10
targetConcurrency = 100

[networking]
internalPort = 3000  # ⚠️ NOTE: This might conflict with PORT=8080
externalPort = 443
protocol = "https"

[healthcheck]
path = "/healthz"
interval = 30
timeout = 10
retries = 3
```

### 2. Environment Variables (From Docs)
**Already documented but may not all be set in Railway:**

**Core:**
- ✅ `PORT=8080` (in railway.toml)
- ✅ `NODE_ENV=production` (in railway.toml)
- ⚠️ `CORS_ALLOWED_ORIGINS` (needs your actual domain)

**Auth (Lovable):**
- ✅ `AUTH_JWT_ISSUER=https://auth.lovable.dev`
- ✅ `AUTH_JWT_AUDIENCE=ai-visibility-platform`
- ✅ `AUTH_JWT_JWKS_URL=https://auth.lovable.dev/.well-known/jwks.json`
- ✅ `DEBUG_JWT_MODE=false`

**Database & Redis:**
- ✅ `DATABASE_URL` (auto-set by Railway PostgreSQL service)
- ✅ `REDIS_URL` (auto-set by Railway Redis service)

**LLM Providers (You Have These):**
- ✅ `OPENAI_API_KEY` (from docs - already have)
- ✅ `ANTHROPIC_API_KEY` (from docs - already have)
- ✅ `GOOGLE_AI_API_KEY` (from docs - already have)

**Email:**
- ✅ `RESEND_API_KEY` (from docs - already have)

**Cloudflare R2:**
- ✅ `CLOUDFLARE_R2_ACCESS_KEY_ID` (from docs - already have)
- ✅ `CLOUDFLARE_R2_SECRET_ACCESS_KEY` (from docs - already have)
- ✅ `CLOUDFLARE_R2_ENDPOINT` (from docs - already have)
- ✅ `CLOUDFLARE_R2_BUCKET` (from docs - already have)
- ✅ `CLOUDFLARE_ACCOUNT_ID` (from docs - already have)

**Search Providers (Need These 3):**
- ❌ `PERPLEXITY_API_KEY` ← **Need to add**
- ❌ `BRAVE_API_KEY` ← **Need to add**
- ❌ `SERPAPI_KEY` ← **Need to add**

**Feature Flags:**
- ⚠️ `MOCK_PROVIDERS=false` (should be set)
- ⚠️ `PERPLEXITY_ENABLED=true`
- ⚠️ `AIO_ENABLED=true`
- ⚠️ `BRAVE_ENABLED=true`
- ⚠️ `FULL_AUTO_DEFAULT=false`
- ⚠️ `BRAND_DEFENSE_ENABLED=true`

**Observability (Optional):**
- ⚠️ `SENTRY_DSN` (optional)
- ⚠️ `OTEL_EXPORTER_OTLP_ENDPOINT` (optional)
- ⚠️ `PROMETHEUS_ENABLED=true`
- ⚠️ `PROMETHEUS_METRICS_PORT=9464`

**Cost Management:**
- ⚠️ `BUDGET_DAILY_DEFAULT=500`
- ⚠️ `AUTO_THROTTLE_ENABLED=true`

### 3. Services Needed
- ⚠️ **PostgreSQL Service** - Need to verify if created
- ⚠️ **Redis Service** - Need to verify if created

### 4. Port Configuration Issue
⚠️ **Potential Issue:** `railway.toml` has `internalPort = 3000` but `PORT = 8080` is set in env.
- The app listens on `8080` (from `main.ts`: `configService.get('PORT', 8080)`)
- Railway may be trying to route to `3000`
- **Recommendation:** Update `railway.toml` to match: `internalPort = 8080`

---

## 🔍 How to Check Your Current Railway Configuration

### Option 1: Railway Dashboard
1. Go to https://railway.app/dashboard
2. Select your project
3. Click on your API service
4. Go to **Variables** tab → See all environment variables
5. Go to **Settings** tab → See build/deploy config
6. Check **Services** → See if PostgreSQL and Redis exist

### Option 2: Railway CLI (If Installed)
```bash
# List all services
railway status

# Check environment variables
railway variables

# Check service connections
railway logs
```

### Option 3: Show Me Your Config
You can:
1. **Screenshot** your Railway dashboard (Variables tab)
2. **Export** your environment variables (Railway Dashboard → Variables → Export)
3. **Copy/paste** the list from Railway Variables tab
4. Tell me what services you already have (PostgreSQL? Redis? Both?)

---

## 🎯 What We Need to Do Next

### Step 1: Verify Current State
- [ ] Check if PostgreSQL service exists
- [ ] Check if Redis service exists
- [ ] List all current environment variables
- [ ] Check if any deployments have run

### Step 2: Fix Port Mismatch (If Needed)
- [ ] Update `railway.toml` → `internalPort = 8080` (to match PORT env var)

### Step 3: Add Missing Variables
- [ ] Add `PERPLEXITY_API_KEY` (once you get it)
- [ ] Add `BRAVE_API_KEY` (once you get it)
- [ ] Add `SERPAPI_KEY` (once you get it)
- [ ] Verify `MOCK_PROVIDERS=false`
- [ ] Verify all feature flags are set

### Step 4: Verify Build/Deploy
- [ ] Ensure build command works: `pnpm install && pnpm build`
- [ ] Ensure start command works: `pnpm --filter @ai-visibility/api start`
- [ ] Verify health check: `/healthz` endpoint

---

## 📋 Quick Checklist

**Before I configure:**
1. Do you have PostgreSQL service? (Yes/No)
2. Do you have Redis service? (Yes/No)
3. What's your Railway project URL? (e.g., `https://ai-visibility-platform-production.up.railway.app`)
4. Have you deployed before? (Yes/No - did it work?)
5. Any current environment variables already set? (list them or export)

**After you get API keys:**
1. Get Perplexity key
2. Get Brave key
3. Get SerpAPI key
4. I'll add them all at once to Railway config

---

## 💡 Recommendations

1. **Fix port mismatch** in `railway.toml` (change `internalPort = 3000` to `8080`)
2. **Consolidate env var docs** - We have 3 different docs with slightly different vars
3. **Verify services exist** before deployment
4. **Test locally first** - Make sure `pnpm --filter @ai-visibility/api start` works locally

---

**Tell me what you see in your Railway dashboard and I'll tailor the configuration perfectly!**


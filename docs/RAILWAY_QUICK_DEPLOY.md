# 🚂 Railway Quick Deploy Guide

## Step 1: Get 3 API Keys (5 minutes)

### 1. Perplexity
- URL: https://www.perplexity.ai/settings/api
- Action: Sign up → Generate API Key
- Key format: `pplx-...`

### 2. Brave Search
- URL: https://brave.com/search/api/
- Action: Sign up → Get Subscription Token
- Key format: `BSA_...`

### 3. SerpAPI (Google AI Overviews)
- URL: https://serpapi.com/
- Action: Sign up (free 100/month) → Copy API Key
- Key format: Long alphanumeric string

---

## Step 2: Railway Setup

### A. Create Services
1. **PostgreSQL**: New Service → Database → PostgreSQL
2. **Redis**: New Service → Database → Redis

### B. Add Environment Variables

Go to your **API Service** → **Variables** tab → Add all these:

```bash
# ===== CRITICAL =====
NODE_ENV=production
PORT=8080
MOCK_PROVIDERS=false

# ===== NEW KEYS (get from Step 1) =====
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxx
BRAVE_API_KEY=BSA_xxxxxxxxxxxxx
SERPAPI_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ===== EXISTING KEYS (add your keys) =====
OPENAI_API_KEY=YOUR_OPENAI_KEY_HERE
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_KEY_HERE
GOOGLE_AI_API_KEY=YOUR_GOOGLE_AI_KEY_HERE
RESEND_API_KEY=YOUR_RESEND_KEY_HERE

# ===== CLOUDFLARE R2 =====
CLOUDFLARE_R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID_HERE
CLOUDFLARE_R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY_HERE
CLOUDFLARE_R2_ENDPOINT=YOUR_R2_ENDPOINT_HERE
CLOUDFLARE_R2_BUCKET=ai-visibility-assets
CLOUDFLARE_ACCOUNT_ID=YOUR_R2_ACCOUNT_ID_HERE

# ===== AUTH =====
AUTH_JWT_ISSUER=https://auth.lovable.dev
AUTH_JWT_AUDIENCE=ai-visibility-platform
AUTH_JWT_JWKS_URL=https://auth.lovable.dev/.well-known/jwks.json
DEBUG_JWT_MODE=false

# ===== CORS =====
CORS_ALLOWED_ORIGINS=*

# ===== FEATURE FLAGS =====
PERPLEXITY_ENABLED=true
AIO_ENABLED=true
BRAVE_ENABLED=true
FULL_AUTO_DEFAULT=false
BRAND_DEFENSE_ENABLED=true

# ===== OBSERVABILITY =====
PROMETHEUS_ENABLED=true
LOG_LEVEL=info

# ===== COST =====
BUDGET_DAILY_DEFAULT=500
AUTO_THROTTLE_ENABLED=true
```

**Note:** Railway automatically adds `DATABASE_URL` and `REDIS_URL` from the PostgreSQL and Redis services.

---

## Step 3: Deploy

1. **Auto-deploy**: Push to main branch → Railway auto-deploys
2. **Manual deploy**: Railway Dashboard → Deployments → "Deploy Now"

---

## Step 4: Run Database Migration

After first deployment, run migrations:

```bash
# Option 1: Railway CLI
railway run pnpm --filter @ai-visibility/db prisma migrate deploy

# Option 2: Railway Dashboard → Connect to PostgreSQL → Run SQL
# Or use Railway Shell
```

---

## Step 5: Verify

```bash
# Health check
curl https://your-app.railway.app/healthz
# Expected: {"status":"ok"}

# System status (requires auth token)
curl https://your-app.railway.app/v1/admin/system
# Should show providers, queues, DB status
```

---

## 🎯 Why Only 3? Let's Add More!

**Currently:** 7 engines (3 LLM + 3 Search + 1 Copilot)

**After these 3 keys, we can add:**

1. **Bing Chat** (Microsoft)
2. **You.com** (AI search)
3. **Tavily** (search API)
4. **Cohere** (Command R+)
5. **Mistral AI** (Mistral Large)
6. **xAI Grok** (Twitter AI)
7. **Groq** (fast Llama inference)

**Want me to add all of these? Just say "add more providers"!**

---

## ✅ Done!

Your platform will now have:
- ✅ Real Perplexity API calls
- ✅ Real Brave Search API calls
- ✅ Real Google AI Overviews (via SerpAPI)
- ✅ All 6 providers working with real data

**Total time: ~10 minutes**


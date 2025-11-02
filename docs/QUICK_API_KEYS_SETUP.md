# Quick API Keys Setup Guide

## 🚀 Get These 3 API Keys (5 minutes)

### 1. Perplexity API Key

**Steps:**
1. Go to: https://www.perplexity.ai/settings/api
2. Sign up / Log in
3. Click "Generate API Key"
4. Copy the key

**Add to Railway:**
```
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 2. Brave Search API Key

**Steps:**
1. Go to: https://brave.com/search/api/
2. Click "Get Started" or "API Access"
3. Sign up for API access
4. Get your "Subscription Token" (starts with `BSA_`)
5. Copy the token

**Add to Railway:**
```
BRAVE_API_KEY=BSA_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 3. SerpAPI Key (for Google AI Overviews)

**Steps:**
1. Go to: https://serpapi.com/
2. Click "Sign Up" (free tier: 100 searches/month)
3. Verify email
4. Go to Dashboard → API Key
5. Copy the key

**Add to Railway:**
```
SERPAPI_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Pricing:** Free tier = 100 searches/month, then $50/1M searches

---

## 🎯 Why Only 3? We Can Add More!

Currently we have **7 engines** total:
- ✅ **OpenAI** (you have key)
- ✅ **Anthropic** (you have key)
- ✅ **Gemini** (you have key)
- ⚠️ **Perplexity** (need key) ← **Get this**
- ⚠️ **Brave** (need key) ← **Get this**
- ⚠️ **Google AIO** via SerpAPI (need key) ← **Get this**
- ⚠️ **Azure Copilot** (needs `AZURE_OPENAI_API_KEY`)

### Additional Providers We Can Add (Make It More Exhaustive):

**High Priority (Popular AI Engines):**
1. **Bing Chat** - Microsoft's AI (free, but needs API access)
2. **You.com** - You.com AI search engine
3. **Tavily** - AI-powered search API
4. **Cohere** - Command R+ models
5. **Mistral AI** - Mistral Large, Mistral Small

**Medium Priority:**
6. **xAI Grok** - Twitter/X AI (if API available)
7. **Groq** - Fast inference for Llama models
8. **Replicate** - Meta Llama models

**After we get the 3 base keys, I can quickly add 5-10 more providers to make it truly exhaustive!**

---

## 🚂 Railway Configuration (Quick Setup)

### Step 1: Add Services in Railway

1. **PostgreSQL**:
   - Railway Dashboard → New Service → Database → PostgreSQL
   - ✅ Auto-sets `DATABASE_URL`

2. **Redis**:
   - Railway Dashboard → New Service → Database → Redis
   - ✅ Auto-sets `REDIS_URL`

### Step 2: Add All Environment Variables

Go to Railway Dashboard → Your API Service → Variables tab → Add these:

```bash
# ===== Core =====
NODE_ENV=production
PORT=8080
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com

# ===== Already Have (add your keys) =====
OPENAI_API_KEY=YOUR_OPENAI_KEY_HERE
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_KEY_HERE
GOOGLE_AI_API_KEY=YOUR_GOOGLE_AI_KEY_HERE
RESEND_API_KEY=YOUR_RESEND_KEY_HERE

# ===== Cloudflare R2 =====
CLOUDFLARE_R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID_HERE
CLOUDFLARE_R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY_HERE
CLOUDFLARE_R2_ENDPOINT=YOUR_R2_ENDPOINT_HERE
CLOUDFLARE_R2_BUCKET=ai-visibility-assets
CLOUDFLARE_ACCOUNT_ID=YOUR_R2_ACCOUNT_ID_HERE

# ===== Get These 3 Keys (see above) =====
PERPLEXITY_API_KEY=YOUR_PERPLEXITY_KEY_HERE
BRAVE_API_KEY=YOUR_BRAVE_KEY_HERE
SERPAPI_KEY=YOUR_SERPAPI_KEY_HERE

# ===== Critical =====
MOCK_PROVIDERS=false

# ===== Auth =====
AUTH_JWT_ISSUER=https://auth.lovable.dev
AUTH_JWT_AUDIENCE=ai-visibility-platform
AUTH_JWT_JWKS_URL=https://auth.lovable.dev/.well-known/jwks.json
DEBUG_JWT_MODE=false

# ===== Feature Flags =====
PERPLEXITY_ENABLED=true
AIO_ENABLED=true
BRAVE_ENABLED=true
FULL_AUTO_DEFAULT=false
BRAND_DEFENSE_ENABLED=true

# ===== Observability =====
PROMETHEUS_ENABLED=true
LOG_LEVEL=info

# ===== Cost Management =====
BUDGET_DAILY_DEFAULT=500
AUTO_THROTTLE_ENABLED=true
```

### Step 3: Deploy

Railway will auto-deploy on git push, or manually trigger:
- Railway Dashboard → Deployments → "Deploy Now"

---

## ✅ Quick Verification

After deployment:

```bash
# 1. Health check
curl https://your-api.railway.app/healthz
# Should return: {"status":"ok"}

# 2. System status
curl https://your-api.railway.app/v1/admin/system \
  -H "Authorization: Bearer YOUR_TOKEN"
# Should show: providers enabled, queue depths, DB/Redis status
```

---

## 🎯 After These 3 Keys, We Can Add More Providers

Want me to add these to make it more exhaustive?

1. **Bing Chat API** (Microsoft)
2. **You.com API**
3. **Tavily Search API**
4. **Cohere API**
5. **Mistral AI API**
6. **xAI Grok** (if available)
7. **Groq API** (for fast Llama inference)

**Just say "add more providers" and I'll implement them all!**


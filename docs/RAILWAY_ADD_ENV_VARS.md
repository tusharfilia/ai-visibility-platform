# 🚀 Quick: Add Environment Variables to Existing Railway Service

## ✅ What You Already Have

From your Railway dashboard, I can see:
- ✅ **Postgres Service** - Connected (auto `DATABASE_URL`)
- ✅ **Redis Service** - Connected (auto `REDIS_URL`)
- ✅ **AI Visibility Platform Service** - Deployed from GitHub

**All infrastructure is ready!** Just need to add the environment variables.

---

## 📋 Step 1: Add Environment Variables (3 minutes)

### Go to Your API Service Variables

1. Click on **"ai-visibility-platform"** service in Railway dashboard
2. Go to **"Variables"** tab
3. Click **"+ New Variable"** for each variable below

### Copy-Paste These Variables

**Quick batch add:**

```
NODE_ENV=production
PORT=8080
MOCK_PROVIDERS=false
PERPLEXITY_API_KEY=YOUR_PERPLEXITY_KEY_HERE
BRAVE_API_KEY=YOUR_BRAVE_KEY_HERE
SERPAPI_KEY=YOUR_SERPAPI_KEY_HERE
OPENAI_API_KEY=YOUR_OPENAI_KEY_HERE
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_KEY_HERE
GOOGLE_AI_API_KEY=YOUR_GOOGLE_AI_KEY_HERE
RESEND_API_KEY=YOUR_RESEND_KEY_HERE
CLOUDFLARE_R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID_HERE
CLOUDFLARE_R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY_HERE
CLOUDFLARE_R2_ENDPOINT=YOUR_R2_ENDPOINT_HERE
CLOUDFLARE_R2_BUCKET=ai-visibility-assets
CLOUDFLARE_ACCOUNT_ID=YOUR_R2_ACCOUNT_ID_HERE
AUTH_JWT_ISSUER=https://auth.lovable.dev
AUTH_JWT_AUDIENCE=ai-visibility-platform
AUTH_JWT_JWKS_URL=https://auth.lovable.dev/.well-known/jwks.json
DEBUG_JWT_MODE=false
CORS_ALLOWED_ORIGINS=*
PERPLEXITY_ENABLED=true
AIO_ENABLED=true
BRAVE_ENABLED=true
FULL_AUTO_DEFAULT=false
BRAND_DEFENSE_ENABLED=true
PROMETHEUS_ENABLED=true
LOG_LEVEL=info
BUDGET_DAILY_DEFAULT=500
AUTO_THROTTLE_ENABLED=true
```

**Note:** Railway automatically provides `DATABASE_URL` and `REDIS_URL` from your Postgres and Redis services - you don't need to add those manually.

---

## 📋 Step 2: Check Existing Variables (Optional)

Before adding, you can check if any variables already exist:
- Railway Dashboard → Your API Service → Variables tab
- If any of the above variables already exist, you can either:
  - **Update** them with the new values (especially the 3 new API keys)
  - **Keep** them if they're correct

---

## 📋 Step 3: Redeploy After Adding Variables

After adding variables, Railway will automatically:
- Trigger a new deployment
- Inject the variables into your app
- Restart the service

**OR manually trigger:**
- Railway Dashboard → Your API Service → Deployments → "Deploy Now"

---

## 📋 Step 4: Verify Variables Are Set

### Option A: Railway Dashboard
- Variables tab → Should show all variables listed above

### Option B: Check Logs
- Railway Dashboard → Your API Service → Logs
- Look for startup logs showing environment is configured
- Should NOT see errors like "Missing API key" or "MOCK_PROVIDERS not set"

### Option C: Test Health Check
```bash
curl https://your-app.railway.app/healthz
# Expected: {"status":"ok"}
```

---

## 📋 Step 5: Run Database Migrations (If Needed)

If this is the first time deploying with the new schema, run migrations:

**Option A: Railway CLI**
```bash
railway run pnpm --filter @ai-visibility/db prisma migrate deploy
```

**Option B: Railway Dashboard Shell**
1. Railway Dashboard → Your API Service → Shell tab
2. Run:
```bash
pnpm --filter @ai-visibility/db prisma migrate deploy
```

**Note:** If you've already run migrations before, skip this step.

---

## ✅ Verification Checklist

After adding variables and redeploying:

- [ ] All environment variables added (check Variables tab)
- [ ] Service redeployed (check Deployments tab - latest deployment is "Deploying" or "Active")
- [ ] Health check works: `curl https://your-app.railway.app/healthz`
- [ ] Logs show no errors about missing API keys
- [ ] `MOCK_PROVIDERS=false` is set (check Variables tab)
- [ ] Database migrations run (if first time)

---

## 🎯 What Happens Next

Once variables are added and deployed:

1. ✅ **All 6 providers will make REAL API calls:**
   - OpenAI ✅
   - Anthropic ✅
   - Gemini ✅
   - Perplexity ✅ (NEW - using real API)
   - Brave ✅ (NEW - using real API)
   - Google AIO via SerpAPI ✅ (NEW - using real API)

2. ✅ **No more mock data** - All database queries are real

3. ✅ **Production-ready** - Full GEO platform working live

---

## 🐛 Troubleshooting

**If service won't start:**
- Check Logs tab for error messages
- Verify all required variables are set
- Ensure `PORT=8080` matches `railway.toml` config

**If API keys not working:**
- Verify keys are copied correctly (no extra spaces)
- Check Logs tab for specific API errors
- Test keys manually if needed

**If database connection fails:**
- Verify `DATABASE_URL` is auto-set by Railway (from Postgres service)
- Check Postgres service is running (green status)
- Verify connection string in Variables tab

---

**Total time: ~5 minutes!**

Once you add the variables, your platform will be 100% production-ready! 🚀


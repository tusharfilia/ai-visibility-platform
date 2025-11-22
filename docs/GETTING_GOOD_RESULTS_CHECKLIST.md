# ✅ Getting Good Results - Complete Checklist

After implementing OpenAI key rotation, here's everything you need to do to get high-quality results:

## 🔑 1. Configure OpenAI Keys (DONE ✅)

You've already implemented this! Just make sure your 5 keys are set in Railway:

**Option A: Comma-separated (Easiest)**
```
OPENAI_API_KEY=sk-key1,sk-key2,sk-key3,sk-key4,sk-key5
```

**Option B: Individual variables**
```
OPENAI_API_KEY_1=sk-key1
OPENAI_API_KEY_2=sk-key2
OPENAI_API_KEY_3=sk-key3
OPENAI_API_KEY_4=sk-key4
OPENAI_API_KEY_5=sk-key5
```

---

## 🔧 2. Fix Frontend Bug (CRITICAL)

**Issue**: Frontend sometimes calls API with empty domain parameter, causing 400 errors.

**Fix**: Already fixed in the code - just needs to be deployed to frontend.

**Location**: `geku/src/pages/InstantSummary.tsx` line 263

---

## 🔌 3. Ensure Jobs Service is Running

The analysis jobs need to be running to process prompts and generate results.

**Check if jobs service is deployed:**
- Railway Dashboard → Check if `ai-visibility-jobs` service exists
- If not, create it:
  1. New Service → GitHub Repo
  2. Root Directory: `apps/jobs`
  3. Start Command: `pnpm start`

**Required environment variables for jobs service:**
- `DATABASE_URL` (auto-set by Railway)
- `REDIS_URL` (auto-set by Railway)
- `OPENAI_API_KEY` (or multiple keys)
- `ANTHROPIC_API_KEY`
- `GOOGLE_AI_API_KEY`
- `PERPLEXITY_API_KEY`
- `BRAVE_API_KEY`
- `SERPAPI_KEY`

---

## 🔑 4. Verify All API Keys Are Set

In Railway → API Service → Variables tab, ensure you have:

### LLM Providers (Required)
- ✅ `OPENAI_API_KEY` (or 5 keys via rotation)
- ✅ `ANTHROPIC_API_KEY`
- ✅ `GOOGLE_AI_API_KEY`

### Search Engine Providers (Required)
- ✅ `PERPLEXITY_API_KEY`
- ✅ `BRAVE_API_KEY`
- ✅ `SERPAPI_KEY` (for Google AI Overviews)

### Optional (but recommended)
- `RESEND_API_KEY` (for emails)
- Cloudflare R2 keys (for file storage)

---

## 🚀 5. Deploy Latest Code

Make sure both services are deployed with latest code:

1. **API Service**: Should auto-deploy from GitHub
2. **Jobs Service**: Should auto-deploy from GitHub
3. **Frontend**: Deploy the fix for empty domain parameter

---

## 📊 6. Test the Flow

1. **Go to landing page**: Enter a domain (e.g., `paypal.com`)
2. **Check instant-summary page**: Should load without 400 errors
3. **Wait for analysis**: Jobs should process prompts (takes 1-2 minutes)
4. **Verify results**: Should see:
   - Business summary (not empty)
   - Industry-specific prompts (not generic)
   - Competitors detected
   - Engine visibility (not all "Missing")
   - GEO Score > 0
   - Citations and Share of Voice data

---

## 🐛 7. Monitor Logs

Check Railway logs for:

**API Service logs should show:**
- ✅ No 429 errors (keys rotating properly)
- ✅ No 404 model errors (using correct model names)
- ✅ Industry detection working
- ✅ Entity extraction working
- ✅ GEO Score calculating

**Jobs Service logs should show:**
- ✅ Workers processing jobs
- ✅ Prompt runs completing
- ✅ No queue errors

---

## ⚠️ 8. Common Issues & Fixes

### Issue: All engines show "Missing"
**Fix**: 
- Check if jobs service is running
- Verify `PERPLEXITY_API_KEY`, `BRAVE_API_KEY`, `SERPAPI_KEY` are set
- Check jobs service logs for errors

### Issue: Business summary is empty
**Fix**:
- Check if LLM providers are working (no 429/404 errors)
- Verify `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY` are set
- Check API logs for LLM failures

### Issue: Prompts are generic ("Best General Business...")
**Fix**:
- Industry detection might be failing
- Check logs for industry detection errors
- Ensure LLM providers are working

### Issue: GEO Score is 0 or very low
**Fix**:
- Analysis jobs might not be completing
- Check jobs service is running
- Verify prompts are being processed
- Check database for prompt runs and answers

### Issue: 400 errors with empty domain
**Fix**: 
- Frontend bug fix needs to be deployed
- Check `geku/src/pages/InstantSummary.tsx` line 263

---

## 📈 9. Expected Results After Setup

Once everything is configured correctly, you should see:

✅ **Business Summary**: Detailed, industry-specific summary (not empty)
✅ **Prompts**: Industry-specific prompts like "Best payment processing solutions" (not "Best General Business")
✅ **Competitors**: Real competitors detected (not empty)
✅ **Engine Visibility**: At least some engines showing "Visible" (not all "Missing")
✅ **GEO Score**: Score > 0, ideally 30-100 depending on data
✅ **Citations**: Top citations showing with domains
✅ **Share of Voice**: Data showing brand mentions
✅ **Key Insights**: Actionable insights displayed

---

## 🎯 10. Quick Verification Commands

After deployment, test these endpoints:

```bash
# Test instant summary
curl "https://your-api.railway.app/v1/demo/instant-summary?domain=paypal.com"

# Check health
curl "https://your-api.railway.app/v1/healthz"

# Check status (after getting demoRunId)
curl "https://your-api.railway.app/v1/demo/status/{demoRunId}"
```

---

## 📝 Summary

**What you've done:**
- ✅ OpenAI key rotation implemented

**What's left:**
1. ✅ Fix frontend empty domain bug (code fixed, needs deploy)
2. ⚠️ Ensure jobs service is running
3. ⚠️ Verify all API keys are set in Railway
4. ⚠️ Deploy latest code to all services
5. ⚠️ Test and monitor logs

**Priority order:**
1. **HIGH**: Fix frontend bug (prevents 400 errors)
2. **HIGH**: Ensure jobs service is running (needed for analysis)
3. **MEDIUM**: Verify all API keys (needed for quality results)
4. **LOW**: Monitor and optimize

Once these are done, you should see significantly better results! 🚀


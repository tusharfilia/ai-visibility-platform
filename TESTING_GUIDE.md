# 🧪 Testing Guide - GEO Platform Quality Improvements

## ✅ Pre-Flight Checklist

### 1. Build All Packages
```bash
# From project root
pnpm install
pnpm --filter @ai-visibility/geo build
pnpm --filter @ai-visibility/prompts build
pnpm --filter @ai-visibility/shared build
```

### 2. Verify Environment Variables

**Required for API Service:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PERPLEXITY_API_KEY` - For Perplexity search
- `BRAVE_API_KEY` - For Brave search
- `SERPAPI_KEY` - For Google AI Overviews (AIO)
- `OPENAI_API_KEY` - For LLM requests (optional, for entity extraction)
- `ANTHROPIC_API_KEY` - For LLM requests (optional)
- `GOOGLE_AI_API_KEY` - For LLM requests (optional)

**Required for Jobs Service:**
- Same as API service (especially `SERPAPI_KEY` for AIO)

### 3. Database Migrations
```bash
# Ensure database is migrated
cd apps/api
pnpm prisma migrate deploy
# OR for development
pnpm prisma migrate dev
```

---

## 🧪 Testing Steps

### Test 1: Entity Extraction Service

**Endpoint:** `GET /v1/demo/instant-summary?domain=example.com`

**What it tests:**
- EntityExtractorService integration
- SchemaAuditorService usage
- PageStructureAnalyzerService usage
- FactExtractorService usage
- Parallel execution of analysis services
- LLM entity extraction

**Expected behavior:**
1. Fetches website HTML
2. Runs schema audit, structure analysis, and fact extraction in parallel
3. Generates comprehensive entity data
4. Returns structured business entity information

**Test command:**
```bash
curl -X GET "http://localhost:8080/v1/demo/instant-summary?domain=stripe.com" \
  -H "Content-Type: application/json"
```

**Success criteria:**
- Returns 200 status
- Response includes `summary`, `entityData`, `prompts`, `competitors`
- Entity data includes: `businessName`, `category`, `vertical`, `services`, `geography`
- No errors in logs

---

### Test 2: Competitor Detection Service

**What it tests:**
- CompetitorDetectorService multi-source detection
- Direct, content, authority, and GEO competitor detection
- Parallel execution of detection methods
- Evidence tracking and confidence scoring

**Expected behavior:**
1. Detects competitors from 4 sources in parallel
2. Combines and deduplicates results
3. Returns competitors with confidence scores and evidence

**Test via instant-summary endpoint:**
```bash
curl -X GET "http://localhost:8080/v1/demo/instant-summary?domain=stripe.com" \
  -H "Content-Type: application/json" | jq '.competitors'
```

**Success criteria:**
- Returns 3-8 competitors
- Each competitor has `domain`, `name`, `type`, `confidence`
- Competitors are deduplicated
- Evidence array is populated

---

### Test 3: Intent-Based Prompt Generation

**What it tests:**
- IntentClustererService
- Intent-based prompt clustering (BEST, ALTERNATIVES, HOWTO, PRICING, COMPARISON)
- LLM prompt generation with entity context

**Expected behavior:**
1. Generates prompts across multiple intent types
2. Each prompt has intent classification
3. Prompts are relevant to the business entity

**Test via instant-summary endpoint:**
```bash
curl -X GET "http://localhost:8080/v1/demo/instant-summary?domain=stripe.com" \
  -H "Content-Type: application/json" | jq '.prompts'
```

**Success criteria:**
- Returns 3-8 prompts
- Prompts cover different intent types
- Prompts are relevant to the business

---

### Test 4: Diagnostic Insights Service

**Endpoint:** `GET /v1/demo/insights/:demoRunId`

**What it tests:**
- DiagnosticInsightsService parallel execution
- Visibility blocker detection
- Trust gap detection
- Schema gap detection
- Competitor advantage detection
- Evidence-backed insights

**Prerequisites:**
- Must have a completed demo run (from Test 1)

**Test command:**
```bash
# First get a demo run ID from instant-summary
DEMO_RUN_ID="<from-instant-summary-response>"

curl -X GET "http://localhost:8080/v1/demo/insights/${DEMO_RUN_ID}" \
  -H "Content-Type: application/json" | jq '.insightHighlights'
```

**Success criteria:**
- Returns array of insight highlights
- Insights are evidence-backed
- Insights include impact scores
- Insights are actionable

---

### Test 5: Enhanced Recommendations

**Endpoint:** `GET /v1/demo/recommendations/:demoRunId`

**What it tests:**
- Evidence-based recommendation generation
- Impact scoring
- Engine mapping
- Priority sorting

**Test command:**
```bash
curl -X GET "http://localhost:8080/v1/demo/recommendations/${DEMO_RUN_ID}" \
  -H "Content-Type: application/json" | jq '.recommendations'
```

**Success criteria:**
- Returns 5-10 recommendations
- Each recommendation has `title`, `description`, `priority`, `category`
- Recommendations are sorted by priority
- Action items are included

---

### Test 6: Engine Bias Simulation

**What it tests:**
- EngineBiasSimulatorService
- Engine-specific scoring
- Cross-engine comparison

**Note:** This is used internally by other services. Test via:
- GEO score calculation
- Diagnostic insights (engine-specific recommendations)

---

### Test 7: Evidence Graph Builder

**What it tests:**
- Fact-level consensus tracking
- Cross-engine consensus
- Fact validation against profile

**Note:** This is used internally. Test via:
- Diagnostic insights (fact validation)
- Share of voice calculations

---

### Test 8: Copilot Task Mapping

**What it tests:**
- InsightCopilotMapperService
- Insight to Copilot action mapping
- Weekly optimization plan generation

**Note:** This is used internally. Test via:
- Recommendations endpoint (should include Copilot-ready tasks)

---

## 🔍 Manual Testing Checklist

### Local Development Testing

1. **Start services:**
   ```bash
   # Terminal 1: API Service
   cd apps/api
   pnpm dev

   # Terminal 2: Jobs Service (if testing job processing)
   cd apps/jobs
   pnpm dev
   ```

2. **Test instant summary flow:**
   - Open frontend or use curl
   - Enter a domain (e.g., `stripe.com`)
   - Verify all sections populate:
     - ✅ Business summary
     - ✅ Auto-generated prompts (3-8)
     - ✅ Competitors (3-8)
     - ✅ Engine visibility status
     - ✅ GEO score and insights

3. **Check logs for:**
   - No errors in EntityExtractorService
   - Parallel execution messages
   - Successful LLM calls
   - Proper error handling

---

## 🚨 Common Issues & Fixes

### Issue 1: "Cannot find module @ai-visibility/geo"
**Fix:**
```bash
pnpm install
pnpm --filter @ai-visibility/geo build
```

### Issue 2: "SchemaAuditorService is not defined"
**Fix:** Ensure all dependencies are in DemoModule providers (already fixed)

### Issue 3: "Missing API key for engine AIO"
**Fix:** Set `SERPAPI_KEY` in environment variables (not `AIO_API_KEY`)

### Issue 4: "Entity extraction failed"
**Fix:** 
- Check internet connectivity (needs to fetch website)
- Verify domain is accessible
- Check LLM API keys are set

### Issue 5: "Competitor detection returns empty"
**Fix:**
- Ensure LLM API keys are set
- Check logs for LLM errors
- Verify domain is valid

---

## 📊 Success Metrics

After testing, you should see:

1. **Entity Extraction:**
   - ✅ Comprehensive business entity data
   - ✅ Schema types detected
   - ✅ Structure analysis completed
   - ✅ Facts extracted

2. **Competitor Detection:**
   - ✅ 4+ competitors detected
   - ✅ Multiple competitor types (direct, content, authority, GEO)
   - ✅ Confidence scores > 0.5
   - ✅ Evidence provided

3. **Prompt Generation:**
   - ✅ 5+ prompts generated
   - ✅ Multiple intent types covered
   - ✅ Prompts are relevant

4. **Insights:**
   - ✅ 5+ diagnostic insights
   - ✅ Evidence-backed
   - ✅ Impact scores included

5. **Recommendations:**
   - ✅ 5+ recommendations
   - ✅ Prioritized correctly
   - ✅ Actionable items included

---

## 🚀 Production Readiness Checklist

- [ ] All packages built successfully
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] API service starts without errors
- [ ] Jobs service starts without errors
- [ ] Instant summary endpoint returns data
- [ ] Entity extraction works
- [ ] Competitor detection works
- [ ] Prompt generation works
- [ ] Insights generation works
- [ ] Recommendations generation works
- [ ] No TypeScript errors
- [ ] No runtime errors in logs

---

## 🎯 Quick Test Script

Save this as `test-instant-summary.sh`:

```bash
#!/bin/bash

API_URL="${1:-http://localhost:8080}"
DOMAIN="${2:-stripe.com}"

echo "Testing instant summary for ${DOMAIN}..."
echo "API URL: ${API_URL}"
echo ""

RESPONSE=$(curl -s -X GET "${API_URL}/v1/demo/instant-summary?domain=${DOMAIN}" \
  -H "Content-Type: application/json")

echo "Status: $(echo $RESPONSE | jq -r '.ok // "error"')"
echo ""
echo "Summary: $(echo $RESPONSE | jq -r '.data.summary // "N/A"')"
echo ""
echo "Prompts: $(echo $RESPONSE | jq -r '.data.prompts | length // 0')"
echo "Competitors: $(echo $RESPONSE | jq -r '.data.competitors | length // 0')"
echo "Engines: $(echo $RESPONSE | jq -r '.data.engines | length // 0')"
echo ""
echo "Full response:"
echo $RESPONSE | jq '.'
```

Run with:
```bash
chmod +x test-instant-summary.sh
./test-instant-summary.sh http://localhost:8080 stripe.com
```

---

## 📝 Next Steps After Testing

1. **If all tests pass:**
   - Deploy to Railway
   - Monitor logs for first real requests
   - Verify production environment variables

2. **If tests fail:**
   - Check error logs
   - Verify environment variables
   - Ensure all packages are built
   - Check database connectivity

3. **Performance optimization:**
   - Monitor parallel execution performance
   - Check LLM API rate limits
   - Optimize caching if needed

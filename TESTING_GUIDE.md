# Testing Guide: Premium Diagnostic Intelligence

## ✅ What's Ready

The diagnostic intelligence layer is **fully integrated** and ready for frontend testing:

1. ✅ All premium services have diagnostic methods
2. ✅ Diagnostics are generated in `getInstantSummary` endpoint
3. ✅ Frontend types are updated to include diagnostics
4. ✅ Response structure matches frontend expectations

## 🧪 How to Test

### 1. **API Endpoint Testing**

#### Test the Instant Summary Endpoint:
```bash
# Replace with your API URL (local or deployed)
curl -X GET "http://localhost:3000/v1/demo/instant-summary?domain=airbnb.com" \
  -H "Content-Type: application/json"
```

#### Expected Response Structure:
```json
{
  "ok": true,
  "data": {
    "data": {
      "demoRunId": "...",
      "workspaceId": "...",
      "domain": "airbnb.com",
      "brand": "Airbnb",
      "industry": { ... },
      "summary": { ... },
      "prompts": [ ... ],
      "competitors": [ ... ],
      "shareOfVoice": [ ... ],
      "citations": [ ... ],
      "geoScore": { ... },
      "eeatScore": { ... },
      "engines": [ ... ],
      "status": "...",
      "progress": 0-100,
      "totalJobs": 0,
      "completedJobs": 0
    },
    "evidence": [ ... ],
    "confidence": 0.0-1.0,
    "warnings": [ ... ],
    "explanation": "...",
    "diagnostics": {
      "insights": [ ... ],
      "strengths": [ ... ],
      "weaknesses": [ ... ],
      "risks": [ ... ],
      "recommendations": [ ... ],
      "engineReasoning": [ ... ],
      "opportunities": [ ... ],
      "competitiveThreats": [ ... ]
    },
    "metadata": { ... }
  }
}
```

### 2. **Frontend Testing**

#### Start the Frontend:
```bash
cd geku
npm install
npm run dev
```

#### Test Flow:
1. Navigate to `http://localhost:5173/instant-summary?domain=airbnb.com`
2. The page should:
   - Load the instant summary
   - Display all premium data sections
   - Show diagnostics in the response (currently not displayed in UI, but available in data)

#### Check Browser Console:
```javascript
// In browser console, check the response:
const response = await fetch('http://localhost:3000/v1/demo/instant-summary?domain=airbnb.com');
const data = await response.json();
console.log('Diagnostics:', data.data.diagnostics);
```

### 3. **Verify Diagnostic Data**

#### Check Each Diagnostic Category:

**Insights:**
- Should contain insights from all services (summary, prompts, competitors, GEO score, SOV, citations)
- Each insight should have: `type`, `category`, `title`, `description`, `reasoning`, `impact`, `confidence`, `evidence`

**Strengths:**
- Filtered insights where `type === 'strength'`
- Should highlight positive aspects (high SOV, strong citations, good schema, etc.)

**Weaknesses:**
- Filtered insights where `type === 'weakness'`
- Should identify areas for improvement (low visibility, missing citations, etc.)

**Risks:**
- Threat assessments from summary diagnostics
- Should identify potential issues (hallucination risk, trust degradation, etc.)

**Recommendations:**
- Actionable recommendations from all services
- Each should have: `title`, `description`, `category`, `priority`, `difficulty`, `expectedImpact`, `steps`, `estimatedTime`

**Engine Reasoning:**
- Per-engine analysis from summary diagnostics
- Should explain how each engine interprets the business

**Opportunities:**
- Visibility opportunities from prompt diagnostics
- Should identify high-value prompts with low visibility

**Competitive Threats:**
- Competitive threat assessments from competitor diagnostics
- Should identify competitors with higher visibility

### 4. **Test Different Scenarios**

#### Test with Different Domains:
```bash
# Local business
curl "http://localhost:3000/v1/demo/instant-summary?domain=example-plumber.com"

# SaaS company
curl "http://localhost:3000/v1/demo/instant-summary?domain=stripe.com"

# E-commerce
curl "http://localhost:3000/v1/demo/instant-summary?domain=shopify.com"
```

#### Test Error Handling:
```bash
# Missing domain
curl "http://localhost:3000/v1/demo/instant-summary"

# Invalid domain
curl "http://localhost:3000/v1/demo/instant-summary?domain=invalid"
```

### 5. **Verify Diagnostic Generation**

#### Check Logs:
The API service should log diagnostic generation:
```
[Premium] Step 8: Generating diagnostic intelligence
```

#### Verify All Services Generate Diagnostics:
- ✅ `PremiumBusinessSummaryService.generateSummaryDiagnostics()`
- ✅ `EvidenceBackedPromptGeneratorService.generatePromptDiagnostics()`
- ✅ `PremiumCompetitorDetectorService.generateCompetitorDiagnostics()`
- ✅ `PremiumGEOScoreService.generateGEOScoreDiagnostics()`
- ✅ `EvidenceBackedShareOfVoiceService.generateSOVDiagnostics()` (NEW)
- ✅ `PremiumCitationService.generateCitationDiagnostics()` (NEW)

### 6. **Frontend Integration Checklist**

- [x] Types are defined in `geku/src/types/premium.ts`
- [ ] Frontend displays diagnostics (optional - can be added later)
- [x] Response structure matches frontend expectations
- [x] Diagnostics are always present (even if empty arrays)

## 🐛 Troubleshooting

### Issue: Diagnostics are empty arrays
**Solution:** This is normal if:
- Analysis hasn't completed yet (status !== 'analysis_complete')
- No data has been collected yet
- Services failed to generate diagnostics (check logs)

### Issue: Missing diagnostic methods
**Solution:** Verify all services are properly injected in `DemoModule`:
- `DiagnosticIntelligenceService` must be provided before services that use it
- All premium services should have diagnostic methods

### Issue: Frontend type errors
**Solution:** 
1. Ensure `geku/src/types/premium.ts` includes `DiagnosticBreakdown`
2. Restart TypeScript server in your IDE
3. Run `npm run build` in the frontend to check for type errors

## 📊 Expected Diagnostic Counts

After a complete analysis, you should see:
- **Insights:** 10-30+ (from all services)
- **Strengths:** 2-5 (if business has strong signals)
- **Weaknesses:** 5-15 (areas for improvement)
- **Risks:** 0-5 (potential threats)
- **Recommendations:** 10-25+ (actionable improvements)
- **Engine Reasoning:** 3 (one per engine: PERPLEXITY, AIO, BRAVE)
- **Opportunities:** 5-15 (high-value prompts with low visibility)
- **Competitive Threats:** 0-10 (depending on competitor count)

## 🚀 Next Steps

1. **Test the API endpoint** with a real domain
2. **Verify diagnostics are populated** in the response
3. **Check frontend can access diagnostics** (even if not displayed yet)
4. **Add UI components** to display diagnostics (optional enhancement)

## ✅ Ready for Frontend

**Yes, it's ready!** The diagnostic intelligence layer is:
- ✅ Fully integrated into the API
- ✅ Types are defined for the frontend
- ✅ Response structure matches expectations
- ✅ All services generate diagnostics
- ✅ Error handling is in place

The frontend can now access `response.data.diagnostics` and display it as needed.

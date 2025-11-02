# AI Visibility Platform - Demo Walkthrough

## Demo Scenario: Tracking "Stripe" Brand Visibility in AI Responses

This walkthrough shows how a company (let's use **Stripe** as an example) would use the AI Visibility Platform to monitor and optimize their brand's appearance in AI-generated answers across ChatGPT, Perplexity, Google AI Overviews, Claude, Gemini, and Copilot.

---

## 🎯 Demo Setup

### Step 1: Workspace & Brand Configuration

**API Call:**
```bash
POST /v1/workspaces
{
  "name": "Stripe Workspace",
  "brandName": "Stripe",
  "website": "https://stripe.com",
  "industry": "FinTech",
  "competitors": ["PayPal", "Square", "Adyen", "Checkout.com"]
}
```

**What happens:**
- Creates isolated workspace with workspaceId (e.g., `stripe-workspace-123`)
- Sets up multi-tenant isolation (all data scoped to this workspace)
- Creates initial workspace profile with canonical facts:
  - Founded: 2010
  - HQ: San Francisco
  - CEO: Patrick Collison
  - Services: Payment processing, billing, fraud prevention
  - Official website: stripe.com

---

## 📊 Step 2: Dashboard Overview - Current State

**API Call:**
```bash
GET /v1/metrics/overview?workspaceId=stripe-workspace-123
```

**Response:**
```json
{
  "totalPrompts": 247,
  "totalRuns": 1,234,
  "totalMentions": 892,
  "mentionRate": 72.3,
  "totalCitations": 1,456,
  "avgVisibilityScore": 67.5,
  "engines": {
    "PERPLEXITY": { "mentions": 342, "visibility": 72.1 },
    "OPENAI": { "mentions": 298, "visibility": 68.3 },
    "AIO": { "mentions": 187, "visibility": 61.2 },
    "ANTHROPIC": { "mentions": 65, "visibility": 59.8 }
  },
  "timeseries": [
    { "date": "2025-01-01", "visibility": 65.2 },
    { "date": "2025-01-15", "visibility": 67.5 }
  ]
}
```

**What it shows:**
- **Current visibility**: 67.5/100 across all AI engines
- **Best performing engine**: Perplexity (72.1 visibility)
- **Worst performing**: Claude (59.8 visibility)
- **Trend**: +2.3 points improvement in last 2 weeks

---

## 🔍 Step 3: Detailed Visibility Analysis

### A. Overall GEO Visibility Score

**API Call:**
```bash
GET /v1/geo/scoring/Stripe?engines=PERPLEXITY,OPENAI,AIO&competitors=PayPal,Square
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "overallScore": 67.5,
    "breakdown": {
      "mentionScore": 72.0,      // How often Stripe is mentioned
      "rankingScore": 68.5,      // Average position in AI responses
      "citationScore": 71.2,     // Quality of citation sources
      "competitorScore": 58.3,   // Vs. PayPal/Square (share of voice)
      "structuralScore": 65.0    // Schema, freshness, content structure
    },
    "details": {
      "totalMentions": 892,
      "averagePosition": 2.3,    // Stripe appears 2.3rd on average
      "topRankings": 156,        // #1 mentions
      "citationAuthority": 74.8,
      "topCitationDomains": [
        { "domain": "stripe.com", "count": 234, "authority": 95 },
        { "domain": "wikipedia.org", "count": 89, "authority": 92 },
        { "domain": "techcrunch.com", "count": 45, "authority": 78 }
      ]
    }
  }
}
```

### B. Engine-Specific Analysis

**What this reveals:**
- **Perplexity**: Higher Reddit citations (6.6%) → Need more Reddit presence
- **ChatGPT**: Strong on licensed publishers (News Corp, FT) → Opportunity for PR outreach
- **Google AIO**: Prefers curated/authority sources → Need Wikipedia, academic citations

---

## 📈 Step 4: GEO Maturity Score

**API Call:**
```bash
GET /v1/geo/maturity?workspaceId=stripe-workspace-123
```

**Response:**
```json
{
  "entityStrength": 78.5,      // Knowledge graph completeness
  "citationDepth": 71.2,       // Citation quality & diversity
  "structuralClarity": 82.3,    // Schema, freshness, page structure
  "updateCadence": 65.0,       // Content freshness
  "overallScore": 74.2,
  "maturityLevel": "advanced",  // beginner | intermediate | advanced | expert
  "recommendations": [
    {
      "type": "citation_gap",
      "priority": "high",
      "message": "You need 2 more trusted citations from licensed publishers (WSJ, FT)",
      "action": "SUBMIT_TO_DIRECTORY",
      "estimatedImpact": 15,
      "targetDomain": "wsj.com"
    },
    {
      "type": "reddit_presence",
      "priority": "medium",
      "message": "Low Reddit mentions (12 vs competitor avg 28). Consider AMA or case studies on r/entrepreneur",
      "action": "CREATE_REDDIT_CONTENT",
      "estimatedImpact": 12
    },
    {
      "type": "schema_gap",
      "priority": "low",
      "message": "About page missing Organization schema markup",
      "action": "ADD_SCHEMA_MARKUP",
      "targetUrl": "https://stripe.com/about",
      "estimatedImpact": 5
    }
  ]
}
```

**Insights:**
- **Maturity**: "Advanced" level (74.2/100)
- **Strong areas**: Structural clarity (82.3), Entity strength (78.5)
- **Weak areas**: Update cadence (65.0) - some pages stale
- **Top recommendation**: Get 2 more licensed publisher citations (WSJ, FT) → +15 visibility points

---

## 🎯 Step 5: Prescriptive Recommendations

**API Call:**
```bash
GET /v1/recommendations?workspaceId=stripe-workspace-123
```

**Response:**
```json
[
  {
    "type": "citation_opportunity",
    "priority": "critical",
    "message": "Competitors cited 5x on techcrunch.com/stripe. Submit press release or case study.",
    "action": "SUBMIT_PR_CONTENT",
    "estimatedImpact": 18,
    "effort": "medium",
    "targetDomain": "techcrunch.com"
  },
  {
    "type": "directory_presence",
    "priority": "high",
    "message": "Missing from G2 directory. Create listing to reach 50K+ B2B buyers.",
    "action": "SUBMIT_TO_DIRECTORY",
    "estimatedImpact": 14,
    "effort": "low",
    "targetDomain": "g2.com"
  },
  {
    "type": "freshness_gap",
    "priority": "medium",
    "message": "Product page last updated 180 days ago. Update with 2025 features.",
    "action": "UPDATE_CONTENT",
    "targetUrl": "https://stripe.com/products",
    "estimatedImpact": 8,
    "effort": "medium"
  },
  {
    "type": "reddit_strategy",
    "priority": "medium",
    "message": "Post case study on r/SaaS - competitors get 3x more mentions there.",
    "action": "CREATE_REDDIT_CONTENT",
    "estimatedImpact": 12,
    "effort": "low"
  }
]
```

**Action Plan:**
1. **Critical**: Submit PR to TechCrunch (18 point impact)
2. **High**: Create G2 listing (14 point impact)
3. **Medium**: Update product page (8 point impact)
4. **Medium**: Reddit case study (12 point impact)

**Total estimated impact**: +52 visibility points (from 67.5 → 119.5, capped at 100)

---

## 🏗️ Step 6: Knowledge Graph & Evidence

**API Call:**
```bash
GET /v1/geo/knowledge-graph?workspaceId=stripe-workspace-123
```

**Response:**
```json
{
  "entities": [
    {
      "id": "stripe-main",
      "type": "workspace",
      "name": "Stripe",
      "properties": {
        "founded": 2010,
        "headquarters": "San Francisco",
        "ceo": "Patrick Collison",
        "products": ["Payments", "Billing", "Connect", "Radar"]
      }
    }
  ],
  "evidenceNodes": [
    {
      "id": "evidence-1",
      "type": "licensed_publisher",
      "source": "wsj.com",
      "authority": 95,
      "evidenceText": "Stripe processes over $1 trillion annually...",
      "freshness": "2025-01-15T10:00:00Z",
      "verified": true
    },
    {
      "id": "evidence-2",
      "type": "reddit",
      "source": "reddit.com/r/entrepreneur",
      "authority": 68,
      "evidenceText": "We use Stripe for payments, best API we've found...",
      "freshness": "2025-01-20T14:30:00Z",
      "verified": false
    }
  ],
  "consensusScore": 87.5,  // How many independent sources agree on facts
  "trustScore": 82.3
}
```

**Insights:**
- **Evidence graph**: 234 evidence nodes across 7 source types
- **Consensus**: 87.5% - high agreement across sources (strong signal)
- **Verified citations**: 156 from licensed publishers, directories
- **Reddit presence**: 28 mentions (below competitor avg)

---

## 📍 Step 7: Citation Opportunities

**API Call:**
```bash
GET /v1/citations/opportunities?workspaceId=stripe-workspace-123&minScore=70
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "opportunities": [
      {
        "id": "opp-1",
        "domain": "techcrunch.com",
        "domainAuthority": 92,
        "citationCount": 15,      // Competitors cited 15x here
        "impactScore": 85,
        "status": "identified",
        "recommendedAction": "Submit press release about Stripe Terminal launch"
      },
      {
        "id": "opp-2",
        "domain": "g2.com",
        "domainAuthority": 88,
        "citationCount": 8,
        "impactScore": 78,
        "status": "identified",
        "recommendedAction": "Create G2 listing with case studies"
      },
      {
        "id": "opp-3",
        "domain": "reddit.com/r/SaaS",
        "domainAuthority": 75,
        "citationCount": 12,
        "impactScore": 72,
        "status": "identified",
        "recommendedAction": "Post AMA or case study thread"
      }
    ],
    "total": 23,
    "highImpactCount": 8
  }
}
```

**Top Opportunities:**
1. **TechCrunch** (85 impact) - Competitors cited 15x, Stripe only 3x
2. **G2** (78 impact) - Missing entirely, competitors have 8 citations
3. **r/SaaS** (72 impact) - Competitors get 12 mentions, Stripe has 2

---

## 🗂️ Step 8: Directory Presence

**API Call:**
```bash
GET /v1/directory/presence?workspaceId=stripe-workspace-123
```

**Response:**
```json
{
  "coverage": 57.1,  // 4 out of 7 directories
  "napConsistency": 92.3,  // Name/Address/Phone consistent
  "listingQuality": 78.5,
  "missing": ["g2", "capterra", "trustpilot"],
  "listings": [
    {
      "type": "gbp",
      "name": "Google Business Profile",
      "claimed": true,
      "nap": {
        "name": "Stripe",
        "address": "510 Townsend St, San Francisco, CA",
        "phone": "+1-415-555-0000"
      },
      "quality": {
        "completeness": 95,
        "reviews": 247,
        "photos": 12,
        "score": 94
      }
    },
    {
      "type": "g2",
      "name": "G2",
      "claimed": false,
      "quality": null
    }
  ],
  "recommendations": [
    "Create G2 listing (missing, 50K+ buyers)",
    "Add to Capterra (missing, 5M+ searches/month)",
    "Improve Trustpilot presence (claimed but low reviews)"
  ]
}
```

**Insights:**
- **Coverage**: 57% (4/7 directories)
- **Missing**: G2, Capterra (high-impact for B2B)
- **Quality**: 78.5 average (good, but can improve)

---

## 🚨 Step 9: Hallucination Detection

**API Call:**
```bash
GET /v1/alerts/hallucinations?workspaceId=stripe-workspace-123&severity=critical,high
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "alerts": [
      {
        "id": "alert-1",
        "engineKey": "PERPLEXITY",
        "promptId": "prompt-123",
        "factType": "founded_year",
        "aiStatement": "Stripe was founded in 2011",
        "correctFact": "Stripe was founded in 2010",
        "severity": "high",
        "status": "open",
        "confidence": 0.92,
        "context": "User asked: 'When was Stripe founded?'"
      },
      {
        "id": "alert-2",
        "engineKey": "OPENAI",
        "promptId": "prompt-456",
        "factType": "ceo",
        "aiStatement": "Stripe's CEO is John Collison",
        "correctFact": "Stripe's CEO is Patrick Collison",
        "severity": "medium",
        "status": "open",
        "confidence": 0.85
      }
    ],
    "total": 12,
    "bySeverity": {
      "critical": 0,
      "high": 3,
      "medium": 7,
      "low": 2
    }
  }
}
```

**Actions:**
- **12 hallucinations detected** across engines
- **3 high-severity** (factual errors about founding year, CEO, headquarters)
- **Copilot automation** can auto-generate correction tasks

---

## 🤖 Step 10: Copilot Automation

**API Call:**
```bash
GET /v1/copilot/actions?workspaceId=stripe-workspace-123&status=pending
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "actions": [
      {
        "id": "action-1",
        "actionType": "CORRECT_HALLUCINATION",
        "targetUrl": "https://perplexity.ai/feedback",
        "priority": 9,
        "confidence": 0.92,
        "reasoning": "High-severity hallucination: incorrect founding year",
        "estimatedImpact": 30,
        "requiredApproval": true,
        "status": "pending"
      },
      {
        "id": "action-2",
        "actionType": "SUBMIT_TO_DIRECTORY",
        "targetDomain": "g2.com",
        "priority": 8,
        "confidence": 0.88,
        "reasoning": "Missing from high-authority directory (78 impact score)",
        "estimatedImpact": 14,
        "status": "pending"
      },
      {
        "id": "action-3",
        "actionType": "SUBMIT_PR_CONTENT",
        "targetDomain": "techcrunch.com",
        "priority": 7,
        "confidence": 0.85,
        "reasoning": "Competitors cited 15x, Stripe only 3x",
        "estimatedImpact": 18,
        "status": "pending"
      }
    ],
    "total": 8,
    "awaitingApproval": 3
  }
}
```

**Workflow:**
1. **Review actions** in dashboard
2. **Approve** high-impact items (hallucination corrections, G2 listing)
3. **Copilot executes** automatically (directory submissions, PR outreach)
4. **Monitor progress** via SSE events

---

## 📡 Step 11: Real-Time Progress Tracking

**SSE Connection:**
```javascript
const eventSource = new EventSource(
  '/v1/events/stream?workspaceId=stripe-workspace-123&lastEventId=event-789'
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'maturity.updated':
      console.log(`Maturity score: ${data.data.overallScore}`);
      break;
    case 'evidence.complete':
      console.log(`Evidence graph built: ${data.data.evidenceCount} nodes`);
      break;
    case 'geo.recommendations.updated':
      console.log(`New recommendations: ${data.data.recommendationCount}`);
      break;
    case 'copilot.action.executed':
      console.log(`Action completed: ${data.data.actionType}`);
      break;
  }
};
```

**Live Updates:**
- Maturity score recomputation progress
- Evidence graph building status
- Citation opportunity scanning
- Copilot action execution status

---

## 📊 Step 12: Competitive Analysis

**API Call:**
```bash
GET /v1/geo/scoring/Stripe?competitors=PayPal,Square,Adyen
```

**Response shows:**
- **Stripe**: 67.5 visibility
- **PayPal**: 89.2 visibility (leader)
- **Square**: 74.1 visibility
- **Adyen**: 71.8 visibility

**Gap Analysis:**
- Stripe is **21.7 points behind PayPal**
- Main gap: **Citation depth** (PayPal has 3x more licensed publisher citations)
- Opportunity: **Reddit presence** (Square gets 2x more Reddit mentions)

---

## 🎯 Demo Summary: What Stripe Sees

### Current State (Day 1)
- **Visibility Score**: 67.5/100 (Advanced maturity)
- **Best Engine**: Perplexity (72.1)
- **Worst Engine**: Claude (59.8)
- **Total Mentions**: 892 across 1,234 prompt runs
- **Citation Coverage**: 1,456 citations from 234 domains

### Key Insights
1. **Strong foundation**: 78.5 entity strength, 82.3 structural clarity
2. **Gap areas**: Citation depth (71.2), update cadence (65.0)
3. **Top opportunity**: 2 more licensed publisher citations → +15 points
4. **Hallucinations**: 12 detected, 3 high-severity requiring correction

### Action Plan (Generated by Platform)
1. ✅ **Critical**: Submit PR to TechCrunch (18 point impact)
2. ✅ **High**: Create G2 listing (14 point impact)
3. ✅ **Medium**: Update stale product page (8 point impact)
4. ✅ **Medium**: Post Reddit case study (12 point impact)
5. ✅ **High**: Correct 3 high-severity hallucinations (30 point impact)

### Projected Outcome (30 days)
- **Visibility Score**: 67.5 → **92.5** (+25 points)
- **Maturity Level**: Advanced → **Expert** (80+)
- **Engine Coverage**: All engines above 70 visibility
- **Hallucination Rate**: Reduced from 12 to <3

---

## 🎬 Demo Flow Script

### For Sales/Marketing Demo (15 minutes)

1. **Open Dashboard** (2 min)
   - Show current visibility: 67.5
   - Highlight trend: +2.3 points this month
   - Show engine breakdown

2. **Drill into Maturity Score** (3 min)
   - Show 4 dimensions
   - Explain "Advanced" maturity level
   - Highlight top recommendation: "Need 2 licensed publisher citations"

3. **Show Recommendations** (4 min)
   - Display prescriptive actions
   - Show estimated impact per action
   - Explain Copilot automation

4. **Live Demo: Recompute Maturity** (3 min)
   - Trigger recomputation
   - Show SSE real-time progress
   - Show updated score

5. **Competitive Analysis** (3 min)
   - Compare vs. PayPal, Square
   - Show gap analysis
   - Explain how to close gaps

---

## 🎯 Key Value Propositions Demonstrated

1. **Complete Visibility**: See exactly where your brand appears in AI responses
2. **Engine-Aware Optimization**: Tailored strategies per AI engine (Reddit for Perplexity, licensed publishers for ChatGPT)
3. **Prescriptive Actions**: Not just data, but actionable recommendations with impact estimates
4. **Automation**: Copilot handles directory submissions, PR outreach, corrections
5. **Real-Time Tracking**: SSE updates for all long-running operations
6. **Multi-Tenant**: Each brand/client has isolated workspace
7. **Enterprise-Ready**: Scales to 1,000+ workspaces

---

## 📝 Notes for Demo

- **Workspace isolation**: All data scoped to `stripe-workspace-123`
- **Idempotency**: Safe to retry operations (no duplicates)
- **SSE events**: Real-time updates without polling
- **Queue-based**: Long operations (evidence graph, maturity recompute) happen async
- **Audit trail**: All actions logged for compliance

---

This demo shows the platform as a **complete GEO operating system** - not just monitoring, but an intelligent, automated system that tells you exactly what to do to improve AI visibility and executes those actions for you.


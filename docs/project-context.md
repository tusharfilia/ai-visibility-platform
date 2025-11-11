## 🧭 GEO Copilot Agent — Context for Backend Development

### Overview

You are building **GEO Copilot**, the backend intelligence layer powering “Generative Engine Optimization (GEO)” — the evolution of SEO for the AI era.

This system analyzes how businesses are represented in **generative engines** (ChatGPT, Perplexity, Gemini, Copilot, etc.), computes their **GEO Visibility Score**, and automates actions that improve visibility, trust, and credibility across the web.

Your backend is the **engine** that powers:

* Instant AI visibility summaries
* Citation and evidence graphs
* GEO maturity and scoring
* Recommendations and automation via Copilot agents

---

### 💡 Why This Exists

Search is shifting from web links to AI-generated summaries.
Visibility now depends on **what AI says** — not how websites rank.

Businesses need to:

* Understand how AI currently describes them
* Fix inconsistent or missing data
* Automate reviews, listings, and structured data management

GEO Copilot automates that loop.

---

### ⚙️ How It Works (Backend View)

#### 1. Instant AI Summary (Pre-Signup Funnel)

* Endpoint: `GET /v1/instant-summary?domain=<domain>`
* Returns:

  * AI Summary text
  * Detected buyer prompts
  * Engine visibility results
  * GEO score (0–100)
  * Key insights
* Purpose: Free onboarding funnel showing value immediately.

#### 2. Post-Signup Connection Flow

* User connects integrations:

  * Google Business, Yelp, Facebook, Apple, CMS, CRM
* Endpoints: `/v1/connections/*`
* Each connection unlocks more automation in Copilot.

#### 3. GEO Copilot Engine

Once connected:

* Builds an **Evidence Graph** from citations, listings, and AI mentions.
* Computes:

  * GEO Visibility Score
  * GEO Maturity (weighted by structure, trust, recency, breadth)
* Automates actions via workers and rules:

  * Review requests
  * Schema generation
  * Listing sync
  * Fixes and data pushes

#### 4. Recommendation + Alerting Layer

* Endpoints: `/v1/recommendations`, `/v1/alerts`
* Generate actionable insights:

  * Missing citations
  * Reputation drops
  * Competitor overtakes
  * Hallucinated AI responses

#### 5. Reporting + Intelligence

* Periodic tasks generate executive reports (`/v1/reports`)
* Include KPIs:

  * Prompt Share of Voice
  * Engine Coverage
  * Citation Velocity
  * AI Link Exposure
* Workers: `MaturityRecomputeWorker`, `RecommendationRefreshWorker`, `EvidenceGraphWorker`

---

### 🧩 Development Priorities (V2 Scope)

#### A. Core APIs

* `/v1/instant-summary`
* `/v1/metrics/overview`
* `/v1/citations/*`
* `/v1/copilot/rules`
* `/v1/recommendations`
* `/v1/admin/system`
* `/v1/alerts`
* `/v1/reports`

#### B. Core Models

* `EntityEvidence`
* `GEOMaturityScore`
* `Citation`
* `EvidenceGraph`
* `VisibilityScore`
* `CopilotRule`
* `Recommendation`
* `Alert`

#### C. Core Services

* `CitationClassifierService` (engine-aware, 95%+ accuracy)
* `EvidenceGraphBuilderService`
* `StructuralScoringService`
* `CitationAuthorityService`
* `RecommendationEngine`
* `MaturityCalculator`
* `CopilotAutomationService`

#### D. System Components

* Workers: `EvidenceGraphWorker`, `MaturityRecomputeWorker`, `RecommendationRefreshWorker`
* Observability: Prometheus metrics
* Caching: Redis
* Database: PostgreSQL (with pgvector for semantic retrieval)

---

### 🧠 Strategic Positioning for Cursor

When extending or refactoring code:

* Treat **GEO Copilot** as an *autonomous AI system*, not just analytics.
* Prioritize **accuracy**, **interpretability**, and **automation-readiness**.
* Make every metric and recommendation **actionable** (feeds Copilot).
* Keep compliance with the **GEO audit ground truth** document as baseline.
* Ensure modularity for multi-tenant SaaS (workspace-scoped).

---

### 📈 Long-Term Roadmap Hooks

(Define architecture to support these in later phases)

* **Competitor Benchmarking** (visibility deltas per industry)
* **Predictive Ranking Simulation** (forecasting score improvements)
* **Multi-tenant Intelligence Dashboards**
* **GEO Marketplace** (industry-specific agent presets)

---

### 🔗 Integration Reference

* **Frontend:** `https://github.com/geku-ai/geku`
* **Frontend spec:** `/docs/geo-frontend-matrix.md`
* **Auth:** Clerk (JWT → `Authorization: Bearer <token>`)
* **API base:** `https://ai-visibility-platform-production.up.railway.app`
* **Framework:** FastAPI + Celery + SQLAlchemy + Redis + PostgreSQL
* **Infra:** Railway (Prod), Neon (DB), Prometheus (Monitoring)

---

### 🪄 Developer Goal for Cursor

Your job is to ensure:

* Every endpoint defined in the **matrix doc** works as expected.
* Services and workers are integrated, reliable, and test-covered.
* Compliance with GEO audit spec ≥95%.
* New endpoints and migrations are documented in `/docs/GEO_FEATURES_STATUS.md`.
* The system can scale horizontally for multiple tenants (multi-company architecture).

---

### 📘 TL;DR Summary

**GEO Copilot = SEO → Automated for AI search.**
Cursor owns the intelligence layer:
**Crawl → Classify → Score → Recommend → Automate.**

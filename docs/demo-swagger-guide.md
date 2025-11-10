# Demo Swagger Walkthrough

This document is the single source of truth for running the self-serve visibility demo entirely from Swagger. It is written for:

- **Product / Success teammates** who need a repeatable, self-serve flow.
- **Lovable (or any AI/frontend implementer)** so it understands the contract for each API step and how to orchestrate them.

---

## 1. Architecture Overview

| Component | Responsibility | Notes |
| --------- | -------------- | ----- |
| `POST /v1/demo/summary` | Normalize the domain, create/update the demo workspace/profile, and persist a `DemoRun`. Returns `demoRunId`. | Runs synchronously via API. |
| `POST /v1/demo/prompts` | Accept seed prompts, expand via LLM, stage prompts in DB. | API orchestrates multiple package methods. |
| `POST /v1/demo/competitors` | Accept or auto-generate competitor domains, persist to `demo_runs`. | Optional domains; auto-generation uses LLM. |
| `POST /v1/demo/run` | Validate engine config, enqueue prompt jobs to BullMQ queue `runPrompt`. | Jobs executed by `ai-visibility-jobs` worker. |
| `GET /v1/demo/status/{demoRunId}` | Aggregate job progress (queued/completed/failed) + rollup status. | Poll until `analysis_complete`. |
| `GET /v1/demo/insights/{demoRunId}` | Read analysis artifacts (SOoV, citations, engine perf) and return narrative insights. | Requires completed runs. |
| `GET /v1/demo/recommendations/{demoRunId}` | Translate findings to prioritized recommendations. | Depends on insights data. |

Internally the data flows across:

- `demo_runs` table – lifecycle state machine.
- `prompts`, `prompt_runs`, `answers`, `mentions`, `citations`, `engines` – populated by worker jobs.
- Redis (BullMQ) – queue + progress updates.

> **Lovable Integration Tip:** Hit the endpoints in exactly this order. Treat `demoRunId` as the session token you pass through the flow. Each call is idempotent.

---

## 2. Environment Checklist

Before sending this guide to someone (or before Lovable starts using it) confirm:

1. **Deployments**
   - `ai-visibility-platform` (API) is deployed and healthy (`/healthz` / `/readyz` pass).
   - `ai-visibility-jobs` worker is deployed, has networking to Redis, and is listening for `runPrompt` queue.
2. **Database Schema**
   - Run Prisma migrations in production:  
     ```bash
     # One-time or add to CI/CD
     DATABASE_URL="<Production connection string>" pnpm --filter "@ai-visibility/db" exec prisma migrate deploy
     ```
     Verify `demo_runs` table exists.
3. **Environment Variables**
   - Common: `DATABASE_URL`, `NODE_ENV=production`, `REDIS_URL`.
   - LLM/search providers (set to real keys or disable engines):
     - `PERPLEXITY_API_KEY`
     - `BRAVE_API_KEY`
     - `OPENAI_API_KEY`
     - `ANTHROPIC_API_KEY` (if using)
     - `GOOGLE_AI_API_KEY` (if using)
   - Feature toggles: `PERPLEXITY_ENABLED`, `BRAVE_ENABLED`, `AIO_ENABLED`, etc.
4. **Redis**
   - `REDIS_URL` configured on both API and worker.
   - From worker logs you should see `Connected to Redis...` message.
5. **Swagger Access**
   - Public Swagger at `https://<api-host>/v1/docs`.
   - If authentication is enabled, distribute an API key or JWT flow. (In demo mode we run with auth disabled.)

> **Lovable Integration Tip:** Lovable should assume all env vars are already set in the API it is calling. It does not need direct DB/Redis access.

---

## 3. Step-by-Step Execution (Swagger or Programmatic)

For each step below we show the request **and** the canonical response structure Lovable should expect. Replace placeholder values with real IDs returned by the API.

### Step 1 – Generate the Summary

**Endpoint**: `POST /v1/demo/summary`  
**Body Example**
```json
{
  "domain": "https://stripe.com",
  "brand": "Stripe",
  "summaryOverride": "Stripe provides financial infrastructure for online businesses."
}
```
Only `domain` is required. `brand` and `summaryOverride` let operators override the AI summary.

**Success Response**
```json
{
  "ok": true,
  "data": {
    "demoRunId": "6c3f1a90-1234-4d5e-9abc-ef0123456789",
    "workspaceId": "demo_stripe_com",
    "domain": "https://stripe.com",
    "brand": "Stripe",
    "summary": "Stripe provides financial infrastructure...",
    "summarySource": "llm"
  }
}
```

> **Persist `demoRunId`** – Lovable must store this and send it on every subsequent call.

### Step 2 – Build Prompts

**Endpoint**: `POST /v1/demo/prompts`  
**Body Example**
```json
{
  "demoRunId": "6c3f1a90-1234-4d5e-9abc-ef0123456789",
  "seedPrompts": [
    "Why choose Stripe for online payments?",
    "Stripe vs PayPal fees"
  ]
}
```

**Success Response**
```json
{
  "ok": true,
  "data": {
    "demoRunId": "6c3f1a90-1234-4d5e-9abc-ef0123456789",
    "workspaceId": "demo_stripe_com",
    "prompts": [
      { "text": "Compare Stripe and PayPal for SMBs", "source": "seed" },
      { "text": "How does Stripe pricing compare to Adyen?", "source": "llm" }
    ],
    "total": 5
  }
}
```

The prompts are staged but not yet committed. Lovable can show/edit them before final confirmation.

### Step 3 – Confirm Competitors

**Endpoint**: `POST /v1/demo/competitors`  
**Body Example**
```json
{
  "demoRunId": "6c3f1a90-1234-4d5e-9abc-ef0123456789",
  "competitorDomains": ["paypal.com", "adyen.com"]
}
```
If `competitorDomains` is omitted, the API will generate a list automatically and include it in the response.

**Success Response**
```json
{
  "ok": true,
  "data": {
    "demoRunId": "6c3f1a90-1234-4d5e-9abc-ef0123456789",
    "workspaceId": "demo_stripe_com",
    "finalCompetitors": ["paypal.com", "adyen.com"],
    "suggestedCompetitors": ["paypal.com", "adyen.com", "authorize.net"]
  }
}
```

### Optional Prompt/Competitor Confirmation Updates

- `PUT /v1/demo/prompts` – send final curated prompt set if the user edits the generated list.
- `PUT /v1/demo/competitors` – send final curated competitor list.

Each endpoint expects the same structures and returns the latest snapshot.

### Step 4 – Run the Analysis

**Endpoint**: `POST /v1/demo/run`  
**Body Example**
```json
{
  "demoRunId": "6c3f1a90-1234-4d5e-9abc-ef0123456789",
  "engines": ["PERPLEXITY", "BRAVE", "AIO"]
}
```
Omit `engines` to default to enabled providers. The service validates that `*_ENABLED` flags and corresponding API keys are present before enqueuing jobs.

**Success Response**
```json
{
  "ok": true,
  "data": {
    "demoRunId": "6c3f1a90-1234-4d5e-9abc-ef0123456789",
    "workspaceId": "demo_stripe_com",
    "engines": ["PERPLEXITY", "BRAVE", "AIO"],
    "queuedJobs": 12
  }
}
```

> The API call returns immediately; background processing happens in the worker queue. Lovable should transition the UI into a “running analysis” state and begin polling status.

### Step 5 – Track Progress

**Endpoint**: `GET /v1/demo/status/{demoRunId}`  
**Typical Response**
```json
{
  "ok": true,
  "data": {
    "demoRunId": "6c3f1a90-1234-4d5e-9abc-ef0123456789",
    "workspaceId": "demo_stripe_com",
    "status": "analysis_running",
    "progress": 87,
    "totalJobs": 12,
    "completedJobs": 9,
    "failedJobs": 1,
    "remainingJobs": 2,
    "updatedAt": "2025-11-07T02:35:10.000Z"
  }
}
```

**Status values**
- `summary_pending`, `prompts_pending`, `competitors_pending`, `analysis_ready` – pre-run stages.
- `analysis_running` – worker is processing jobs.
- `analysis_complete` – all jobs succeeded.
- `analysis_failed` – unrecoverable error (check `failedJobs`, worker logs).

> Lovable should poll every 5–10 seconds until status is `analysis_complete` or `analysis_failed`. If `failed`, prompt the user to adjust configuration or retry.

### Step 6 – Consume Insights

**Endpoint**: `GET /v1/demo/insights/{demoRunId}`  
**Sample Response**
```json
{
  "ok": true,
  "data": {
    "runTotals": { "totalRuns": 12, "completedRuns": 12, "failedRuns": 0, "totalCostCents": 235 },
    "shareOfVoice": [
      { "entityKey": "demo_stripe_com", "entityLabel": "Stripe", "mentions": 145, "positiveMentions": 62, "neutralMentions": 70, "negativeMentions": 13 }
    ],
    "enginePerformance": [
      { "engine": "PERPLEXITY", "runs": 8, "avgResponseSeconds": 4.2, "errorRate": 0.0 }
    ],
    "topCitations": [
      { "domain": "techcrunch.com", "references": 12 }
    ],
    "highlightSummary": [
      "Stripe dominates branded share-of-voice with 71% coverage.",
      "Competitors most active in payments pricing discussions."
    ]
  }
}
```

### Step 7 – Consume Recommendations

**Endpoint**: `GET /v1/demo/recommendations/{demoRunId}`  
**Sample Response**
```json
{
  "ok": true,
  "data": {
    "priorityRecommendations": [
      {
        "category": "visibility",
        "priority": "high",
        "title": "Capture comparison queries",
        "details": "Stripe loses share on 'Stripe vs PayPal' pages...",
        "suggestedActions": [
          "Launch comparison landing page",
          "Publish FAQ content targeting 'Stripe vs PayPal fees'"
        ]
      }
    ]
  }
}
```

Lovable can render these directly or convert them into cards/checklists.

---

## 4. API Reference Summary (for Lovable)

| Endpoint | Method | Required Body Fields | Returns | Notes |
| -------- | ------ | -------------------- | ------- | ----- |
| `/v1/demo/summary` | POST | `domain` | `demoRunId`, workspace snapshot | Must be first call. |
| `/v1/demo/prompts` | POST | `demoRunId`, `seedPrompts[]` | Generated prompt list | Run immediately after summary. |
| `/v1/demo/prompts` | PUT | `demoRunId`, `prompts[]` | Final prompt list | Optional edit step. |
| `/v1/demo/competitors` | POST | `demoRunId`, optional `competitorDomains[]` | Final + suggested competitors | Accepts empty array to auto-generate. |
| `/v1/demo/competitors` | PUT | `demoRunId`, `competitorDomains[]` | Final competitor list | Optional edit step. |
| `/v1/demo/run` | POST | `demoRunId`, optional `engines[]` | Enqueued job count | Requires provider keys. |
| `/v1/demo/status/{demoRunId}` | GET | Path param | Progress rollup | Poll until complete. |
| `/v1/demo/insights/{demoRunId}` | GET | Path param | Aggregated insights | Available after success. |
| `/v1/demo/recommendations/{demoRunId}` | GET | Path param | Prioritized recommendations | Available after success. |

---

## 5. Troubleshooting & Operational Playbook

| Symptom | Likely Cause | Resolution |
| ------- | ------------ | ---------- |
| `400 demoRunId must be a UUID` | Using the sample `"string"` value | Copy the actual `demoRunId` from summary response. |
| `HTTP_ERROR: Missing engine credentials` | Provider key not set or engine disabled | Set `*_API_KEY` and `*_ENABLED=true`, or omit the engine from the request. |
| `analysis_running` never completes | Worker offline or job failures | Check `ai-visibility-jobs` runtime logs on Railway. Look for retries/failure stack traces. |
| `analysis_failed` status | Downstream provider error, DB issue, or migration missing | Inspect worker logs. Ensure migrations are applied and providers respond (200). |
| `relation "demo_runs" does not exist` | Migration not yet run | Apply Prisma migrations as described in Section 2. |
| Redis connection errors | `REDIS_URL` misconfigured or service unreachable | Update env var to Railway Redis URL and redeploy worker/API. |
| Slow or partial insights | Some jobs failed | Query `/status` to see counts; optionally rerun analysis after fixing provider configuration. |

During demos, keep the worker logs open in Railway → `ai-visibility-jobs` → Logs. Search by `demoRunId`.

---

## 6. Clean Up (Optional)

Use this only if you need to purge demo data manually. Replace `:demoRunId` with the actual UUID.

```sql
DELETE FROM prompt_runs WHERE demo_run_id = ':demoRunId';
DELETE FROM prompts WHERE tags @> '["demo"]'::jsonb AND demo_run_id = ':demoRunId';
DELETE FROM answers WHERE demo_run_id = ':demoRunId';
DELETE FROM mentions WHERE demo_run_id = ':demoRunId';
DELETE FROM citations WHERE demo_run_id = ':demoRunId';
DELETE FROM demo_runs WHERE id = ':demoRunId';
```

> Planned enhancement: expose an authenticated `DELETE /v1/demo/{demoRunId}` endpoint.

---

## 7. Frontend Integration Guidance (Lovable)

1. **Session Management** – Store `demoRunId`, prompt list, competitor list in local state. Treat the flow as a wizard.
2. **API Sequencing** – Call endpoints in Sections 3 & 4 sequentially. Handle asynchronous status via polling. Stop polling once `analysis_complete` or `analysis_failed`.
3. **Error UX** – Map common errors (400 invalid UUID, 422 engine config) to friendly messages. Provide link to check provider settings or retry run.
4. **Progress UI** – Use `/status` to update a progress bar. Show `completedJobs/totalJobs` and highlight failed jobs if any.
5. **Results Display** – `/insights` provides metrics for dashboards. `/recommendations` can feed an accordion or card layout.
6. **Re-run Support** – Allow users to jump back to prompts or competitors to edit, then call `/v1/demo/run` again. The API overwrites previous analysis data for that `demoRunId`.

---

## 8. Quick Start Checklist

1. ✅ Verify migrations (`prisma migrate deploy`).
2. ✅ Confirm API + worker are healthy on Railway.
3. ✅ Ensure provider API keys are in environment.
4. ✅ Open Swagger at `/v1/docs`.
5. ✅ Execute Steps 1–7 above in order.
6. ✅ Share the resulting insights/recommendations JSON with stakeholders (or feed to Lovable UI).

With this guide, anyone—including Lovable—can recreate the demo flow end-to-end via Swagger and integrate the APIs into a frontend experience confidently.
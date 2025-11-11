1. FRONT-END BUILD MATRIX (V1 SCOPE)
0. Global App Shell
Screens / Components:
Sidebar nav (Overview, Prompts, Engines, Citations, Copilot, Connections, Alerts, Reports, Settings)


Topbar:


workspace/domain selector (stub is fine for now)


date range picker (7d / 30d / 90d)


theme toggle (light/dark)


user menu


command palette (Cmd/Ctrl+K)


Data / API needs:
feature flags: read from env or /v1/admin/system (providers, mock/live, budget info)


user session: from auth (see Integration Notes below)


User actions: navigate, switch date range, open command palette.

1. Landing Page /
Purpose: marketing and conversion.
Sections needed:
Hero: “Be the brand AI recommends”


Problem (“Search moved to AI”)


Product pillars (Track / Fix / Grow / Automate)


GEO Copilot teaser


Instant AI Summary CTA form (domain input)


Pricing preview (Free / Insights / Copilot / Agency)


Social proof strip / testimonial placeholders


Footer


API calls:
none (pure marketing copy) EXCEPT:


domain form submit navigates to /instant-summary?domain=<value>


User actions:
submit domain


click “Activate GEO Copilot” → signup


open pricing / learn more


Status: sounds like you already have a light version. It needs polish (animations, gradients, scroll reveals) and sections for pricing + use case.

2. Instant Summary Funnel /instant-summary
Purpose: pre-signup conversion hook.
UI requirements:
Domain input box at top


Result cards:


“AI Summary of Your Business”


“Buyer Prompts People Ask”


“Where You Show Up in AI Engines” (Perplexity / Google AI Overviews / Brave etc. with visible/missing badges)


“Your GEO Visibility Score: 0–100”


Insight bullets (“You’re missing in 3/4 engines”, “Low trust from directories”, etc.)


CTA banner at bottom:


“See exactly how to fix this — activate GEO Copilot”


button → /auth/sign-up


API call:
 GET /v1/instant-summary?domain=<domain>
expected response:
{
  "summary": "LavaCleaners is a home cleaning service in Austin focused on eco-safe products...",
  "detectedPrompts": ["best cleaners in Austin", "eco-friendly home cleaning service", "move-out deep clean service"],
  "engines": [
    { "key": "perplexity", "visible": true },
    { "key": "aio", "visible": false },
    { "key": "brave", "visible": false }
  ],
  "geoScore": 42,
  "insights": [
    "You are missing in 2 of 3 major AI engines.",
    "Your business category is unclear in AI answers.",
    "Low trust: no consistent citations across directories."
  ]
}

User actions:
submit domain


get report


upgrade → signup


Must have states:
loading skeleton


error message


“no data / we couldn’t find you” fallback



3. Auth /auth/sign-up, /auth/sign-in, /auth/forgot
Purpose: gate the dashboard.
UI requirements:
Email+password auth (Lovable Cloud Auth or equivalent provider)


Social login placeholder (Google coming soon)


Terms/privacy footer


Post-auth redirect to /app/overview


API needs:
calls to auth provider, not our backend (yet)


after login, frontend gets a JWT and will send Authorization: Bearer <token> to backend for all protected routes


User actions:
register


login


reset password



4. Overview Dashboard /app/overview
Purpose: this is the “home screen” after login.
UI requirements:
KPI Cards row:


Prompt Share of Voice (SOV %)


Engine Coverage (% engines where you’re mentioned)


Citation Velocity (# new citations / last 7d)


AI Link Exposure (# times your URL appears in AI answers)


Each card: current value, WoW change (%), tiny sparkline


Chart(s):


SOV over time (area chart)


Engine coverage comparison (bar chart)


Tables:


“Top Cited Domains” (domain, appearances, engines citing, lastSeen, competitorOnly flag)


“Recent AI Answers” (engine, prompt, snippet, badges: “you mentioned”, “competitor mentioned only”)


API calls:
GET /v1/metrics/overview?from=<ISO>&to=<ISO>
 returns:

 {
  "promptSOV": 0.37,
  "coverage": 0.66,
  "citationVelocity": 12,
  "aioImpressions": 54,
  "timeseries": [
    { "date": "2025-10-18", "sov": 0.33 },
    { "date": "2025-10-19", "sov": 0.37 }
  ]
}


GET /v1/citations/top-domains?limit=50
 returns array:

 [
  {
    "domain": "cleaneraustin.com",
    "appearances": 14,
    "engines": ["perplexity","aio"],
    "lastSeen": "2025-10-24T13:20:00Z",
    "competitorOnly": true
  }
]


User actions:
change date range (updates API query params)


click domain row to open detail drawer (optional now, needed in Citations page below)


navigate deeper into problem areas: “Fix visibility gaps” (link to Copilot)


States required:
loading skeletons for cards, charts, tables


empty states (“we haven’t scanned yet”)



5. Prompts Manager /app/prompts
Purpose: define + manage the prompt set we track against AI engines.
UI requirements:
Table of prompts:


Prompt text


Intent (badge: best / alternatives / pricing / vs / how-to)


Industry/vertical


Active (toggle)


Last Run timestamp


Actions (Edit / Delete)


“Add Prompt” drawer:
 fields:


text


canonicalText


intent (select)


vertical


tags []


notes


“Bulk Import” modal:


Allow pasting one prompt per line OR uploading CSV


“Suggested Prompts” modal:


Show clusters by intent with “Add” checkboxes


API calls:
GET /v1/prompts
 returns an array of prompt objects with those fields


POST /v1/prompts
 for create/update


GET /v1/prompts/suggest
 returns:

 [
  { "intent": "best", "prompts": ["best cleaners in austin", "top rated house cleaning austin"] },
  { "intent": "pricing", "prompts": ["how much is move out cleaning in austin"] }
]


User actions:
create new prompt


toggle active/inactive


import in bulk


accept suggested prompts


States required:
form validation


success toast / error toast


loading state for table and modals



6. Engines Config /app/engines
Purpose: control which AI engines we query + budgets.
UI requirements:
 For each engine (Perplexity, Google AI Overviews via SerpAPI, Brave, etc.):
Enabled toggle


Input fields:


API key


daily / weekly budget cap (cents)


concurrency / parallelism slider


locale/region


“Test Connection” button w/ live toast (“OK”, “Invalid key”, etc.)


Show last run timestamp + avg latency


API calls:
GET /v1/engines
 returns:

 [
  {
    "key": "perplexity",
    "enabled": true,
    "dailyBudgetCents": 1200,
    "concurrency": 2,
    "region": "us-en",
    "lastRunAt": "2025-10-24T05:44:00Z",
    "avgLatencyMs": 842
  }
]


POST /v1/engines/test
 body: { "key": "perplexity" }
 returns { "ok": true, "message": "Connected" }


User actions:
toggle engine active


edit budget caps etc.


test connection


States required:
dirty state indicators (“unsaved changes”)


optimistic save or explicit “Save Changes” button


error toast



7. Citations / Source Graph /app/citations
Purpose: where does AI say “go here” — and is it us or competitors?
UI requirements:
Leaderboard table:


Domain


Appearances (# times cited)


Engines citing that domain


Competitor-only? (true if AI recommends them but not us)


Last Seen


When clicking a domain row:


Slide-in drawer:


last 5–10 snippets:


engine


prompt


excerpt where that URL was referenced


sentiment toward brand (pos/neu/neg)


Export “Target List (CSV)” → top 50 competitor domains we’re losing to


API calls:
GET /v1/citations/top-domains?limit=50 (above)


drawer details likely from something like:


GET /v1/citations/:domain/snippets
 (if that doesn’t exist yet in backend, stub it in UI and mark as TODO)


User actions:
download CSV


mark targets for outreach (future: that ties to Copilot suggestions)


States required:
loading for leaderboard


loading for drawer


empty state (“No citations yet in this date range”)



8. Copilot Automation /app/copilot
Purpose: “do the work for me.”
UI requirements:
 Section A: Global Settings
Full Auto toggle (on/off)


Require Approval Before Publish toggle (on/off)


Slider: Max Pages Optimized Per Week


Slider or select: Optimization Intensity (1–3)


Checklist of enabled actions:


ADD_FAQ


ADD_TLDR


ADD_CITATIONS


FIX_SCHEMA


REVIEW_CAMPAIGN (ask for reviews / fix reputation)


API calls (settings):
GET /v1/copilot/rules
 returns:

 {
  "fullAuto": false,
  "requireApproval": true,
  "maxPagesPerWeek": 5,
  "intensity": 2,
  "enabledActions": ["ADD_FAQ","ADD_TLDR","FIX_SCHEMA"]
}


POST /v1/copilot/rules
 send same shape to update


Section B: Approvals Queue
List of pending actions (cards / table rows):


actionType (badge)


targetUrl


diff viewer (before / after)


status (PENDING / APPROVED / REJECTED / EXECUTED)


Approve / Reject buttons


API calls (actions):
GET /v1/copilot/actions
 returns:

 [
  {
    "id": "act_123",
    "actionType": "ADD_FAQ",
    "targetUrl": "https://lavacleaners.com/pricing",
    "diff": "+++ added FAQ block...",
    "status": "PENDING"
  }
]


POST /v1/copilot/actions/:id/approve
 body empty, returns { "ok": true }


POST /v1/copilot/actions/:id/reject
 same


User actions:
approve / reject specific automation


change mode from “Full Auto” to “Approval Required” (and back)


States required:
diff viewer component (side-by-side or inline highlight)


optimistic UI on approve/reject


empty queue state



9. Connections /app/connections
Purpose: connect data sources so Copilot can act.
UI requirements:
 Grid/list of “cards,” one for each integration:
Google Business


Yelp


Facebook Pages


Apple Maps


Webflow


WordPress


Notion


HubSpot


Pipedrive


Each card shows:
status: connected / disconnected / error


last sync time


connect/disconnect button


mini “Fix It” actions (e.g. “sync business hours”, “sync reviews”)


Also: Progress banner
 “3 of 6 sources connected — unlock 90% Copilot automation”
API calls:
GET /v1/connections
 returns:

 [
  {
    "type": "GBP",
    "status": "connected",
    "lastSyncAt": "2025-10-24T10:11:00Z"
  },
  {
    "type": "YELP",
    "status": "disconnected"
  }
]


POST /v1/connections/:type/connect


This triggers OAuth / token flow or simulates it for now


User actions:
hit Connect


retry Fix It


States required:
success toast


error toast


“Connection in progress” spinner state



10. Alerts / Brand Safety /app/alerts
Purpose: brand monitoring and “oh sh*t dashboard.”
UI requirements:
 Feed / timeline of alerts. Each alert row shows:
Severity


Type (SOV_DROP, ENGINE_LOSS, COMPETITOR_OVERTAKE, HALLUCINATION)


Human-readable description


Evidence snippet (what AI said)


Timestamp


Quick Action button:


“Open in Copilot”


or “Acknowledge & dismiss”


API call:
GET /v1/alerts
 returns:

 [
  {
    "id": "alert_1",
    "type": "HALLUCINATION",
    "severity": "high",
    "description": "Perplexity told users you operate in Dallas. You don't.",
    "snippet": "LavaCleaners provides deep cleaning services in Dallas...",
    "createdAt": "2025-10-25T03:11:00Z"
  }
]


User actions:
click “Fix via Copilot” → goes to Copilot tab, pre-filters suggested action


acknowledge alert (future: PATCH /alerts/:id/ack)


States required:
empty state (“No active alerts 🎉”)


filter by severity/type (optional v1.5)



11. Reports /app/reports
Purpose: export proof / send to boss / send to clients.
UI requirements:
Table of past reports:


date range


title


sections included


“Download PDF”


Button: “Generate New Report”


modal lets user choose:


date range


which sections to include:


Overview KPIs


SOV Trend


Engine Coverage


Top Domains


Competitor Delta


Action Plan


after submit, API call kicks off generation and returns URL


API call:
GET /v1/reports (if implemented; if not, stub table with fields)


POST /v1/reports
 request: { "from":"2025-10-01", "to":"2025-10-25", "sections":["overview","citations","actionPlan"] }
 response: { "url":"https://example-bucket/report_123.pdf" }


User actions:
generate & download


re-download older one


States required:
generating/loading state


error toast


empty state “No reports yet — generate your first executive summary”



12. Settings /app/settings
Purpose: workspace-level setup.
UI requirements:
 Sections:
Branding


Logo upload


Business name / Location info


Timezone picker


Feature Flags read-only


shows PERPLEXITY_ENABLED, AIO_ENABLED, BRAVE_ENABLED, FULL_AUTO_DEFAULT, BRAND_DEFENSE_ENABLED


pulled from env / /v1/admin/system


Audit Log table


Action


Actor


Timestamp


(e.g. “Copilot Action APPROVED”, “Engine Budget Updated”)


API calls:
GET /v1/admin/system
 (already returns providers/budgets/status flags and timestamp)


audit log might be GET /v1/audit-log later; for now we can fake it


User actions:
upload logo (store locally for now or S3 later)


update timezone (if endpoint exists — if not, UI local only in v1)


States required:
loading skeletons


empty audit log state



2. INTEGRATION / IMPLEMENTATION NOTES FOR YOUR COFOUNDER
this is the stuff that stops rework later.
A. Tech expectations for frontend
React + Vite + TypeScript


Tailwind + shadcn/ui components (cards, tables, dialogs, drawers, toasts)


Framer Motion for scroll / in-view animations and micro-interactions


Zustand or equivalent lightweight global store for:


auth/session


active workspace


date range (used by Overview, Citations, Reports)


feature flags pulled from /v1/admin/system


B. Auth model
After login/signup via Lovable Auth (or whatever no-code auth service), frontend should:


store the JWT


attach Authorization: Bearer <jwt> to ALL /v1/... requests except /v1/instant-summary


Local dev: backend supports DEBUG_JWT_MODE=true so missing/invalid JWT still works. Don’t build UI logic around that; that’s just for us.


C. API access pattern
Create one reusable apiClient.ts in the SPA:


baseURL = import.meta.env.VITE_API_URL


attach bearer token if present


handle non-200 → throw typed error


Every page pulls its data via small hooks like:


useOverviewMetrics(from, to)


usePrompts()


useCopilotRules()


That way when backend swaps from mock → real, UI doesn’t change.


D. Loading / Empty / Error states are mandatory
For each page:
skeleton loaders (cards, charts, tables)


empty states with CTA (like “Connect sources to unlock automation”)


error toast if API rejects


No silent failure. This matters for demo quality.
E. Global components to standardize
Your cofounder should build reusable primitives instead of hardcoding per page:
<KpiCard value delta sparklineLabel sparklineData />


<DataTable columns data onRowClick />


<DiffViewer before after /> for Copilot


<EngineCard /> for Perplexity / AIO / Brave


<ConnectionCard /> for Google Business, Yelp, etc.


<AlertRow /> to render alerts consistently


<ReportRow /> for report downloads


<FeatureFlagPill enabled label />


This keeps visual system consistent and lets you scale.
F. Feature flags / mode handling
Frontend should surface:
Whether we’re in mock mode (MOCK_PROVIDERS=true)


can show “Demo Data” badge somewhere small


Whether FULL_AUTO_DEFAULT is false in this workspace


drives default state of toggles in Copilot


This is mostly visual / messaging, but it matters for trust.
G. Routing
React Router routes should match:
/


/instant-summary


/auth/sign-in, /auth/sign-up


/app/overview


/app/prompts


/app/engines


/app/citations


/app/copilot


/app/connections


/app/alerts


/app/reports


/app/settings


Anything under /app/* should be behind auth in production.
H. The “demo loop”
The happy path demo we’re selling prospects:
User hits /


User runs Instant Summary on their domain → sees pain + score


“Activate GEO Copilot” CTA → signup


After signup → /app/overview with real KPIs


They click Copilot and see:


changes ready for approval


automation settings


“This is already working for you”


Your UI must make that feel smooth and inevitable.
I. Visual style
Non-negotiables (because this is positioning):
Soft gradients (indigo / cyan / teal), glass panels w/ backdrop blur


Light/dark mode toggle in topbar


Subtle motion on scroll section reveals, not chaotic animations


Cards with rounded-2xl, shadow, hairline borders w/ alpha white/alpha black


Command palette with Cmd+K to jump anywhere


This is part of the brand: “modern, expensive, confident”.


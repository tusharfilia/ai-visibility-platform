# 🎨 AI Visibility Platform - Frontend Build Matrix for Lovable

**Purpose**: Comprehensive specification document for generating the frontend with Lovable  
**Scope**: All current features + planned features (5-10 weeks roadmap)  
**Date**: 2025-01-27

---

## 📋 Table of Contents

1. [Application Overview](#application-overview)
2. [Page Structure & Routing](#page-structure--routing)
3. [API Endpoints Reference](#api-endpoints-reference)
4. [Feature Matrix](#feature-matrix)
5. [Component Library](#component-library)
6. [Data Models & Types](#data-models--types)
7. [Real-Time Features](#real-time-features)
8. [Planned Features (Roadmap)](#planned-features-roadmap)
9. [UI/UX Guidelines](#uiux-guidelines)

---

## Application Overview

### Platform Purpose
AI Visibility Platform - A comprehensive GEO (Generative Engine Optimization) platform that helps businesses optimize their visibility across AI search engines (Perplexity, ChatGPT, Google AIO, Copilot, etc.)

### Key User Personas
1. **Marketing Manager** - Needs visibility scores, recommendations, citation opportunities
2. **SEO Specialist** - Needs detailed technical analysis, structural scoring, schema audits
3. **Business Owner** - Needs high-level dashboard, maturity scores, competitive analysis
4. **Enterprise Admin** - Needs workspace management, team members, API keys, white-label settings

### Authentication & Workspace Model
- **Multi-tenant architecture** - Each user belongs to one or more workspaces
- **JWT authentication** - All API calls require Bearer token
- **Workspace context** - User can switch between workspaces
- **RBAC**: Owner, Admin, Member, Viewer roles

---

## Page Structure & Routing

### Main Navigation Structure

```
/ (Dashboard Home)
├── /dashboard
│   ├── Overview (default)
│   ├── Visibility Scores
│   ├── GEO Maturity
│   └── Quick Actions
├── /geo
│   ├── /evidence - Entity Evidence Graph
│   ├── /maturity - GEO Maturity Score (4 dimensions)
│   ├── /recommendations - Prescriptive Recommendations
│   ├── /scoring/:brandName - Visibility Score Details
│   └── /optimization - Optimization Insights
├── /citations
│   ├── /opportunities - Citation Opportunities
│   ├── /domains - Domain Analysis
│   └── /tracking - Citation Tracking
├── /prompts
│   ├── /discovery - Prompt Discovery
│   ├── /clusters - Prompt Clusters
│   └── /coverage - Prompt Coverage Analysis (planned)
├── /directories
│   ├── /presence - Directory Presence Analysis
│   ├── /sync - Directory Synchronization
│   └── /listings - Directory Listings Management
├── /content
│   ├── /generate - Content Generation (Blog, FAQ, Landing, Social)
│   ├── /templates - Content Templates
│   ├── /:id - Content Editor & Details
│   └── /library - Content Library (All Generated Content)
├── /automation
│   ├── /copilot - Copilot Actions
│   └── /rules - Automation Rules
├── /analytics
│   ├── /metrics - Daily Metrics
│   ├── /trends - Trend Analysis
│   └── /competitors - Competitive Analysis
├── /alerts
│   ├── /hallucinations - Hallucination Detection & Alerts
│   ├── /detect - Detect Hallucinations (Manual)
│   └── /patterns - Hallucination Pattern Analysis
├── /automation
│   ├── /copilot - Copilot Rules & Actions
│   ├── /rules - Automation Rules Management
│   ├── /actions - Pending Actions Queue
│   └── /pre-signup - Pre-Signup Analysis
├── /enterprise
│   ├── /whitelabel - White-Label Configuration
│   ├── /marketplace - API Marketplace
│   ├── /observability - System Observability (Admin)
│   └── /api-usage - API Usage Statistics
├── /reports
│   ├── /generate - Generate Reports
│   └── /scheduled - Scheduled Reports
├── /webhooks
│   ├── /manage - Webhook Configuration
│   └── /deliveries - Webhook Delivery History
├── /connections
│   └── /integrations - Third-Party Integrations (GBP, Yelp, Facebook, etc.)
├── /engines
│   └── /configure - Engine Configuration & Budgets
├── /prompts
│   └── /manage - Prompts Management (Create, Edit, Tag)
├── /invitations
│   └── /manage - Workspace Invitations
├── /progress
│   └── /tracking - Progress Tracking Dashboard
├── /export
│   ├── /data - Workspace Data Export
│   └── /gdpr - GDPR Deletion Requests
├── /settings
│   ├── /workspace - Workspace Settings
│   ├── /members - Team Members
│   ├── /engines - Engine Configuration
│   ├── /api-keys - API Key Management
│   ├── /webhooks - Webhook Configuration
│   └── /white-label - White-Label Settings (Enterprise)
└── /admin (Admin only)
    └── /system - System Health
```

---

## API Endpoints Reference

### Base URL
- **Development**: `http://localhost:3000`
- **Production**: Set via environment variable

### Authentication
- **Header**: `Authorization: Bearer <JWT_TOKEN>`
- **Login**: `POST /v1/auth/login`
- **Workspace Context**: Automatically injected from JWT

### API Endpoint Catalog

#### 🔵 GEO Optimization Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/geo/scoring/:brandName` | GET | Calculate visibility score | `?timeRange=30d&engines=perplexity,aio` | `{ ok: true, data: GEOVisibilityScore }` |
| `/v1/geo/scoring/batch` | POST | Batch scoring | `{ brands: string[], timeRange?: string }` | `{ ok: true, data: { [brand]: GEOVisibilityScore } }` |
| `/v1/geo/knowledge-graph/:brandName` | GET | Build knowledge graph | - | `{ ok: true, data: KnowledgeGraph }` |
| `/v1/geo/knowledge-graph/:brandName/analysis` | GET | Analyze knowledge graph | - | `{ ok: true, data: GraphAnalysis }` |
| `/v1/geo/trust/:domain` | GET | Aggregate trust signals | `?entityType=domain` | `{ ok: true, data: TrustProfile }` |
| `/v1/geo/trust/:domain/analysis` | GET | Trust analysis | `?competitors=domain1,domain2` | `{ ok: true, data: TrustAnalysis }` |
| `/v1/geo/optimization/:brandName/recommendations` | GET | Optimization recommendations | - | `{ ok: true, data: { visibilityScore, recommendations } }` |
| `/v1/geo/competitors/:brandName` | GET | Competitive analysis | - | `{ ok: true, data: CompetitorAnalysis }` |

**Data Types:**
```typescript
interface GEOVisibilityScore {
  overall: number; // 0-100
  breakdown: {
    mentions: number;
    rankings: number;
    citations: number;
    sentiment: number;
    authority: number;
    freshness: number;
  };
  recommendations: string[];
  trends: { weekly: number; monthly: number; quarterly: number };
  competitors: Array<{ brand: string; score: number }>;
}
```

#### 🟢 Evidence & Maturity Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/geo/evidence/graph` | GET | Get entity evidence graph | `?workspaceId=xxx` | `EntityEvidenceGraph` |
| `/v1/geo/maturity` | GET | Get GEO maturity score | `?workspaceId=xxx` | `GEOMaturityScore` |
| `/v1/geo/recompute` | POST | Trigger maturity recompute | `{ workspaceId: string }` | `{ jobId: string, status: string }` |

**Data Types:**
```typescript
interface EntityEvidenceGraph {
  entity: { workspaceId: string; entityType: string; name?: string };
  evidenceNodes: Array<{
    id: string;
    type: 'citation' | 'reddit_mention' | 'directory_listing' | 'licensed_content';
    source: string;
    authority: number;
    freshness: Date;
    verified: boolean;
  }>;
  edges: Array<{
    from: string;
    to: string;
    relationship: 'cites' | 'confirms' | 'contradicts' | 'supports';
    credibility: number;
  }>;
  consensusScore: number; // 0-100
  metadata: {
    totalEvidence: number;
    licensedPublisherCount: number;
    redditMentionCount: number;
    directoryCount: number;
    averageAuthority: number;
  };
}

interface GEOMaturityScore {
  entityStrength: number;      // 0-100
  citationDepth: number;       // 0-100
  structuralClarity: number;   // 0-100
  updateCadence: number;       // 0-100
  overallScore: number;        // Weighted composite
  maturityLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  recommendations: Recommendation[];
}
```

#### 🟡 Recommendations Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/recommendations` | GET | Get prescriptive recommendations | `?workspaceId=xxx` | `Recommendation[]` |
| `/v1/recommendations/refresh` | POST | Refresh recommendations | `{ workspaceId?: string }` | `{ jobId: string, status: string }` |

**Data Types:**
```typescript
interface Recommendation {
  type: string; // 'citation_gap' | 'schema_missing' | 'reddit_presence' | 'freshness'
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string; // "You need 2 more trusted citations from licensed publishers"
  action: 'ADD_CITATIONS' | 'FIX_SCHEMA' | 'ADD_TLDR' | 'ADD_FAQ';
  estimatedImpact: number; // 0-100
  effort: 'low' | 'medium' | 'high';
  targetUrl?: string;
  targetDomain?: string;
}
```

#### 🔴 Citation Opportunities Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/citations/opportunities` | GET | Get citation opportunities | `?status=identified&minScore=70&limit=50` | `{ ok: true, data: { opportunities: [] } }` |
| `/v1/citations/opportunities/:id` | GET | Get opportunity details | - | `{ ok: true, data: CitationOpportunity }` |
| `/v1/citations/opportunities/analyze` | POST | Analyze scan results | `{ scanResults: [], competitors: [] }` | `{ ok: true, data: { opportunities: [] } }` |
| `/v1/citations/opportunities/:id/status` | PUT | Update opportunity status | `{ status: 'outreach' | 'cited' }` | `{ ok: true, data: { status, updatedAt } }` |
| `/v1/citations/opportunities/:id/outreach` | POST | Track outreach | `{ action: 'email_sent', details?: string }` | `{ ok: true, data: { timestamp } }` |
| `/v1/citations/domains/:domain/metrics` | GET | Get domain metrics | - | `{ ok: true, data: DomainMetrics }` |
| `/v1/citations/impact/calculate` | POST | Calculate impact | `{ domain, authority, citationCount, competitorCitations }` | `{ ok: true, data: ImpactAnalysis }` |

**Data Types:**
```typescript
interface CitationOpportunity {
  id: string;
  domain: string;
  domainAuthority: number;
  citationCount: number;
  impactScore: number; // 0-100
  status: 'identified' | 'outreach' | 'cited';
  createdAt: Date;
  updatedAt: Date;
}
```

#### 🟣 Prompt Discovery Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/prompts/discover` | POST | Discover and cluster prompts | `{ industry: string, maxPrompts?: number, algorithm?: 'dbscan' }` | `{ ok: true, data: { clusters: [] } }` |
| `/v1/prompts/clusters` | GET | Get prompt clusters | `?workspaceId=xxx` | `{ ok: true, data: PromptCluster[] }` |
| `/v1/prompts/clusters/:id` | GET | Get cluster details | - | `{ ok: true, data: PromptCluster }` |
| `/v1/prompts/clusters/:id/scan` | POST | Scan cluster | `{ engines?: string[], priority?: number }` | `{ ok: true, data: { jobId } }` |

**Data Types:**
```typescript
interface PromptCluster {
  id: string;
  name: string;
  description?: string;
  prompts: string[];
  size: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 🟠 Directory Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/directory/presence` | GET | Get directory presence analysis | `?workspaceId=xxx` | `DirectoryPresenceReport` |
| `/v1/directories/supported` | GET | Get supported directories | - | `{ ok: true, data: Directory[] }` |
| `/v1/directories/submit` | POST | Submit directory listing | `{ directory: 'gbp', businessInfo: {} }` | `{ ok: true, data: { submissionId } }` |
| `/v1/directories/sync` | POST | Sync directory | `{ directory: 'gbp', workspaceId }` | `{ ok: true, data: { syncJobId } }` |

**Data Types:**
```typescript
interface DirectoryPresenceReport {
  coverage: number;           // 0-100%
  napConsistency: number;     // 0-100%
  listingQuality: number;     // 0-100
  missing: string[];          // Directory types not claimed
  listings: Array<{
    type: string;
    name: string;
    claimed: boolean;
    nap?: { name?: string; address?: string; phone?: string };
    quality?: { completeness: number; reviews: number; photos: number };
  }>;
  recommendations: string[];
}
```

#### 🟦 Content Generation Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/content/generate` | POST | Generate GEO-optimized content | `ContentGenerationRequest` | `{ ok: true, data: GeneratedContent }` |
| `/v1/content/:id` | GET | Get generated content by ID | - | `{ ok: true, data: GeneratedContent }` |
| `/v1/content/:id` | PUT | Update generated content | `Partial<GeneratedContent>` | `{ ok: true, data: GeneratedContent }` |
| `/v1/content/:id/export` | POST | Export content to PDF/DOCX | `{ format: 'pdf' | 'docx', includeSchema?: boolean }` | `{ ok: true, data: { downloadUrl: string, expiresAt: Date } }` |
| `/v1/content/templates/:type` | GET | Get content templates | `type: 'blog' | 'faq' | 'landing' | 'social'` | `{ ok: true, data: { templates: [] } }` |
| `/v1/content/batch-generate` | POST | Generate multiple content pieces | `ContentGenerationRequest[]` | `{ ok: true, data: { results: GeneratedContent[], totalCost: number } }` |

**Data Types:**
```typescript
interface ContentGenerationRequest {
  type: 'blog' | 'faq' | 'landing' | 'social';
  topic: string;
  brandName: string;
  industry?: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'authoritative';
  length?: 'short' | 'medium' | 'long';
  keywords?: string[];
  includeCitations?: boolean;
  includeSchema?: boolean;
}

interface GeneratedContent {
  id: string;
  type: string;
  title: string;
  content: string;
  metaDescription?: string;
  keywords: string[];
  citations?: string[];
  schema?: any; // JSON-LD schema
  cost: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  createdAt: Date;
}

interface ContentTemplate {
  name: string;
  description: string;
}
```

#### ⚫ Metrics Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/metrics/overview` | GET | Get metrics overview | `?from=2025-01-01&to=2025-01-31` | `{ promptSOV, coverage, citationVelocity, timeseries: [] }` |
| `/v1/metrics/citations/top-domains` | GET | Get top citation domains | `?limit=50` | `{ ok: true, data: TopDomain[] }` |

#### 🟧 Hallucination Detection Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/alerts/hallucinations/detect` | POST | Detect hallucinations in AI response | `{ aiResponse: string, engineKey: string, promptId: string }` | `{ ok: true, data: { alerts: [], summary: {} } }` |
| `/v1/alerts/hallucinations/detect-multiple` | POST | Detect in multiple responses | `{ responses: Array<{content, engine, promptId}> }` | `{ ok: true, data: { alerts: [], summary: {} } }` |
| `/v1/alerts/hallucinations` | GET | Get hallucination alerts | `?status=open&severity=critical&engine=perplexity&limit=50` | `{ ok: true, data: { alerts: [] } }` |
| `/v1/alerts/hallucinations/:id` | GET | Get alert details | - | `{ ok: true, data: HallucinationAlert }` |
| `/v1/alerts/hallucinations/:id/status` | PUT | Update alert status | `{ status: 'corrected', correction?: string }` | `{ ok: true, data: { status, updatedAt } }` |
| `/v1/alerts/hallucinations/:id/correct` | POST | Submit correction | `{ platform: string, correctionText: string }` | `{ ok: true, data: { submittedAt } }` |
| `/v1/alerts/hallucinations/analyze-patterns` | POST | Analyze patterns | `{ alertIds: string[] }` | `{ ok: true, data: PatternAnalysis }` |
| `/v1/alerts/hallucinations/stats/summary` | GET | Get statistics | `?timeframe=30d` | `{ ok: true, data: { stats } }` |
| `/v1/alerts/facts/extract` | POST | Extract facts from response | `{ aiResponse: string, engineKey: string }` | `{ ok: true, data: { facts: [] } }` |
| `/v1/alerts/facts/validate` | POST | Validate facts | `{ facts: Fact[] }` | `{ ok: true, data: { validationResults } }` |

**Data Types:**
```typescript
interface HallucinationAlert {
  id: string;
  workspaceId: string;
  engineKey: string;
  promptId: string;
  factType: string; // 'address', 'hours', 'services'
  aiStatement: string;
  correctFact: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'corrected' | 'dismissed';
  createdAt: Date;
  updatedAt: Date;
}
```

#### 🔵 Automation & Copilot Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/automation/copilot/rules` | POST | Create copilot rule | `{ workspaceId, userId, rule: CopilotRule }` | `{ ok: true, data: CopilotRule }` |
| `/v1/automation/copilot/rules/:workspaceId` | GET | Get copilot rules | - | `{ ok: true, data: CopilotRule[] }` |
| `/v1/automation/copilot/rules/:workspaceId/:ruleId` | PUT | Update rule | `Partial<CopilotRule>` | `{ ok: true, data: CopilotRule }` |
| `/v1/automation/copilot/rules/:workspaceId/:ruleId` | DELETE | Delete rule | - | `{ ok: true, data: { deleted } }` |
| `/v1/automation/copilot/evaluate` | POST | Evaluate rules | `{ workspaceId, context }` | `{ ok: true, data: CopilotExecution[] }` |
| `/v1/automation/copilot/metrics/:workspaceId` | GET | Get copilot metrics | - | `{ ok: true, data: CopilotMetrics }` |
| `/v1/automation/pre-signup/analyze` | POST | Initiate pre-signup analysis | `{ brandName, website?, industry?, email }` | `{ ok: true, data: { requestId } }` |
| `/v1/automation/pre-signup/:requestId/status` | GET | Get analysis status | - | `{ ok: true, data: AnalysisStatus }` |
| `/v1/automation/pre-signup/:requestId/results` | GET | Get analysis results | - | `{ ok: true, data: AnalysisResults }` |

**Data Types:**
```typescript
interface CopilotRule {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  fullAuto: boolean;
  requireApproval: boolean;
  maxPagesPerWeek: number;
  enabledActions: string[];
  intensity: number; // 1-3
  conditions: RuleCondition[];
  actions: CopilotAction[];
}

interface CopilotAction {
  id: string;
  workspaceId: string;
  actionType: 'ADD_FAQ' | 'ADD_TLDR' | 'ADD_CITATIONS' | 'FIX_SCHEMA';
  targetUrl: string;
  status: 'PENDING' | 'APPROVED' | 'EXECUTED';
  estimatedImpact: number;
}
```

#### 🟣 Enterprise Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/enterprise/whitelabel/configs` | POST | Create white-label config | `{ workspaceId, agencyName, logoUrl, primaryColor }` | `{ ok: true, data: WhiteLabelConfig }` |
| `/v1/enterprise/whitelabel/configs/:configId` | GET | Get config | - | `{ ok: true, data: WhiteLabelConfig }` |
| `/v1/enterprise/whitelabel/configs/:configId` | PUT | Update config | `Partial<WhiteLabelConfig>` | `{ ok: true, data: WhiteLabelConfig }` |
| `/v1/enterprise/whitelabel/css/:configId` | GET | Get generated CSS | - | `{ ok: true, data: { css: string } }` |
| `/v1/enterprise/api/keys` | POST | Generate API key | `{ clientId, name, permissions, rateLimit }` | `{ ok: true, data: ApiKey }` |
| `/v1/enterprise/api/keys/:clientId` | GET | Get API keys | - | `{ ok: true, data: ApiKey[] }` |
| `/v1/enterprise/api/usage/:keyId` | GET | Get API usage | `?startTime=&endTime=` | `{ ok: true, data: UsageStats }` |
| `/v1/enterprise/marketplace/apps` | GET | Get marketplace apps | `?category=&status=` | `{ ok: true, data: MarketplaceApp[] }` |
| `/v1/enterprise/marketplace/apps/:appId/install` | POST | Install app | `{ workspaceId, userId, config? }` | `{ ok: true, data: Installation }` |

#### 🔴 Settings Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/settings/llm` | GET | Get LLM configuration | - | `{ ok: true, data: { current: LLMConfig, available: Provider[] } }` |
| `/v1/settings/llm` | PUT | Update LLM configuration | `{ provider: 'openai', model: 'gpt-4' }` | `{ ok: true, data: { config } }` |
| `/v1/settings/llm/test` | POST | Test LLM provider | `{ provider, model, testPrompt? }` | `{ ok: true, data: { available, testResponse? } }` |
| `/v1/settings/llm/usage` | GET | Get LLM usage statistics | - | `{ ok: true, data: { usage, budget } }` |
| `/v1/settings/llm/providers` | GET | Get available providers | - | `{ ok: true, data: Provider[] }` |
| `/v1/settings/llm/estimate-cost` | POST | Estimate cost | `{ provider, model, promptTokens, completionTokens }` | `{ ok: true, data: { cost, breakdown } }` |

#### ⚫ Progress Tracking Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/progress` | POST | Create progress tracker | `{ operation: string, totalSteps?: number }` | `ProgressState` |
| `/v1/progress/:progressId` | GET | Get progress | - | `ProgressState` |
| `/v1/progress` | GET | Get all workspace progress | - | `ProgressState[]` |
| `/v1/progress/:progressId` | PUT | Update progress | `Partial<ProgressState>` | `ProgressState` |
| `/v1/progress/:progressId/complete` | POST | Complete progress | `{ success?: boolean, error?: string }` | `ProgressState` |
| `/v1/progress/metrics/summary` | GET | Get progress metrics | - | `{ total, pending, running, completed, failed }` |

#### 🟦 Webhooks Management Endpoints (Schema Ready - Implementation Needed)

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/webhooks` | GET | Get webhooks | `?workspaceId=xxx` | `{ ok: true, data: Webhook[] }` |
| `/v1/webhooks` | POST | Create webhook | `{ url, events: string[], secret? }` | `{ ok: true, data: Webhook }` |
| `/v1/webhooks/:id` | GET | Get webhook | - | `{ ok: true, data: Webhook }` |
| `/v1/webhooks/:id` | PUT | Update webhook | `Partial<Webhook>` | `{ ok: true, data: Webhook }` |
| `/v1/webhooks/:id` | DELETE | Delete webhook | - | `{ ok: true, data: { deleted } }` |
| `/v1/webhooks/:id/deliveries` | GET | Get delivery history | `?status=&limit=` | `{ ok: true, data: WebhookDelivery[] }` |
| `/v1/webhooks/:id/test` | POST | Test webhook | `{ event, payload }` | `{ ok: true, data: { status, response } }` |

**Data Types:**
```typescript
interface Webhook {
  id: string;
  workspaceId: string;
  url: string;
  events: string[]; // 'scan.complete', 'hallucination.detected', 'report.generated', 'budget.exceeded'
  secret: string;
  enabled: boolean;
  createdAt: Date;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  lastAttempt?: Date;
}
```

#### 🟫 Connections (Third-Party Integrations) Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/connections` | GET | Get connections | `?workspaceId=xxx&type=GBP` | `{ ok: true, data: Connection[] }` |
| `/v1/connections` | POST | Create connection | `{ type: ConnectionType, config: any }` | `{ ok: true, data: Connection }` |
| `/v1/connections/:id` | GET | Get connection | - | `{ ok: true, data: Connection }` |
| `/v1/connections/:id` | PUT | Update connection | `{ config: any, status?: string }` | `{ ok: true, data: Connection }` |
| `/v1/connections/:id` | DELETE | Delete connection | - | `{ ok: true, data: { deleted } }` |
| `/v1/connections/:id/sync` | POST | Sync connection | - | `{ ok: true, data: { syncJobId, status } }` |
| `/v1/connections/:id/status` | GET | Get sync status | - | `{ ok: true, data: SyncStatus }` |

**Data Types:**
```typescript
type ConnectionType = 'GBP' | 'YELP' | 'FB' | 'APPLE' | 'WEBFLOW' | 'WP' | 'NOTION' | 'HUBSPOT' | 'PIPEDRIVE';

interface Connection {
  id: string;
  workspaceId: string;
  type: ConnectionType;
  status: 'connected' | 'disconnected' | 'error';
  config?: any;
  lastSyncAt?: Date;
  createdAt: Date;
}
```

#### 🔵 Engine Configuration Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/engines` | GET | Get engines | `?workspaceId=xxx` | `{ ok: true, data: Engine[] }` |
| `/v1/engines/:id` | GET | Get engine | - | `{ ok: true, data: Engine }` |
| `/v1/engines/:id` | PUT | Update engine config | `{ enabled?, dailyBudgetCents?, concurrency?, config? }` | `{ ok: true, data: Engine }` |
| `/v1/engines/:id/enable` | POST | Enable engine | - | `{ ok: true, data: { enabled: true } }` |
| `/v1/engines/:id/disable` | POST | Disable engine | - | `{ ok: true, data: { enabled: false } }` |
| `/v1/engines/:id/budget` | PUT | Update budget | `{ dailyBudgetCents: number }` | `{ ok: true, data: { budget } }` |

**Data Types:**
```typescript
interface Engine {
  id: string;
  workspaceId: string;
  key: EngineKey; // 'PERPLEXITY' | 'AIO' | 'BRAVE' | 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'COPILOT'
  enabled: boolean;
  config?: any;
  dailyBudgetCents: number;
  concurrency: number;
  region?: string;
  lastRunAt?: Date;
  avgLatencyMs?: number;
}
```

#### 🟡 Prompts Management Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/prompts` | GET | Get prompts | `?workspaceId=xxx&intent=BEST&active=true` | `{ ok: true, data: Prompt[] }` |
| `/v1/prompts` | POST | Create prompt | `{ text, intent, vertical?, tags? }` | `{ ok: true, data: Prompt }` |
| `/v1/prompts/:id` | GET | Get prompt | - | `{ ok: true, data: Prompt }` |
| `/v1/prompts/:id` | PUT | Update prompt | `Partial<Prompt>` | `{ ok: true, data: Prompt }` |
| `/v1/prompts/:id` | DELETE | Delete prompt | - | `{ ok: true, data: { deleted } }` |
| `/v1/prompts/:id/activate` | POST | Activate prompt | - | `{ ok: true, data: { active: true } }` |
| `/v1/prompts/:id/deactivate` | POST | Deactivate prompt | - | `{ ok: true, data: { active: false } }` |

**Data Types:**
```typescript
interface Prompt {
  id: string;
  workspaceId: string;
  text: string;
  canonicalText?: string;
  intent: 'BEST' | 'ALTERNATIVES' | 'PRICING' | 'VS' | 'HOWTO';
  vertical?: string;
  active: boolean;
  tags: string[];
  createdAt: Date;
}
```

#### 🟣 Workspace Invitations Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/workspaces/:workspaceId/invitations` | GET | Get invitations | `?status=PENDING` | `{ ok: true, data: Invitation[] }` |
| `/v1/workspaces/:workspaceId/invitations` | POST | Send invitation | `{ email, role: 'ADMIN' | 'MEMBER' | 'VIEWER' }` | `{ ok: true, data: Invitation }` |
| `/v1/workspaces/:workspaceId/invitations/:id` | GET | Get invitation | - | `{ ok: true, data: Invitation }` |
| `/v1/workspaces/:workspaceId/invitations/:id/resend` | POST | Resend invitation | - | `{ ok: true, data: { resentAt } }` |
| `/v1/workspaces/:workspaceId/invitations/:id/revoke` | POST | Revoke invitation | - | `{ ok: true, data: { revokedAt } }` |
| `/v1/invitations/accept/:token` | POST | Accept invitation | - | `{ ok: true, data: { workspaceId, joinedAt } }` |

**Data Types:**
```typescript
interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  invitedBy: string;
  token: string;
  expiresAt: Date;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  createdAt: Date;
}
```

#### 🟪 Workspace Export & GDPR Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/workspaces/:workspaceId/export` | POST | Export workspace data | `{ format: 'json' | 'csv' }` | `{ ok: true, data: { downloadUrl, expiresAt } }` |
| `/v1/workspaces/:workspaceId/export/history` | GET | Get export history | - | `{ ok: true, data: { exports: [] } }` |
| `/v1/workspaces/:workspaceId/gdpr/delete` | POST | Initiate GDPR deletion | `{ reason: string }` | `{ ok: true, data: { scheduledFor, reason } }` |
| `/v1/workspaces/:workspaceId/gdpr/cancel` | POST | Cancel deletion | - | `{ ok: true, data: { message } }` |
| `/v1/workspaces/:workspaceId/gdpr/status` | GET | Get deletion status | - | `{ ok: true, data: DeletionStatus }` |

#### 🔴 Real-Time Events (SSE)

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/v1/events/stream` | GET | SSE event stream | `?workspaceId=xxx&userId=xxx&lastEventId=xxx` | Server-Sent Events |
| `/v1/events/stats` | GET | Connection stats | - | `{ ok: true, data: ConnectionStats }` |

**Event Types:**
- `connected` - Connection established
- `scan.progress` - Scan progress update
- `maturity.recomputing` - Maturity recompute started
- `maturity.completed` - Maturity recompute completed
- `geo.recommendations.updated` - Recommendations refreshed
- `copilot.action` - Copilot action executed
- `sync.status` - Directory sync status
- `heartbeat` - Keep-alive (every 30s)

---

## Feature Matrix

### ✅ Current Features (Built)

#### 1. **Dashboard Overview**
- **Page**: `/dashboard`
- **Components**: 
  - Summary cards (Visibility Score, Maturity Level, Citation Count)
  - Quick actions (Run Scan, View Recommendations, Check Maturity)
  - Recent activity feed
  - Trend charts (7d, 30d, 90d)
- **APIs**: `/v1/metrics/overview`, `/v1/geo/maturity`
- **Real-time**: SSE updates for maturity changes

#### 2. **GEO Maturity Dashboard**
- **Page**: `/geo/maturity`
- **Components**:
  - 4-dimension gauges (Entity Strength, Citation Depth, Structural Clarity, Update Cadence)
  - Overall maturity score (0-100)
  - Maturity level badge (beginner/intermediate/advanced/expert)
  - Progress charts over time
  - Recompute button (triggers async job)
- **APIs**: `/v1/geo/maturity`, `/v1/geo/recompute`
- **Real-time**: SSE `maturity.completed` event
- **Visual**: Circular progress gauges, sparkline charts

#### 3. **Evidence Graph Visualization**
- **Page**: `/geo/evidence`
- **Components**:
  - Interactive graph visualization (nodes = evidence, edges = relationships)
  - Filter controls (by source type: licensed_publisher, reddit, directory, curated)
  - Evidence node details panel (on click)
  - Consensus score display
  - Metadata summary (total evidence, licensed publishers, Reddit mentions)
- **APIs**: `/v1/geo/evidence/graph`
- **Libraries needed**: D3.js or Cytoscape.js for graph visualization
- **Visual**: Force-directed graph, color-coded by source type

#### 4. **Prescriptive Recommendations**
- **Page**: `/geo/recommendations`
- **Components**:
  - Recommendations list (sorted by priority: critical > high > medium > low)
  - Recommendation card with:
    - Priority badge (color-coded)
    - Message text
    - Estimated impact (0-100)
    - Effort level (low/medium/high)
    - Action button (e.g., "Fix Schema", "Add Citations")
  - Filter by type (citation_gap, schema_missing, reddit_presence, freshness)
  - Refresh button (triggers async job)
- **APIs**: `/v1/recommendations`, `/v1/recommendations/refresh`
- **Real-time**: SSE `geo.recommendations.updated` event

#### 5. **Citation Opportunities**
- **Page**: `/citations/opportunities`
- **Components**:
  - Opportunities table/grid with:
    - Domain name
    - Domain authority (0-100)
    - Impact score (0-100, color-coded: high ≥70, medium 40-69, low <40)
    - Status (identified/outreach/cited)
    - Actions (Update Status, Track Outreach)
  - Filters: Status, Min Score, Search
  - Sort: By impact score (desc), domain authority (desc)
  - Bulk actions (Mark as Outreach, etc.)
- **APIs**: `/v1/citations/opportunities`, `/v1/citations/opportunities/:id/status`
- **Sub-pages**: `/citations/opportunities/:id` (detail view)

#### 6. **Visibility Score Details**
- **Page**: `/geo/scoring/:brandName`
- **Components**:
  - Overall score (large display, 0-100)
  - Breakdown chart (mentions, rankings, citations, sentiment, authority, freshness)
  - Engine-specific scores (if multiple engines)
  - Recommendations list
  - Trend charts (weekly, monthly, quarterly)
  - Competitive comparison
- **APIs**: `/v1/geo/scoring/:brandName?timeRange=30d&engines=perplexity,aio`
- **Visual**: Donut charts, line charts

#### 7. **Directory Presence Analysis**
- **Page**: `/directories/presence`
- **Components**:
  - Coverage gauge (0-100%)
  - NAP consistency gauge (0-100%)
  - Directory listings grid:
    - Directory name (GBP, Bing Places, G2, etc.)
    - Claimed status (Yes/No badge)
    - NAP info (if claimed)
    - Quality score (if claimed)
  - Missing directories list
  - Recommendations
- **APIs**: `/v1/directory/presence`
- **Visual**: Progress bars, status badges

#### 8. **Prompt Discovery & Clustering**
- **Page**: `/prompts/discovery`
- **Components**:
  - Discovery form (industry, max prompts, algorithm selection)
  - Clusters list/grid:
    - Cluster name
    - Number of prompts
    - Description
    - Actions (View Details, Scan Cluster)
  - Cluster detail view:
    - Prompts list
    - Scan results per engine
- **APIs**: `/v1/prompts/discover`, `/v1/prompts/clusters`
- **Sub-pages**: `/prompts/clusters/:id`

#### 9. **Content Generation (Blog, FAQ, Landing, Social)**
- **Page**: `/content/generate`
- **Components**:
  - Content type selector (Blog, FAQ, Landing Page, Social Media)
  - Generation form:
    - Topic input
    - Brand name (auto-filled from workspace)
    - Industry selector
    - Tone selector (professional, casual, friendly, authoritative)
    - Length selector (short, medium, long)
    - Keywords input (multi-select/tags)
    - Toggles: Include Citations, Include Schema
  - Template selector (when type selected, shows available templates)
  - Generate button (shows loading state, progress)
  - Generated content preview:
    - Title
    - Content body (markdown rendered)
    - Meta description
    - Keywords tags
    - Citations list
    - Schema JSON-LD preview
    - Cost and token usage display
  - Action buttons:
    - Edit content
    - Export (PDF/DOCX)
    - Save to library
    - Regenerate
- **APIs**: 
  - `POST /v1/content/generate` - Generate content
  - `GET /v1/content/templates/:type` - Get templates
  - `POST /v1/content/batch-generate` - Batch generation
  - `GET /v1/content/:id` - Get content
  - `PUT /v1/content/:id` - Update content
  - `POST /v1/content/:id/export` - Export content
- **Sub-pages**: 
  - `/content/:id` - Content editor/viewer
  - `/content/library` - All generated content list
- **Visual**: Form layout, markdown preview, code block for schema

#### 10. **Metrics & Analytics**
- **Page**: `/analytics/metrics`
- **Components**:
  - Time range selector (7d, 30d, 90d, custom)
  - Key metrics cards:
    - Prompt SOV (Share of Voice)
    - Coverage percentage
    - Citation velocity
    - AIO impressions
  - Time-series charts for each metric
  - Top citation domains table
- **APIs**: `/v1/metrics/overview`, `/v1/metrics/citations/top-domains`
- **Visual**: Line charts, bar charts

#### 11. **Workspace Settings**
- **Page**: `/settings/workspace`
- **Components**:
  - Workspace profile form (business name, address, phone, hours, services, description)
  - Engine configuration:
    - Enable/disable engines
    - Daily budget per engine
    - Concurrency limits
  - LLM settings (default provider, model)
  - Auto-approval toggle
- **APIs**: (Database updates via Prisma)

#### 12. **Team Management**
- **Page**: `/settings/members`
- **Components**:
  - Members table (name, email, role, joined date)
  - Invite member button (opens modal)
  - Role dropdown (Owner, Admin, Member, Viewer)
  - Remove member action
- **APIs**: (Database operations)

#### 13. **API Key Management**
- **Page**: `/settings/api-keys`
- **Components**:
  - API keys list (name, last used, created, status)
  - Create API key button (generates key, shows once)
  - Revoke button
- **APIs**: (Database operations)

#### 14. **Hallucination Detection & Alerts**
- **Page**: `/alerts/hallucinations`
- **Components**:
  - Alerts table with filters:
    - Status (open, corrected, dismissed)
    - Severity (critical, high, medium, low)
    - Engine filter
  - Alert detail view:
    - AI statement vs correct fact
    - Severity badge
    - Status badge
    - Actions: Mark as Corrected, Submit Correction, Dismiss
  - Manual detection form:
    - AI response textarea
    - Engine selector
    - Prompt ID input
    - Detect button
  - Statistics summary:
    - Total alerts
    - Breakdown by severity
    - Breakdown by engine
    - Trend chart
  - Pattern analysis:
    - Common hallucination types
    - Frequent engine errors
- **APIs**: 
  - `POST /v1/alerts/hallucinations/detect`
  - `GET /v1/alerts/hallucinations`
  - `PUT /v1/alerts/hallucinations/:id/status`
  - `POST /v1/alerts/hallucinations/:id/correct`
  - `GET /v1/alerts/hallucinations/stats/summary`
- **Sub-pages**: `/alerts/hallucinations/:id` (detail view)
- **Visual**: Alerts table, severity badges, comparison view (AI vs correct)

#### 15. **Copilot Automation & Rules**
- **Page**: `/automation/copilot`
- **Components**:
  - Copilot rules list:
    - Rule name, description
    - Enabled status toggle
    - Trigger count
    - Last triggered date
    - Actions (Edit, Delete, Enable/Disable)
  - Create/Edit rule form:
    - Rule name, description
    - Full auto toggle
    - Require approval toggle
    - Max pages per week
    - Enabled actions (checkboxes)
    - Intensity slider (1-3)
    - Conditions editor (when rule triggers)
    - Actions editor (what to do)
  - Pending actions queue:
    - Actions awaiting approval
    - Approve/Reject buttons
    - Action details (type, target, impact)
  - Copilot metrics:
    - Rules executed count
    - Actions completed
    - Success rate
    - Average impact
- **APIs**:
  - `GET /v1/automation/copilot/rules/:workspaceId`
  - `POST /v1/automation/copilot/rules`
  - `PUT /v1/automation/copilot/rules/:workspaceId/:ruleId`
  - `DELETE /v1/automation/copilot/rules/:workspaceId/:ruleId`
  - `GET /v1/automation/copilot/metrics/:workspaceId`
- **Sub-pages**: `/automation/rules/:id` (edit rule)
- **Visual**: Rule cards, action queue list, metrics dashboard

#### 16. **Pre-Signup Analysis**
- **Page**: `/automation/pre-signup`
- **Components**:
  - Pre-signup form:
    - Brand name input
    - Website URL input
    - Industry selector
    - Email input
    - Submit button
  - Analysis status tracker:
    - Progress steps
    - Status (pending, analyzing, completed)
    - Estimated time remaining
  - Analysis results:
    - Current visibility score
    - Citation opportunities
    - Recommended actions
    - Personalized insights
- **APIs**:
  - `POST /v1/automation/pre-signup/analyze`
  - `GET /v1/automation/pre-signup/:requestId/status`
  - `GET /v1/automation/pre-signup/:requestId/results`
- **Visual**: Multi-step form, progress tracker, results cards

#### 17. **White-Label Configuration (Enterprise)**
- **Page**: `/enterprise/whitelabel`
- **Components**:
  - White-label settings form:
    - Agency name
    - Logo upload
    - Favicon upload
    - Primary color picker
    - Custom domain input
    - Email from name
  - CSS preview:
    - Live preview of generated CSS
    - Copy CSS button
    - Download CSS file
  - Domain validation:
    - Domain input
    - Validate button
    - Validation status (DNS records check)
- **APIs**:
  - `GET /v1/enterprise/whitelabel/configs/:configId`
  - `POST /v1/enterprise/whitelabel/configs`
  - `PUT /v1/enterprise/whitelabel/configs/:configId`
  - `GET /v1/enterprise/whitelabel/css/:configId`
  - `POST /v1/enterprise/whitelabel/validate-domain`
- **Visual**: Color picker, logo uploader, CSS code viewer

#### 18. **API Marketplace (Enterprise)**
- **Page**: `/enterprise/marketplace`
- **Components**:
  - Marketplace apps grid:
    - App cards (name, description, category, rating)
    - Install button
    - Category filters
  - Installed apps list:
    - Installed apps
    - Configuration links
    - Uninstall button
  - App installation modal:
    - Configuration options
    - Permissions review
    - Install button
- **APIs**:
  - `GET /v1/enterprise/marketplace/apps`
  - `POST /v1/enterprise/marketplace/apps/:appId/install`
  - `GET /v1/enterprise/marketplace/installations/:workspaceId`
- **Visual**: App cards grid, installation modals

#### 19. **Progress Tracking Dashboard**
- **Page**: `/progress/tracking`
- **Components**:
  - Progress list:
    - Operation name
    - Current step / total steps
    - Progress percentage bar
    - Status (pending, running, completed, failed)
    - Time elapsed
  - Progress detail view:
    - Step-by-step progress
    - Current step highlight
    - Logs/output
    - Cancel button (if running)
  - Progress metrics:
    - Total operations
    - Pending count
    - Running count
    - Completed count
    - Failed count
- **APIs**:
  - `GET /v1/progress`
  - `GET /v1/progress/:progressId`
  - `GET /v1/progress/metrics/summary`
- **Real-time**: SSE updates for progress changes
- **Visual**: Progress bars, step indicators, metrics cards

#### 20. **Workspace Data Export**
- **Page**: `/export/data`
- **Components**:
  - Export form:
    - Format selector (JSON, CSV)
    - Data sections selector (checkboxes):
      - Prompts
      - Citations
      - Metrics
      - Workspace profile
      - All data
    - Export button
  - Export history:
    - Past exports list
    - Download links (if not expired)
    - Export date, format, size
    - Status (completed, expired)
  - Download modal:
    - Download URL
    - Expiration warning
    - Download button
- **APIs**:
  - `POST /v1/workspaces/:workspaceId/export`
  - `GET /v1/workspaces/:workspaceId/export/history`
- **Visual**: Format selector, data section checkboxes, export history table

#### 21. **GDPR Deletion Requests**
- **Page**: `/export/gdpr`
- **Components**:
  - Deletion status display:
    - Current status (none, pending, scheduled)
    - Scheduled deletion date (if pending)
    - Days remaining
  - Initiate deletion form:
    - Reason textarea (required)
    - Warning message
    - Confirm checkbox
    - Submit button
  - Cancel deletion:
    - Cancel button (if pending)
    - Confirmation modal
  - Information:
    - What will be deleted
    - Recovery options
    - Timeline (7 days grace period)
- **APIs**:
  - `GET /v1/workspaces/:workspaceId/gdpr/status`
  - `POST /v1/workspaces/:workspaceId/gdpr/delete`
  - `POST /v1/workspaces/:workspaceId/gdpr/cancel`
- **Visual**: Status banner, warning alerts, confirmation modals

#### 22. **LLM Settings & Configuration**
- **Page**: `/settings/llm`
- **Components**:
  - LLM provider selector:
    - Provider cards (OpenAI, Anthropic, Gemini)
    - Current provider highlight
    - Switch provider button
  - Model selector:
    - Available models dropdown
    - Current model display
    - Model details (cost, capabilities)
  - Test connection:
    - Test button
    - Test prompt input
    - Test results display
    - Cost estimate
  - Usage statistics:
    - Total tokens used
    - Total cost
    - Budget status
    - Usage over time chart
  - Cost estimator:
    - Token input (prompt + completion)
    - Estimated cost display
    - Cost breakdown
- **APIs**:
  - `GET /v1/settings/llm`
  - `PUT /v1/settings/llm`
  - `POST /v1/settings/llm/test`
  - `GET /v1/settings/llm/usage`
  - `GET /v1/settings/llm/providers`
  - `POST /v1/settings/llm/estimate-cost`
- **Visual**: Provider cards, model selector dropdown, cost charts

#### 23. **Webhooks Management**
- **Page**: `/webhooks/manage`
- **Components**:
  - Webhooks list:
    - Webhook URL, events, status (enabled/disabled)
    - Last delivery status
    - Actions: Edit, Delete, Test, Enable/Disable
  - Create webhook form:
    - URL input
    - Secret input (with generate button)
    - Events selector (checkboxes):
      - scan.complete
      - hallucination.detected
      - report.generated
      - budget.exceeded
      - copilot.action
      - maturity.updated
    - Enable toggle
    - Create button
  - Webhook delivery history:
    - Delivery logs table
    - Status badges (pending, delivered, failed)
    - Retry button for failed deliveries
    - Payload viewer
- **APIs**:
  - `GET /v1/webhooks`
  - `POST /v1/webhooks`
  - `PUT /v1/webhooks/:id`
  - `DELETE /v1/webhooks/:id`
  - `GET /v1/webhooks/:id/deliveries`
  - `POST /v1/webhooks/:id/test`
- **Visual**: Webhooks table, event selector, delivery logs

#### 24. **Third-Party Connections (Integrations)**
- **Page**: `/connections/integrations`
- **Components**:
  - Connection cards grid:
    - Connection type badges (GBP, Yelp, Facebook, Apple, Webflow, WordPress, Notion, HubSpot, Pipedrive)
    - Status indicator (connected, disconnected, error)
    - Last sync timestamp
    - Connect/Disconnect button
  - Connection detail modal:
    - Configuration form (varies by type)
    - OAuth connect flow
    - Test connection button
    - Sync status and history
  - Sync history:
    - Recent syncs list
    - Success/failure status
    - Records synced count
- **APIs**:
  - `GET /v1/connections`
  - `POST /v1/connections`
  - `PUT /v1/connections/:id`
  - `DELETE /v1/connections/:id`
  - `POST /v1/connections/:id/sync`
  - `GET /v1/connections/:id/status`
- **Visual**: Connection cards, OAuth flows, sync status indicators

#### 25. **Engine Configuration**
- **Page**: `/engines/configure`
- **Components**:
  - Engine cards list:
    - Engine name (Perplexity, Google AIO, Brave, OpenAI, Anthropic, Gemini, Copilot)
    - Enabled/disabled toggle
    - Budget display
    - Last run timestamp
    - Average latency
  - Engine configuration panel:
    - Enable/disable toggle
    - Daily budget input (cents)
    - Concurrency slider
    - Region selector (if applicable)
    - Advanced config (JSON editor)
    - Save button
  - Engine metrics:
    - Requests today
    - Cost today
    - Average latency chart
    - Success rate
- **APIs**:
  - `GET /v1/engines`
  - `PUT /v1/engines/:id`
  - `POST /v1/engines/:id/enable`
  - `POST /v1/engines/:id/disable`
  - `PUT /v1/engines/:id/budget`
- **Visual**: Engine cards, budget sliders, metrics charts

#### 26. **Prompts Management**
- **Page**: `/prompts/manage`
- **Components**:
  - Prompts table:
    - Prompt text (truncated)
    - Intent badge (BEST, ALTERNATIVES, PRICING, VS, HOWTO)
    - Active status toggle
    - Tags display
    - Actions: Edit, Delete, Deactivate
  - Create/Edit prompt form:
    - Prompt text textarea
    - Intent selector
    - Vertical input
    - Tags input (multi-select)
    - Active toggle
    - Save button
  - Filters:
    - Intent filter
    - Active/Inactive filter
    - Tag filter
    - Search bar
  - Prompt stats:
    - Total prompts
    - Active count
    - Breakdown by intent
- **APIs**:
  - `GET /v1/prompts`
  - `POST /v1/prompts`
  - `PUT /v1/prompts/:id`
  - `DELETE /v1/prompts/:id`
  - `POST /v1/prompts/:id/activate`
  - `POST /v1/prompts/:id/deactivate`
- **Visual**: Prompts table, intent badges, tag chips, filters

#### 27. **Workspace Invitations**
- **Page**: `/invitations/manage`
- **Components**:
  - Invitations list:
    - Email address
    - Role badge (Admin, Member, Viewer)
    - Status badge (Pending, Accepted, Expired, Revoked)
    - Expires at timestamp
    - Actions: Resend, Revoke
  - Send invitation form:
    - Email input
    - Role selector dropdown
    - Send button
  - Pending invitations count:
    - Badge with count
    - Expiring soon warning
- **APIs**:
  - `GET /v1/workspaces/:workspaceId/invitations`
  - `POST /v1/workspaces/:workspaceId/invitations`
  - `POST /v1/workspaces/:workspaceId/invitations/:id/resend`
  - `POST /v1/workspaces/:workspaceId/invitations/:id/revoke`
  - `POST /v1/invitations/accept/:token` (public endpoint)
- **Sub-pages**: Invitation acceptance page (public, token-based)
- **Visual**: Invitations table, role badges, status indicators

### 🚧 Planned Features (Next 5-10 Weeks)

#### 1. **E-E-A-T Scoring Dashboard** (Week 1-2)
- **Page**: `/geo/eeat`
- **Components**:
  - 4-dimension E-E-A-T gauges:
    - Experience (0-100)
    - Expertise (0-100)
    - Authoritativeness (0-100)
    - Trustworthiness (0-100)
  - Overall E-E-A-T score
  - Breakdown charts per dimension
  - Recommendations for each dimension
- **APIs**: `GET /v1/geo/eeat` (to be built)
- **Visual**: Circular gauges, radar chart

#### 2. **Fact-Level Consensus Tracking** (Week 3)
- **Page**: `/geo/consensus`
- **Components**:
  - Fact type selector (address, hours, services, pricing, etc.)
  - Consensus score per fact type (0-100)
  - Independent sources count
  - Agreements vs contradictions display
  - Source agreement matrix (which sources agree)
- **APIs**: `GET /v1/geo/consensus?factType=address` (to be built)
- **Visual**: Consensus bars, agreement matrix table

#### 3. **GEO Gap Analysis Dashboard** (Week 4-6)
- **Page**: `/geo/gaps`
- **Components**:
  - 4-dimension gap visualization:
    - Current vs target scores
    - Gap size (visual bars)
  - Prioritized recommendations (sorted by impact)
  - Progress tracking over time
  - Action buttons for each recommendation
- **APIs**: Uses existing `/v1/geo/maturity` and `/v1/recommendations`
- **Visual**: Gap bars, progress charts, priority matrix

#### 4. **Prompt-Space Coverage Visualization** (Week 7-8)
- **Page**: `/prompts/coverage`
- **Components**:
  - Intent distribution heatmap (BEST, ALTERNATIVES, PRICING, VS, HOWTO)
  - "Cold spots" identification (intents with no coverage)
  - Prompt coverage trends chart
  - Recommendations for missing intents
- **APIs**: `GET /v1/geo/coverage` (to be built)
- **Visual**: Heatmap, bar charts

#### 5. **Cross-Engine Visibility Comparison** (Week 9)
- **Page**: `/geo/engines/comparison`
- **Components**:
  - Visibility score breakdown by engine (Perplexity, ChatGPT, AIO, etc.)
  - Engine-specific recommendations
  - Trend charts per engine
  - Engine performance ranking
- **APIs**: `GET /v1/geo/engines/comparison` (to be built)
- **Visual**: Grouped bar charts, line charts per engine

#### 6. **Structural Scoring Details** (Week 10)
- **Page**: `/geo/structural`
- **Components**:
  - Schema score breakdown (Organization, LocalBusiness, Product, FAQ, HowTo)
  - Freshness analysis (stale pages list)
  - Page structure assessment (atomic pages, TL;DR, headings)
  - Recommendations per page
- **APIs**: Uses `/v1/geo/maturity` (structuralClarity dimension)
- **Visual**: Score breakdowns, page lists

---

## Component Library

### Core UI Components

#### 1. **Score Gauge Component**
```typescript
interface ScoreGaugeProps {
  score: number; // 0-100
  label: string;
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'success' | 'warning' | 'danger';
  showPercentage?: boolean;
}
```
**Visual**: Circular progress gauge with animated fill

#### 2. **Recommendation Card Component**
```typescript
interface RecommendationCardProps {
  recommendation: Recommendation;
  onAction?: (action: CopilotActionType) => void;
  showImpact?: boolean;
}
```
**Visual**: Card with priority badge, message, impact bar, action button

#### 3. **Evidence Graph Component**
```typescript
interface EvidenceGraphProps {
  graph: EntityEvidenceGraph;
  onNodeClick?: (node: EvidenceNode) => void;
  filters?: { sourceType?: string; verified?: boolean };
}
```
**Visual**: Interactive force-directed graph (D3.js or Cytoscape.js)

#### 4. **Opportunity Table Component**
```typescript
interface OpportunityTableProps {
  opportunities: CitationOpportunity[];
  onStatusUpdate?: (id: string, status: string) => void;
  filters?: { status?: string; minScore?: number };
  sortBy?: 'impactScore' | 'domainAuthority' | 'createdAt';
}
```
**Visual**: Sortable table with status badges, impact score bars

#### 5. **Directory Presence Grid Component**
```typescript
interface DirectoryGridProps {
  report: DirectoryPresenceReport;
  onClaim?: (directoryType: string) => void;
}
```
**Visual**: Grid of directory cards with claimed/unclaimed status

#### 6. **Progress Tracker Component**
```typescript
interface ProgressTrackerProps {
  jobId: string;
  eventType: string; // SSE event type to listen for
  onComplete?: () => void;
}
```
**Visual**: Progress bar with percentage, status text

#### 7. **SSE Connection Component**
```typescript
interface SSEConnectionProps {
  workspaceId: string;
  userId: string;
  onEvent?: (event: SSEEvent) => void;
  reconnectOnError?: boolean;
}
```
**Purpose**: Manages SSE connection, auto-reconnect, event handling

#### 8. **Engine Selector Component**
```typescript
interface EngineSelectorProps {
  selected: EngineKey[];
  onChange: (engines: EngineKey[]) => void;
  multiSelect?: boolean;
}
```
**Visual**: Checkbox group or multi-select dropdown

#### 9. **Time Range Selector Component**
```typescript
interface TimeRangeSelectorProps {
  value: '7d' | '30d' | '90d' | 'custom';
  onChange: (range: string) => void;
  customDates?: { start: Date; end: Date };
}
```
**Visual**: Toggle buttons or dropdown

#### 10. **Maturity Level Badge Component**
```typescript
interface MaturityBadgeProps {
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  score?: number;
}
```
**Visual**: Badge with color-coded background (red/yellow/green/blue)

#### 11. **Content Generation Form Component**
```typescript
interface ContentGenerationFormProps {
  workspaceId: string;
  brandName: string;
  onGenerate: (request: ContentGenerationRequest) => Promise<GeneratedContent>;
  onCancel?: () => void;
}
```
**Visual**: Multi-step form with type selector, topic input, tone/length selectors, keyword tags, toggles

#### 12. **Content Editor Component**
```typescript
interface ContentEditorProps {
  content: GeneratedContent;
  onSave: (updates: Partial<GeneratedContent>) => Promise<void>;
  readOnly?: boolean;
}
```
**Visual**: Markdown editor (e.g., React Markdown Editor) with preview pane, title/meta/keywords editors

#### 13. **Content Preview Component**
```typescript
interface ContentPreviewProps {
  content: GeneratedContent;
  showSchema?: boolean;
  showCitations?: boolean;
}
```
**Visual**: Rendered markdown content, schema JSON viewer, citations list, export buttons

#### 14. **Template Selector Component**
```typescript
interface TemplateSelectorProps {
  type: 'blog' | 'faq' | 'landing' | 'social';
  templates: ContentTemplate[];
  onSelect: (template: ContentTemplate) => void;
}
```
**Visual**: Grid of template cards with name and description

#### 15. **Content Library Component**
```typescript
interface ContentLibraryProps {
  contents: GeneratedContent[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onExport: (id: string, format: 'pdf' | 'docx') => void;
  filters?: { type?: string; dateRange?: { start: Date; end: Date } };
}
```
**Visual**: Grid or list view with content cards, filter bar, search

---

## Data Models & Types

### Core Data Types

```typescript
// Workspace & User
interface Workspace {
  id: string;
  name: string;
  tier: 'FREE' | 'INSIGHTS' | 'COPILOT';
  createdAt: Date;
}

interface User {
  id: string;
  email: string;
  workspaces: Workspace[];
}

// GEO Scoring
interface GEOVisibilityScore {
  overall: number;
  breakdown: {
    mentionScore: number;
    rankingScore: number;
    citationScore: number;
    competitorScore: number;
    structuralScore?: number;
  };
  details: {
    totalMentions: number;
    averagePosition: number;
    topRankings: number;
    citationAuthority: number;
    engineKey?: EngineKey;
  };
}

interface GEOMaturityScore {
  entityStrength: number;
  citationDepth: number;
  structuralClarity: number;
  updateCadence: number;
  overallScore: number;
  maturityLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  recommendations: Recommendation[];
}

// Recommendations
interface Recommendation {
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  action: CopilotActionType;
  estimatedImpact: number;
  effort: 'low' | 'medium' | 'high';
  targetUrl?: string;
  targetDomain?: string;
}

// Citations
interface CitationOpportunity {
  id: string;
  workspaceId: string;
  domain: string;
  domainAuthority: number;
  citationCount: number;
  impactScore: number;
  status: 'identified' | 'outreach' | 'cited';
  createdAt: Date;
  updatedAt: Date;
}

// Evidence
interface EvidenceNode {
  id: string;
  type: 'citation' | 'reddit_mention' | 'directory_listing' | 'licensed_content';
  source: string;
  sourceDomain: string;
  authority: number;
  freshness: Date;
  verified: boolean;
}

interface EntityEvidenceGraph {
  entity: { workspaceId: string; entityType: string; name?: string };
  evidenceNodes: EvidenceNode[];
  edges: EvidenceEdge[];
  consensusScore: number;
  metadata: {
    totalEvidence: number;
    licensedPublisherCount: number;
    redditMentionCount: number;
    directoryCount: number;
    averageAuthority: number;
  };
}

// Engines
type EngineKey = 'PERPLEXITY' | 'AIO' | 'BRAVE' | 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'COPILOT';

// Metrics
interface MetricsOverview {
  promptSOV: number;
  coverage: number;
  citationVelocity: number;
  aioImpressions: number;
  timeseries: Array<{ date: string; sov: number }>;
}
```

---

## Real-Time Features

### SSE Integration

#### Setup
```typescript
// Connect to SSE stream
const eventSource = new EventSource(
  `${API_BASE_URL}/v1/events/stream?workspaceId=${workspaceId}&userId=${userId}`
);

// Listen for events
eventSource.addEventListener('maturity.completed', (event) => {
  const data = JSON.parse(event.data);
  // Update maturity score UI
  refreshMaturityScore();
});

eventSource.addEventListener('geo.recommendations.updated', (event) => {
  // Refresh recommendations list
  refreshRecommendations();
});

eventSource.addEventListener('scan.progress', (event) => {
  const data = JSON.parse(event.data);
  // Update progress bar
  updateProgressBar(data.progress);
});
```

#### Event Types to Handle

| Event Type | When Fired | UI Action |
|------------|------------|-----------|
| `connected` | SSE connection established | Show connection indicator |
| `maturity.recomputing` | Maturity recompute job started | Show loading state |
| `maturity.completed` | Maturity recompute completed | Refresh maturity score, show success toast |
| `geo.recommendations.updated` | Recommendations refreshed | Refresh recommendations list |
| `scan.progress` | Prompt scan in progress | Update progress bar |
| `copilot.action` | Copilot action executed | Show notification, refresh relevant data |
| `sync.status` | Directory sync status changed | Update sync status badge |
| `heartbeat` | Every 30 seconds | Update last activity timestamp |

---

## Planned Features (Roadmap)

### Week 1-2: E-E-A-T Scoring Dashboard

**New Page**: `/geo/eeat`

**Components Needed**:
- E-E-A-T score gauges (4 dimensions)
- E-E-A-T breakdown charts
- Recommendations per dimension
- Comparison to industry benchmarks

**API Endpoint**: `GET /v1/geo/eeat`
```typescript
interface EEATScore {
  experience: number;        // 0-100
  expertise: number;         // 0-100
  authoritativeness: number; // 0-100
  trustworthiness: number;  // 0-100
  overall: number;          // Weighted average
  recommendations: Recommendation[];
}
```

**UI Components**:
- E-E-A-T gauge component (reuse ScoreGauge)
- Radar chart component for E-E-A-T breakdown
- Recommendation cards per dimension

---

### Week 3: Fact-Level Consensus Tracking

**New Page**: `/geo/consensus`

**Components Needed**:
- Fact type selector (dropdown)
- Consensus score display per fact type
- Source agreement matrix table
- Contradiction alerts

**API Endpoint**: `GET /v1/geo/consensus?factType=address`
```typescript
interface FactConsensusScore {
  factType: string;
  consensusScore: number;      // 0-100
  independentSources: number;
  agreements: number;
  contradictions: number;
  confidence: 'high' | 'medium' | 'low';
  sources: Array<{
    source: string;
    factValue: string;
    agrees: boolean;
  }>;
}
```

**UI Components**:
- Fact type selector dropdown
- Consensus bar chart
- Source agreement matrix table

---

### Week 4-6: GEO Gap Analysis Dashboard

**New Page**: `/geo/gaps`

**Components Needed**:
- 4-dimension gap visualization (current vs target)
- Prioritized recommendations list
- Progress tracking charts
- Action buttons for recommendations

**APIs**: Uses existing `/v1/geo/maturity` and `/v1/recommendations`

**UI Components**:
- Gap visualization component (current bar vs target bar)
- Progress tracking chart component
- Priority matrix (impact vs effort)

---

### Week 7-8: Prompt-Space Coverage Visualization

**New Page**: `/prompts/coverage`

**Components Needed**:
- Intent distribution heatmap
- "Cold spots" identification
- Coverage trends chart
- Recommendations for missing intents

**API Endpoint**: `GET /v1/geo/coverage`
```typescript
interface PromptCoverageReport {
  intentDistribution: {
    BEST: number;
    ALTERNATIVES: number;
    PRICING: number;
    VS: number;
    HOWTO: number;
  };
  gaps: string[]; // Intents with no coverage
  recommendations: Recommendation[];
  trends: Array<{ date: string; intent: string; count: number }>;
}
```

**UI Components**:
- Heatmap component (for intent distribution)
- Bar chart (for coverage by intent)
- Line chart (for trends)

---

### Week 9: Cross-Engine Visibility Comparison

**New Page**: `/geo/engines/comparison`

**Components Needed**:
- Visibility score breakdown by engine
- Engine-specific recommendations
- Trend charts per engine
- Engine performance ranking

**API Endpoint**: `GET /v1/geo/engines/comparison`
```typescript
interface EngineComparison {
  engines: Array<{
    engineKey: EngineKey;
    visibilityScore: number;
    breakdown: {
      mentionScore: number;
      rankingScore: number;
      citationScore: number;
    };
    recommendations: Recommendation[];
  }>;
  trends: Array<{
    date: string;
    engine: EngineKey;
    score: number;
  }>;
}
```

**UI Components**:
- Grouped bar chart (scores per engine)
- Line chart (trends per engine)
- Engine ranking table

---

### Week 10: Structural Scoring Details

**New Page**: `/geo/structural`

**Components Needed**:
- Schema score breakdown
- Freshness analysis (stale pages list)
- Page structure assessment
- Recommendations per page

**APIs**: Uses `/v1/geo/maturity` (structuralClarity dimension)

**UI Components**:
- Schema checklist component
- Stale pages list component
- Page structure score breakdown

---

## UI/UX Guidelines

### Design System

#### Color Palette
- **Primary**: Blue (#3B82F6)
- **Success**: Green (#10B981)
- **Warning**: Yellow (#F59E0B)
- **Danger**: Red (#EF4444)
- **Maturity Levels**:
  - Beginner: Red (#EF4444)
  - Intermediate: Yellow (#F59E0B)
  - Advanced: Blue (#3B82F6)
  - Expert: Green (#10B981)

#### Typography
- **Heading 1**: 2rem, bold
- **Heading 2**: 1.5rem, semibold
- **Body**: 1rem, regular
- **Small**: 0.875rem, regular

#### Spacing
- Use consistent spacing scale: 4px, 8px, 16px, 24px, 32px, 48px

#### Components Style
- **Cards**: White background, subtle shadow, rounded corners (8px)
- **Buttons**: Primary (blue), Secondary (gray), Danger (red)
- **Badges**: Small, rounded, color-coded by status
- **Progress Bars**: Animated fill, percentage display
- **Tables**: Striped rows, hover effects, sortable headers

### Responsive Design
- **Mobile**: Single column, stacked components
- **Tablet**: 2-column layout where appropriate
- **Desktop**: Full multi-column layout

### Accessibility
- ARIA labels for all interactive elements
- Keyboard navigation support
- Color contrast ratios meet WCAG AA standards
- Screen reader friendly

### Loading States
- Skeleton loaders for data-heavy pages
- Progress indicators for async operations
- Toast notifications for success/error states

### Error Handling
- User-friendly error messages
- Retry buttons for failed API calls
- Fallback UI for missing data

---

## Implementation Notes for Lovable

### Key Technologies Recommended
- **Framework**: React (with TypeScript)
- **State Management**: React Query / SWR for server state, Zustand for client state
- **Styling**: Tailwind CSS (or styled-components)
- **Charts**: Recharts or Chart.js
- **Graph Visualization**: D3.js or Cytoscape.js
- **Forms**: React Hook Form
- **HTTP Client**: Axios or Fetch API
- **SSE Client**: Native EventSource API (or event-source-polyfill for IE)

### API Integration Pattern
```typescript
// Example: API client setup
const apiClient = axios.create({
  baseURL: process.env.API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json'
  }
});

// Example: React Query hook
const useMaturityScore = (workspaceId: string) => {
  return useQuery({
    queryKey: ['maturity', workspaceId],
    queryFn: () => apiClient.get(`/v1/geo/maturity?workspaceId=${workspaceId}`)
      .then(res => res.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

### SSE Integration Pattern
```typescript
// Example: SSE hook
const useSSEEvents = (workspaceId: string, userId: string) => {
  useEffect(() => {
    const eventSource = new EventSource(
      `${API_BASE_URL}/v1/events/stream?workspaceId=${workspaceId}&userId=${userId}`
    );

    eventSource.addEventListener('maturity.completed', (event) => {
      queryClient.invalidateQueries(['maturity']);
    });

    return () => eventSource.close();
  }, [workspaceId, userId]);
};
```

### Form Handling Pattern
```typescript
// Example: Form with React Hook Form
const RecommendationActionForm = ({ recommendation }: { recommendation: Recommendation }) => {
  const { register, handleSubmit } = useForm();
  
  const onSubmit = async (data: any) => {
    await apiClient.post(`/v1/copilot/actions`, {
      actionType: recommendation.action,
      targetUrl: recommendation.targetUrl,
      ...data
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
};
```

---

## Final Checklist for Lovable

### Must-Have Pages
- [ ] Dashboard Overview (`/dashboard`)
- [ ] GEO Maturity (`/geo/maturity`)
- [ ] Evidence Graph (`/geo/evidence`)
- [ ] Recommendations (`/geo/recommendations`)
- [ ] Citation Opportunities (`/citations/opportunities`)
- [ ] Directory Presence (`/directories/presence`)
- [ ] Prompt Discovery (`/prompts/discovery`)
- [ ] Content Generation (`/content/generate`)
- [ ] Content Library (`/content/library`)
- [ ] Metrics & Analytics (`/analytics/metrics`)
- [ ] Hallucination Alerts (`/alerts/hallucinations`)
- [ ] Copilot Automation (`/automation/copilot`)
- [ ] Pre-Signup Analysis (`/automation/pre-signup`)
- [ ] Progress Tracking (`/progress/tracking`)
- [ ] Workspace Export (`/export/data`)
- [ ] GDPR Deletion (`/export/gdpr`)
- [ ] LLM Settings (`/settings/llm`)
- [ ] Workspace Settings (`/settings/workspace`)
- [ ] Team Management (`/settings/members`)
- [ ] API Key Management (`/settings/api-keys`)
- [ ] White-Label Config (`/enterprise/whitelabel`) - Enterprise only
- [ ] API Marketplace (`/enterprise/marketplace`) - Enterprise only
- [ ] Webhooks Management (`/webhooks/manage`)
- [ ] Third-Party Connections (`/connections/integrations`)
- [ ] Engine Configuration (`/engines/configure`)
- [ ] Prompts Management (`/prompts/manage`)
- [ ] Workspace Invitations (`/invitations/manage`)

### Must-Have Components
- [ ] Score Gauge (circular progress)
- [ ] Recommendation Card
- [ ] Evidence Graph (interactive visualization)
- [ ] Opportunity Table
- [ ] Directory Grid
- [ ] Progress Tracker (with SSE)
- [ ] SSE Connection Manager
- [ ] Engine Selector
- [ ] Time Range Selector
- [ ] Maturity Badge
- [ ] Content Generation Form
- [ ] Content Editor (markdown)
- [ ] Content Preview (markdown renderer)
- [ ] Template Selector
- [ ] Export Button (PDF/DOCX)
- [ ] Content Library Grid/List
- [ ] Hallucination Alert Card
- [ ] Hallucination Detection Form
- [ ] Copilot Rule Editor
- [ ] Action Queue Component
- [ ] Pre-Signup Form
- [ ] Progress Tracker Component
- [ ] Export History Table
- [ ] GDPR Deletion Form
- [ ] LLM Provider Selector
- [ ] Cost Estimator
- [ ] White-Label Config Form
- [ ] Webhook Configuration Form
- [ ] Connection Card Component
- [ ] Engine Configuration Panel
- [ ] Prompts Table Component
- [ ] Invitation Management Table

### Must-Have Features
- [ ] SSE real-time updates
- [ ] Async job progress tracking
- [ ] Filter and sort functionality
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Error handling and retry
- [ ] Loading states and skeletons
- [ ] Toast notifications

### Planned Features (Add to Roadmap)
- [ ] E-E-A-T Scoring Dashboard (Week 1-2)
- [ ] Fact-Level Consensus Tracking (Week 3)
- [ ] GEO Gap Analysis Dashboard (Week 4-6)
- [ ] Prompt-Space Coverage Visualization (Week 7-8)
- [ ] Cross-Engine Visibility Comparison (Week 9)
- [ ] Structural Scoring Details (Week 10)

---

---

## 📊 Complete Feature Summary

### Total Feature Count
- **✅ Current Features**: 27 fully documented
- **🚧 Planned Features**: 6 (weeks 1-10)
- **📄 Total Pages**: 30+ pages
- **🔌 API Endpoints**: 100+ endpoints
- **🧩 UI Components**: 30+ reusable components

### Feature Categories

#### Core GEO Features (8)
1. GEO Maturity Dashboard
2. Evidence Graph Visualization
3. Prescriptive Recommendations
4. Visibility Score Details
5. Engine-Aware Scoring
6. Structural Scoring
7. Citation Classification
8. Directory Presence Analysis

#### Content & Optimization (3)
9. Content Generation (Blog, FAQ, Landing, Social)
10. Prompt Discovery & Clustering
11. Metrics & Analytics

#### Automation & Intelligence (3)
12. Copilot Automation & Rules
13. Pre-Signup Analysis
14. Hallucination Detection & Alerts

#### Administration & Enterprise (5)
15. Workspace Settings
16. Team Management
17. LLM Settings & Configuration
18. Progress Tracking
19. Workspace Export & GDPR

#### Enterprise Features (3)
20. White-Label Configuration
21. API Marketplace
22. API Key Management

#### Integration & Configuration (5)
23. Webhooks Management
24. Third-Party Connections (GBP, Yelp, Facebook, etc.)
25. Engine Configuration & Budgets
26. Prompts Management
27. Workspace Invitations

### API Endpoint Count by Category

| Category | Endpoints |
|----------|-----------|
| GEO Optimization | 8 |
| Evidence & Maturity | 3 |
| Recommendations | 2 |
| Citation Opportunities | 11 |
| Prompt Discovery | 4 |
| Directory | 4 |
| Content Generation | 6 |
| Metrics | 2 |
| Hallucination Detection | 10 |
| Automation & Copilot | 6 |
| Enterprise | 9 |
| Settings | 6 |
| Progress Tracking | 6 |
| Export & GDPR | 5 |
| Webhooks | 7 |
| Connections | 6 |
| Engine Config | 5 |
| Prompts Management | 6 |
| Invitations | 5 |
| **TOTAL** | **100+** |

---

**Document Version**: 1.2  
**Last Updated**: 2025-01-27  
**Total Features Documented**: 27 Current + 6 Planned  
**Completeness**: ✅ Exhaustive - All features from schema, controllers, and services documented  
**Maintained By**: Development Team

### Features Status

#### ✅ Fully Implemented (27)
All features with controllers, services, and database models

#### 🟡 Schema Ready / Placeholder Controllers (3)
- **Scheduled Reports**: Schema exists, controller placeholder (may need implementation)
- **Industry Benchmarks**: Schema exists, no controller yet (analytics feature)
- **Assistant Conversations**: Schema exists, no controller yet (chat/assistant feature)
- **Action Feedback**: Schema exists, no controller yet (effectiveness tracking)

*Note: These are documented in schema but may require full implementation before frontend integration.*


// Core enums matching Prisma schema
export enum EngineKey {
  PERPLEXITY = 'PERPLEXITY',
  AIO = 'AIO',
  BRAVE = 'BRAVE',
}

export enum Intent {
  BEST = 'BEST',
  ALTERNATIVES = 'ALTERNATIVES',
  PRICING = 'PRICING',
  VS = 'VS',
  HOWTO = 'HOWTO',
}

export enum Sentiment {
  POS = 'POS',
  NEU = 'NEU',
  NEG = 'NEG',
}

export enum CopilotActionType {
  ADD_FAQ = 'ADD_FAQ',
  ADD_TLDR = 'ADD_TLDR',
  ADD_CITATIONS = 'ADD_CITATIONS',
  FIX_SCHEMA = 'FIX_SCHEMA',
  REVIEW_CAMPAIGN = 'REVIEW_CAMPAIGN',
}

export enum CopilotActionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXECUTED = 'EXECUTED',
}

export enum AlertType {
  SOV_DROP = 'SOV_DROP',
  ENGINE_LOSS = 'ENGINE_LOSS',
  COMPETITOR_OVERTAKE = 'COMPETITOR_OVERTAKE',
  HALLUCINATION = 'HALLUCINATION',
}

export enum ConnectionType {
  GBP = 'GBP',
  YELP = 'YELP',
  FB = 'FB',
  APPLE = 'APPLE',
  WEBFLOW = 'WEBFLOW',
  WP = 'WP',
  NOTION = 'NOTION',
  HUBSPOT = 'HUBSPOT',
  PIPEDRIVE = 'PIPEDRIVE',
}

export enum RunStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

// Core types
export interface User {
  id: string;
  email: string;
  externalId?: string;
  createdAt: Date;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: Date;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  createdAt: Date;
}

export interface Connection {
  id: string;
  workspaceId: string;
  type: ConnectionType;
  status: string;
  config?: Record<string, any>;
  lastSyncAt?: Date;
  createdAt: Date;
}

export interface Engine {
  id: string;
  workspaceId: string;
  key: EngineKey;
  enabled: boolean;
  config?: Record<string, any>;
  dailyBudgetCents: number;
  concurrency: number;
  region?: string;
  lastRunAt?: Date;
  avgLatencyMs?: number;
  createdAt: Date;
}

export interface Prompt {
  id: string;
  workspaceId: string;
  text: string;
  canonicalText?: string;
  intent: Intent;
  vertical?: string;
  active: boolean;
  tags: string[];
  createdAt: Date;
}

export interface PromptRun {
  id: string;
  workspaceId: string;
  promptId: string;
  engineId: string;
  model?: string;
  startedAt: Date;
  finishedAt?: Date;
  status: RunStatus;
  costCents: number;
  idempotencyKey: string;
  errorMsg?: string;
}

export interface Answer {
  id: string;
  promptRunId: string;
  rawText: string;
  jsonPayload?: Record<string, any>;
  createdAt: Date;
}

export interface Mention {
  id: string;
  answerId: string;
  brand: string;
  position?: number;
  sentiment: Sentiment;
  snippet: string;
}

export interface Citation {
  id: string;
  answerId: string;
  url: string;
  domain: string;
  rank?: number;
  confidence?: number;
}

export interface MetricDaily {
  id: string;
  workspaceId: string;
  engineKey: EngineKey;
  date: Date;
  promptSOV: number;
  coverage: number;
  citationCount: number;
  aioImpressions: number;
}

export interface CopilotRule {
  id: string;
  workspaceId: string;
  fullAuto: boolean;
  requireApproval: boolean;
  maxPagesPerWeek: number;
  enabledActions: string[];
  intensity: number;
  config?: Record<string, any>;
}

export interface CopilotAction {
  id: string;
  workspaceId: string;
  actionType: CopilotActionType;
  targetUrl: string;
  diff: string;
  status: CopilotActionStatus;
  createdAt: Date;
  approverId?: string;
  approvedAt?: Date;
  actionHash?: string;
}

export interface Alert {
  id: string;
  workspaceId: string;
  type: AlertType;
  payload: Record<string, any>;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface AuditLog {
  id: string;
  workspaceId: string;
  actorUserId?: string;
  action: string;
  payload?: Record<string, any>;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    total?: number;
  };
}

// Provider types
export interface EngineAnswer {
  engine: EngineKey;
  promptId: string;
  answerText: string;
  mentions: {
    brand: string;
    position?: number;
    sentiment?: Sentiment;
    snippet: string;
  }[];
  citations: {
    url: string;
    domain: string;
    confidence?: number;
  }[];
  meta?: Record<string, any>;
  timestamp: string;
  costCents?: number;
}

export interface EngineProvider {
  ask(prompt: string, opts?: Record<string, any>): Promise<EngineAnswer>;
}

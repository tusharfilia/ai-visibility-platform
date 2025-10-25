/**
 * Zod validation schemas for all API endpoints
 * Provides type-safe request/response validation
 */

import { z } from 'zod';
import { 
  EngineKey, 
  Intent, 
  Sentiment, 
  CopilotActionType, 
  CopilotActionStatus, 
  AlertType, 
  ConnectionType, 
  RunStatus 
} from './types';

// Common field validators
export const urlSchema = z.string().url('Invalid URL format');
export const domainSchema = z.string().min(1).max(255).regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Invalid domain format');
export const cuidSchema = z.string().cuid('Invalid ID format');
export const emailSchema = z.string().email('Invalid email format');
export const dateRangeSchema = z.object({
  from: z.string().datetime('Invalid from date'),
  to: z.string().datetime('Invalid to date'),
});

// Pagination schemas
export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
});

// API Request schemas
export const createPromptSchema = z.object({
  text: z.string().min(1).max(1000, 'Prompt text too long'),
  canonicalText: z.string().optional(),
  intent: z.nativeEnum(Intent),
  vertical: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const updatePromptSchema = createPromptSchema.partial();

export const createEngineSchema = z.object({
  key: z.nativeEnum(EngineKey),
  enabled: z.boolean().default(true),
  config: z.record(z.any()).optional(),
  dailyBudgetCents: z.number().int().min(0).default(0),
  concurrency: z.number().int().min(1).max(10).default(2),
  region: z.string().optional(),
});

export const updateEngineSchema = createEngineSchema.partial();

export const testEngineSchema = z.object({
  engineId: z.string().cuid(),
  testPrompt: z.string().min(1).max(500),
});

export const createCopilotRuleSchema = z.object({
  fullAuto: z.boolean().default(true),
  requireApproval: z.boolean().default(false),
  maxPagesPerWeek: z.number().int().min(0).max(100).default(5),
  enabledActions: z.array(z.nativeEnum(CopilotActionType)).default([]),
  intensity: z.number().int().min(1).max(3).default(2),
  config: z.record(z.any()).optional(),
});

export const updateCopilotRuleSchema = createCopilotRuleSchema.partial();

export const createConnectionSchema = z.object({
  type: z.nativeEnum(ConnectionType),
  config: z.record(z.any()).optional(),
});

export const approveActionSchema = z.object({
  approverId: z.string().cuid(),
  notes: z.string().optional(),
});

export const rejectActionSchema = z.object({
  reason: z.string().min(1).max(500),
  approverId: z.string().cuid(),
});

// Query parameter schemas
export const instantSummaryQuerySchema = z.object({
  domain: z.string().min(1).max(255),
});

export const metricsOverviewQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const citationsQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  domain: z.string().optional(),
  engines: z.array(z.nativeEnum(EngineKey)).optional(),
});

export const promptsQuerySchema = paginationSchema.extend({
  intent: z.nativeEnum(Intent).optional(),
  active: z.boolean().optional(),
  search: z.string().optional(),
});

export const enginesQuerySchema = paginationSchema.extend({
  enabled: z.boolean().optional(),
  key: z.nativeEnum(EngineKey).optional(),
});

export const copilotActionsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(CopilotActionStatus).optional(),
  actionType: z.nativeEnum(CopilotActionType).optional(),
});

export const connectionsQuerySchema = paginationSchema.extend({
  type: z.nativeEnum(ConnectionType).optional(),
  status: z.string().optional(),
});

export const alertsQuerySchema = paginationSchema.extend({
  type: z.nativeEnum(AlertType).optional(),
  resolved: z.boolean().optional(),
});

// API Response schemas
export const instantSummaryResponseSchema = z.object({
  summary: z.string(),
  detectedPrompts: z.array(z.string()),
  engines: z.array(z.object({
    key: z.nativeEnum(EngineKey),
    visible: z.boolean(),
  })),
  geoScore: z.number().min(0).max(100),
  insights: z.array(z.string()),
});

export const metricsOverviewResponseSchema = z.object({
  promptSOV: z.number().min(0).max(100),
  coverage: z.number().min(0).max(100),
  citationVelocity: z.number().min(0),
  aioImpressions: z.number().int().min(0),
  timeseries: z.array(z.object({
    date: z.string(),
    sov: z.number().min(0).max(100),
  })),
});

export const citationDomainSchema = z.object({
  domain: z.string(),
  appearances: z.number().int().min(0),
  engines: z.array(z.nativeEnum(EngineKey)),
  lastSeen: z.string().datetime(),
  competitorOnly: z.boolean(),
});

export const promptResponseSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  text: z.string(),
  canonicalText: z.string().nullable(),
  intent: z.nativeEnum(Intent),
  vertical: z.string().nullable(),
  active: z.boolean(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
});

export const engineResponseSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  key: z.nativeEnum(EngineKey),
  enabled: z.boolean(),
  config: z.record(z.any()).nullable(),
  dailyBudgetCents: z.number().int().min(0),
  concurrency: z.number().int().min(1).max(10),
  region: z.string().nullable(),
  lastRunAt: z.string().datetime().nullable(),
  avgLatencyMs: z.number().int().nullable(),
  createdAt: z.string().datetime(),
});

export const copilotRuleResponseSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  fullAuto: z.boolean(),
  requireApproval: z.boolean(),
  maxPagesPerWeek: z.number().int().min(0).max(100),
  enabledActions: z.array(z.nativeEnum(CopilotActionType)),
  intensity: z.number().int().min(1).max(3),
  config: z.record(z.any()).nullable(),
});

export const copilotActionResponseSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  actionType: z.nativeEnum(CopilotActionType),
  targetUrl: z.string().url(),
  diff: z.string(),
  status: z.nativeEnum(CopilotActionStatus),
  createdAt: z.string().datetime(),
  approverId: z.string().cuid().nullable(),
  approvedAt: z.string().datetime().nullable(),
  actionHash: z.string().nullable(),
});

export const connectionResponseSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  type: z.nativeEnum(ConnectionType),
  status: z.string(),
  config: z.record(z.any()).nullable(),
  lastSyncAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const alertResponseSchema = z.object({
  id: z.string().cuid(),
  workspaceId: z.string().cuid(),
  type: z.nativeEnum(AlertType),
  payload: z.record(z.any()),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
});

export const reportResponseSchema = z.object({
  url: z.string().url(),
});

// Type inference helpers
export type CreatePromptRequest = z.infer<typeof createPromptSchema>;
export type UpdatePromptRequest = z.infer<typeof updatePromptSchema>;
export type CreateEngineRequest = z.infer<typeof createEngineSchema>;
export type UpdateEngineRequest = z.infer<typeof updateEngineSchema>;
export type TestEngineRequest = z.infer<typeof testEngineSchema>;
export type CreateCopilotRuleRequest = z.infer<typeof createCopilotRuleSchema>;
export type UpdateCopilotRuleRequest = z.infer<typeof updateCopilotRuleSchema>;
export type CreateConnectionRequest = z.infer<typeof createConnectionSchema>;
export type ApproveActionRequest = z.infer<typeof approveActionSchema>;
export type RejectActionRequest = z.infer<typeof rejectActionSchema>;

export type InstantSummaryQuery = z.infer<typeof instantSummaryQuerySchema>;
export type MetricsOverviewQuery = z.infer<typeof metricsOverviewQuerySchema>;
export type CitationsQuery = z.infer<typeof citationsQuerySchema>;
export type PromptsQuery = z.infer<typeof promptsQuerySchema>;
export type EnginesQuery = z.infer<typeof enginesQuerySchema>;
export type CopilotActionsQuery = z.infer<typeof copilotActionsQuerySchema>;
export type ConnectionsQuery = z.infer<typeof connectionsQuerySchema>;
export type AlertsQuery = z.infer<typeof alertsQuerySchema>;

export type InstantSummaryResponse = z.infer<typeof instantSummaryResponseSchema>;
export type MetricsOverviewResponse = z.infer<typeof metricsOverviewResponseSchema>;
export type CitationDomain = z.infer<typeof citationDomainSchema>;
export type PromptResponse = z.infer<typeof promptResponseSchema>;
export type EngineResponse = z.infer<typeof engineResponseSchema>;
export type CopilotRuleResponse = z.infer<typeof copilotRuleResponseSchema>;
export type CopilotActionResponse = z.infer<typeof copilotActionResponseSchema>;
export type ConnectionResponse = z.infer<typeof connectionResponseSchema>;
export type AlertResponse = z.infer<typeof alertResponseSchema>;
export type ReportResponse = z.infer<typeof reportResponseSchema>;

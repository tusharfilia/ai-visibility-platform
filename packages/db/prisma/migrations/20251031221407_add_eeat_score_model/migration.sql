-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('GBP', 'YELP', 'FB', 'APPLE', 'WEBFLOW', 'WP', 'NOTION', 'HUBSPOT', 'PIPEDRIVE');

-- CreateEnum
CREATE TYPE "EngineKey" AS ENUM ('PERPLEXITY', 'AIO', 'BRAVE', 'OPENAI', 'ANTHROPIC', 'GEMINI', 'COPILOT');

-- CreateEnum
CREATE TYPE "Intent" AS ENUM ('BEST', 'ALTERNATIVES', 'PRICING', 'VS', 'HOWTO');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POS', 'NEU', 'NEG');

-- CreateEnum
CREATE TYPE "CopilotActionType" AS ENUM ('ADD_FAQ', 'ADD_TLDR', 'ADD_CITATIONS', 'FIX_SCHEMA', 'REVIEW_CAMPAIGN');

-- CreateEnum
CREATE TYPE "CopilotActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('SOV_DROP', 'ENGINE_LOSS', 'COMPETITOR_OVERTAKE', 'HALLUCINATION');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "invitedBy" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_invitations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "invitedBy" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "ConnectionType" NOT NULL,
    "status" TEXT NOT NULL,
    "config" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engines" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" "EngineKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "dailyBudgetCents" INTEGER NOT NULL DEFAULT 0,
    "concurrency" INTEGER NOT NULL DEFAULT 2,
    "region" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "avgLatencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "canonicalText" TEXT,
    "intent" "Intent" NOT NULL,
    "vertical" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_runs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "engineId" TEXT NOT NULL,
    "model" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "RunStatus" NOT NULL,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "errorMsg" TEXT,

    CONSTRAINT "prompt_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "promptRunId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "jsonPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentions" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "position" INTEGER,
    "sentiment" "Sentiment" NOT NULL,
    "snippet" TEXT NOT NULL,

    CONSTRAINT "mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citations" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "rank" INTEGER,
    "confidence" DOUBLE PRECISION,
    "sourceType" TEXT,
    "isLicensed" BOOLEAN NOT NULL DEFAULT false,
    "publisherName" TEXT,
    "directoryType" TEXT,
    "redditThread" TEXT,
    "authorityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freshness" TIMESTAMP(3),

    CONSTRAINT "citations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_daily" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "engineKey" "EngineKey" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "promptSOV" DOUBLE PRECISION NOT NULL,
    "coverage" DOUBLE PRECISION NOT NULL,
    "citationCount" INTEGER NOT NULL,
    "aioImpressions" INTEGER NOT NULL,

    CONSTRAINT "metric_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_rules" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fullAuto" BOOLEAN NOT NULL DEFAULT true,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false,
    "maxPagesPerWeek" INTEGER NOT NULL DEFAULT 5,
    "enabledActions" TEXT[],
    "intensity" INTEGER NOT NULL DEFAULT 2,
    "config" JSONB,

    CONSTRAINT "copilot_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_actions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actionType" "CopilotActionType" NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "diff" TEXT NOT NULL,
    "status" "CopilotActionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "actionHash" TEXT,

    CONSTRAINT "copilot_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "payload" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_ledger" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "costCents" INTEGER NOT NULL,
    "operation" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_daily_costs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_daily_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_clusters" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompts" TEXT[],
    "centroid" DOUBLE PRECISION[],
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_clusters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embedding_cache" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embedding_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "citation_opportunities" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "domainAuthority" DOUBLE PRECISION NOT NULL,
    "citationCount" INTEGER NOT NULL,
    "impactScore" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'identified',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "citation_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hallucination_alerts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "engineKey" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "factType" TEXT NOT NULL,
    "aiStatement" TEXT NOT NULL,
    "correctFact" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hallucination_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_profiles" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "hours" JSONB,
    "services" TEXT[],
    "description" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_settings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "defaultLlmProvider" TEXT NOT NULL DEFAULT 'openai',
    "llmModel" TEXT NOT NULL DEFAULT 'gpt-4',
    "autoApprovalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directory_submissions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "directory" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directory_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correction_submissions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "hallucinationId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedAt" TIMESTAMP(3),
    "responseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correction_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "white_label_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "customDomain" TEXT,
    "emailFromName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "white_label_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttempt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "recipients" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSent" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_benchmarks" (
    "id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "avgVisibilityScore" DOUBLE PRECISION NOT NULL,
    "medianVisibilityScore" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "industry_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_conversations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "messages" JSONB[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_feedback" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "scoreBefore" DOUBLE PRECISION NOT NULL,
    "scoreAfter" DOUBLE PRECISION,
    "scoreChange" DOUBLE PRECISION,
    "effective" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_evidence" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceDomain" TEXT NOT NULL,
    "citationUrl" TEXT,
    "evidenceText" TEXT NOT NULL,
    "authorityScore" DOUBLE PRECISION NOT NULL,
    "freshness" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_maturity_scores" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityStrength" DOUBLE PRECISION NOT NULL,
    "citationDepth" DOUBLE PRECISION NOT NULL,
    "structuralClarity" DOUBLE PRECISION NOT NULL,
    "updateCadence" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "maturityLevel" TEXT NOT NULL,
    "recommendations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geo_maturity_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eeat_scores" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "experience" DOUBLE PRECISION NOT NULL,
    "expertise" DOUBLE PRECISION NOT NULL,
    "authoritativeness" DOUBLE PRECISION NOT NULL,
    "trustworthiness" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "level" TEXT NOT NULL,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eeat_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "workspace_members_workspaceId_userId_idx" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_token_key" ON "workspace_invitations"("token");

-- CreateIndex
CREATE INDEX "workspace_invitations_workspaceId_email_idx" ON "workspace_invitations"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "connections_workspaceId_type_idx" ON "connections"("workspaceId", "type");

-- CreateIndex
CREATE INDEX "engines_workspaceId_key_idx" ON "engines"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "prompts_workspaceId_active_intent_idx" ON "prompts"("workspaceId", "active", "intent");

-- CreateIndex
CREATE INDEX "prompt_runs_workspaceId_promptId_engineId_startedAt_idx" ON "prompt_runs"("workspaceId", "promptId", "engineId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_runs_idempotencyKey_key" ON "prompt_runs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "citations_domain_idx" ON "citations"("domain");

-- CreateIndex
CREATE INDEX "citations_sourceType_idx" ON "citations"("sourceType");

-- CreateIndex
CREATE INDEX "metric_daily_workspaceId_date_idx" ON "metric_daily"("workspaceId", "date");

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_createdAt_idx" ON "audit_logs"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_resourceType_resourceId_idx" ON "audit_logs"("workspaceId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "cost_ledger_workspaceId_createdAt_idx" ON "cost_ledger"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "cost_ledger_workspaceId_provider_idx" ON "cost_ledger"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "workspace_daily_costs_workspaceId_date_idx" ON "workspace_daily_costs"("workspaceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_daily_costs_workspaceId_date_provider_operation_key" ON "workspace_daily_costs"("workspaceId", "date", "provider", "operation");

-- CreateIndex
CREATE INDEX "prompt_clusters_workspaceId_idx" ON "prompt_clusters"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "embedding_cache_text_key" ON "embedding_cache"("text");

-- CreateIndex
CREATE INDEX "citation_opportunities_workspaceId_impactScore_idx" ON "citation_opportunities"("workspaceId", "impactScore");

-- CreateIndex
CREATE INDEX "hallucination_alerts_workspaceId_severity_status_idx" ON "hallucination_alerts"("workspaceId", "severity", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_profiles_workspaceId_key" ON "workspace_profiles"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_settings_workspaceId_key" ON "workspace_settings"("workspaceId");

-- CreateIndex
CREATE INDEX "directory_submissions_workspaceId_directory_status_idx" ON "directory_submissions"("workspaceId", "directory", "status");

-- CreateIndex
CREATE INDEX "correction_submissions_workspaceId_platform_status_idx" ON "correction_submissions"("workspaceId", "platform", "status");

-- CreateIndex
CREATE UNIQUE INDEX "white_label_configs_workspaceId_key" ON "white_label_configs"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "api_keys_workspaceId_key_idx" ON "api_keys"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "webhooks_workspaceId_enabled_idx" ON "webhooks"("workspaceId", "enabled");

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhookId_status_idx" ON "webhook_deliveries"("webhookId", "status");

-- CreateIndex
CREATE INDEX "scheduled_reports_workspaceId_enabled_idx" ON "scheduled_reports"("workspaceId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "industry_benchmarks_industry_date_key" ON "industry_benchmarks"("industry", "date");

-- CreateIndex
CREATE INDEX "assistant_conversations_workspaceId_updatedAt_idx" ON "assistant_conversations"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "action_feedback_workspaceId_actionType_effective_idx" ON "action_feedback"("workspaceId", "actionType", "effective");

-- CreateIndex
CREATE INDEX "entity_evidence_workspaceId_sourceType_idx" ON "entity_evidence"("workspaceId", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "geo_maturity_scores_workspaceId_key" ON "geo_maturity_scores"("workspaceId");

-- CreateIndex
CREATE INDEX "geo_maturity_scores_workspaceId_overallScore_idx" ON "geo_maturity_scores"("workspaceId", "overallScore");

-- CreateIndex
CREATE UNIQUE INDEX "eeat_scores_workspaceId_key" ON "eeat_scores"("workspaceId");

-- CreateIndex
CREATE INDEX "eeat_scores_workspaceId_overallScore_idx" ON "eeat_scores"("workspaceId", "overallScore");

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

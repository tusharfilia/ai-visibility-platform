import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { URL } from 'url';
import { LLMRouterService } from '@ai-visibility/shared';
import { EntityExtractorService, CompetitorDetectorService, DiagnosticInsightsService } from '@ai-visibility/geo';
import { IntentClustererService } from '@ai-visibility/prompts';
import { PrismaService } from '../database/prisma.service';
import { DemoCompetitorsRequestDto, DemoPromptsRequestDto, DemoRunRequestDto, DemoSummaryRequestDto } from './dto/demo.dto';

type DemoRunRecord = {
  id: string;
  workspaceId: string | null;
  domain: string | null;
  brand: string | null;
  summary: string | null;
  competitors: string[] | null;
  analysisJobsTotal: number | null;
  analysisJobsCompleted: number | null;
  analysisJobsFailed: number | null;
  status: string;
  progress: number;
  updatedAt: Date;
};

type DemoEntityInfo = {
  key: string;
  label: string;
  domain?: string | null;
};

type DemoRunMetrics = {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  successRate: number;
  failRate: number;
  totalCostCents: number;
  avgCostCents: number;
};

type DemoShareOfVoiceRow = {
  entityKey: string;
  entity: string;
  mentions: number;
  positiveMentions: number;
  neutralMentions: number;
  negativeMentions: number;
  sharePercentage: number;
};

type DemoEnginePerformanceRow = {
  engine: string;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  totalCostCents: number;
};

type DemoCitationStat = {
  domain: string;
  references: number;
  sharePercentage: number;
};

type DemoRecommendationItem = {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'visibility' | 'sentiment' | 'citations' | 'execution' | 'coverage';
  relatedMetric?: string;
  actionItems: string[];
};

type DemoAnalysisData = {
  demoRun: DemoRunRecord;
  brand: DemoEntityInfo;
  brandDomain?: string | null;
  competitors: DemoEntityInfo[];
  metrics: DemoRunMetrics;
  shareOfVoice: DemoShareOfVoiceRow[];
  enginePerformance: DemoEnginePerformanceRow[];
  citations: DemoCitationStat[];
  generatedAt: Date;
};

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  private readonly statusOrder: Record<string, number> = {
    pending: 0,
    summary_ready: 1,
    prompts_ready: 2,
    competitors_ready: 3,
    analysis_running: 4,
    analysis_complete: 5,
    analysis_failed: 5,
  };

  private readonly engineEnvRequirements: Record<string, string[]> = {
    PERPLEXITY: ['PERPLEXITY_API_KEY'],
    BRAVE: ['BRAVE_API_KEY'],
    AIO: ['AIO_ENABLED'],
    OPENAI: ['OPENAI_API_KEY'],
    ANTHROPIC: ['ANTHROPIC_API_KEY'],
    GEMINI: ['GOOGLE_AI_API_KEY'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmRouter: LLMRouterService,
    private readonly entityExtractor: EntityExtractorService,
    private readonly competitorDetector: CompetitorDetectorService,
    private readonly intentClusterer: IntentClustererService,
    private readonly diagnosticInsights: DiagnosticInsightsService,
    @InjectQueue('runPrompt') private readonly runPromptQueue: Queue,
  ) {}

  private readonly defaultEngines = ['PERPLEXITY', 'BRAVE', 'AIO'];

  async prepareSummary(payload: DemoSummaryRequestDto): Promise<{ ok: boolean; data: any }> {
    const normalized = this.normalizeDomain(payload.domain);
    const brand = (payload.brand ?? this.deriveBrandFromHost(normalized.host)).trim();
    const workspaceId = this.generateWorkspaceId(normalized.host);

    await this.ensureWorkspace(workspaceId, brand);

    const summaryResult = await this.generateSummary(workspaceId, normalized.href, brand, payload.summaryOverride);
    await this.upsertWorkspaceProfile(workspaceId, brand, summaryResult.summary);

    const demoRun = await this.createDemoRun({
      workspaceId,
      domain: normalized.href,
      brand,
      summary: summaryResult.summary,
      status: 'summary_ready',
      progress: 10,
    });

    return {
      ok: true,
      data: {
        demoRunId: demoRun.id,
        workspaceId,
        domain: normalized.href,
        brand,
        summary: summaryResult.summary,
        summarySource: summaryResult.source,
        entityData: summaryResult.entityData, // Include comprehensive entity data
      },
    };
  }

  async preparePrompts(payload: DemoPromptsRequestDto): Promise<{ ok: boolean; data: any }> {
    const demoRun = await this.loadDemoRun(payload.demoRunId);

    if (!demoRun.workspaceId) {
      throw new BadRequestException('Demo run is missing workspace context. Re-run the summary step.');
    }

    this.ensureStatusAtLeast(demoRun, 'summary_ready', 'Complete the summary step before generating prompts.');

    const seedPrompts = this.normalizePromptList(payload.seedPrompts, 'seed');
    if (seedPrompts.length === 0) {
      throw new BadRequestException('Provide at least one seed prompt.');
    }

    let finalPrompts: Array<{ text: string; source: 'seed' | 'llm' | 'user' }> = [];

    const confirmed = this.normalizePromptList(payload.confirmedPrompts ?? [], 'user');
    if (confirmed.length > 0) {
      finalPrompts = this.mergePromptSources(confirmed);
    } else {
      const generated = await this.generatePromptSuggestions(
        demoRun.workspaceId,
        demoRun.brand ?? 'Brand',
        demoRun.summary ?? '',
        seedPrompts.map(p => p.text),
        demoRun.domain
      );
      finalPrompts = this.mergePromptSources([...seedPrompts, ...generated]);
    }

    if (finalPrompts.length === 0) {
      throw new BadRequestException('Unable to determine prompts. Try providing confirmedPrompts.');
    }

    await this.replaceWorkspacePrompts(demoRun.workspaceId, finalPrompts);
    await this.updateDemoRun(demoRun.id, {
      status: 'prompts_ready',
      progress: Math.max(40, demoRun.progress ?? 0),
    });

    return {
      ok: true,
      data: {
        demoRunId: demoRun.id,
        workspaceId: demoRun.workspaceId,
        prompts: finalPrompts,
        total: finalPrompts.length,
      },
    };
  }

  async prepareCompetitors(payload: DemoCompetitorsRequestDto): Promise<{ ok: boolean; data: any }> {
    const demoRun = await this.loadDemoRun(payload.demoRunId);

    if (!demoRun.workspaceId) {
      throw new BadRequestException('Demo run is missing workspace context. Re-run the summary step.');
    }

    this.ensureStatusAtLeast(demoRun, 'prompts_ready', 'Complete the prompt step before selecting competitors.');

    const promptRecords = await this.getDemoPrompts(demoRun.workspaceId);
    if (promptRecords.length === 0) {
      throw new BadRequestException('Prompts are not ready. Complete the prompt step first.');
    }

    const promptTexts = promptRecords.map((record) => record.text);

    const confirmed = this.normalizeDomainList(payload.competitorDomains ?? []);
    let finalCompetitors: string[] = confirmed;
    let suggestedCompetitors: string[] = [];

    if (finalCompetitors.length === 0) {
      suggestedCompetitors = await this.generateCompetitorSuggestions(
        demoRun.workspaceId,
        demoRun.brand ?? 'Brand',
        demoRun.summary ?? '',
        promptTexts,
        demoRun.domain,
      );
      finalCompetitors = suggestedCompetitors;
    } else {
      suggestedCompetitors = finalCompetitors;
    }

    if (finalCompetitors.length === 0) {
      throw new BadRequestException('Unable to determine competitor list. Provide competitorDomains.');
    }

    await this.updateDemoRun(demoRun.id, {
      status: 'competitors_ready',
      progress: Math.max(60, demoRun.progress ?? 0),
      competitors: finalCompetitors,
    });

    return {
      ok: true,
      data: {
        demoRunId: demoRun.id,
        workspaceId: demoRun.workspaceId,
        finalCompetitors,
        suggestedCompetitors,
      },
    };
  }

  async runDemo(payload: DemoRunRequestDto): Promise<{ ok: boolean; data: any }> {
    const demoRun = await this.loadDemoRun(payload.demoRunId);

    if (!demoRun.workspaceId) {
      throw new BadRequestException('Demo run is missing workspace context. Re-run the summary step.');
    }

    this.ensureStatusAtLeast(demoRun, 'competitors_ready', 'Complete the competitor step before running the analysis.');

    const promptRecords = await this.getDemoPrompts(demoRun.workspaceId);
    if (promptRecords.length === 0) {
      throw new BadRequestException('Prompts are not ready. Complete the prompt step first.');
    }

    const engines = this.normalizeEngines(payload.engines);
    this.validateDemoConfiguration(engines);
    await this.ensureEngines(demoRun.workspaceId, engines);

    const jobs = promptRecords.flatMap((prompt) =>
      engines.map((engine) => {
        const idempotencyKey = `${demoRun.workspaceId}:${prompt.id}:${engine}`;
        return {
          name: 'runPrompt',
          data: {
            workspaceId: demoRun.workspaceId!,
            promptId: prompt.id,
            engineKey: engine,
            idempotencyKey,
            demoRunId: demoRun.id,
            userId: 'demo-user',
          },
          opts: {
            removeOnComplete: { count: 200 },
            removeOnFail: { count: 50 },
          },
        };
      })
    );

    if (jobs.length === 0) {
      throw new BadRequestException('No analysis jobs were created. Check prompts and engines.');
    }

    await this.runPromptQueue.addBulk(jobs);

    await this.updateDemoRun(demoRun.id, {
      status: 'analysis_running',
      progress: Math.max(80, demoRun.progress ?? 0),
      analysisJobsTotal: jobs.length,
      analysisJobsCompleted: 0,
      analysisJobsFailed: 0,
    });

    return {
      ok: true,
      data: {
        demoRunId: demoRun.id,
        workspaceId: demoRun.workspaceId,
        engines,
        queuedJobs: jobs.length,
      },
    };
  }

  async getStatus(demoRunId: string): Promise<{ ok: boolean; data: any }> {
    const demoRun = await this.loadDemoRun(demoRunId);

    const total = demoRun.analysisJobsTotal ?? 0;
    const completed = demoRun.analysisJobsCompleted ?? 0;
    const failed = demoRun.analysisJobsFailed ?? 0;
    const finished = completed + failed;
    const remaining = total > finished ? total - finished : 0;

    const progress = this.computeProgress(demoRun.progress, total, finished);

    // Get engine visibility - which engines have successful runs with mentions
    let engines: Array<{ key: string; visible: boolean }> = [];
    if (demoRun.workspaceId && completed > 0) {
      try {
        const engineRows = await this.prisma.$queryRaw<{ engineKey: string }>(
          `SELECT DISTINCT e."key" AS "engineKey"
           FROM "prompt_runs" pr
           JOIN "prompts" p ON p.id = pr."promptId"
           JOIN "engines" e ON e.id = pr."engineId"
           JOIN "answers" a ON a."promptRunId" = pr.id
           JOIN "mentions" m ON m."answerId" = a.id
           WHERE pr."workspaceId" = $1
             AND pr."status" = 'SUCCESS'
             AND 'demo' = ANY(p."tags")
           GROUP BY e."key"`,
          [demoRun.workspaceId],
        );

        const enginesWithMentions = new Set(engineRows.map((r) => r.engineKey));
        engines = this.defaultEngines.map((engineKey) => ({
          key: engineKey,
          visible: enginesWithMentions.has(engineKey),
        }));
      } catch (error) {
        this.logger.warn(`Failed to get engine visibility for demoRun ${demoRunId}: ${error instanceof Error ? error.message : String(error)}`);
        // Fallback to all false if query fails
        engines = this.defaultEngines.map((engineKey) => ({
          key: engineKey,
          visible: false,
        }));
      }
    } else {
      // No completed jobs yet, all engines are not visible
      engines = this.defaultEngines.map((engineKey) => ({
        key: engineKey,
        visible: false,
      }));
    }

    return {
      ok: true,
      data: {
        demoRunId: demoRun.id,
        workspaceId: demoRun.workspaceId,
        status: demoRun.status,
        progress,
        totalJobs: total,
        completedJobs: completed,
        failedJobs: failed,
        remainingJobs: remaining,
        engines, // Include engine visibility
        updatedAt: demoRun.updatedAt.toISOString(),
      },
    };
  }

  async getInsights(demoRunId: string): Promise<{ ok: boolean; data: any }> {
    const demoRun = await this.loadDemoRun(demoRunId);

    if (!demoRun.workspaceId) {
      throw new BadRequestException('Demo run is missing workspace context. Re-run the summary step.');
    }

    this.ensureStatusAtLeast(
      demoRun,
      'analysis_complete',
      `Insights are only available after analysis completes (current status: ${demoRun.status}).`,
    );

    const analysis = await this.collectAnalysisData(demoRun);
    const insightHighlights = await this.buildInsightHighlights(
      analysis,
      demoRun.workspaceId!,
      analysis.brand.label,
      demoRun.domain,
      analysis.competitors.map(c => c.label)
    );

    return {
      ok: true,
      data: {
        demoRunId: analysis.demoRun.id,
        workspaceId: analysis.demoRun.workspaceId,
        status: analysis.demoRun.status,
        progress: analysis.demoRun.progress,
        totals: analysis.metrics,
        shareOfVoice: analysis.shareOfVoice.map(({ entity, mentions, positiveMentions, neutralMentions, negativeMentions, sharePercentage }) => ({
          entity,
          mentions,
          positiveMentions,
          neutralMentions,
          negativeMentions,
          sharePercentage,
        })),
        enginePerformance: analysis.enginePerformance.map(({ engine, totalRuns, successfulRuns, failedRuns, successRate, totalCostCents }) => ({
          engine,
          totalRuns,
          successfulRuns,
          failedRuns,
          successRate,
          totalCostCents,
        })),
        topCitations: analysis.citations,
        insightHighlights,
        generatedAt: analysis.generatedAt.toISOString(),
      },
    };
  }

  async getRecommendations(demoRunId: string): Promise<{ ok: boolean; data: any }> {
    const demoRun = await this.loadDemoRun(demoRunId);

    if (!demoRun.workspaceId) {
      throw new BadRequestException('Demo run is missing workspace context. Re-run the summary step.');
    }

    this.ensureStatusAtLeast(
      demoRun,
      'analysis_complete',
      `Recommendations are only available after analysis completes (current status: ${demoRun.status}).`,
    );

    const analysis = await this.collectAnalysisData(demoRun);
    const recommendations = await this.generateRecommendations(
      analysis,
      demoRun.workspaceId!,
      analysis.brand.label,
      demoRun.domain,
      analysis.competitors.map(c => c.label)
    );

    return {
      ok: true,
      data: {
        demoRunId: analysis.demoRun.id,
        workspaceId: analysis.demoRun.workspaceId,
        status: analysis.demoRun.status,
        progress: analysis.demoRun.progress,
        recommendations,
        shareOfVoice: analysis.shareOfVoice.map(({ entity, mentions, positiveMentions, neutralMentions, negativeMentions, sharePercentage }) => ({
          entity,
          mentions,
          positiveMentions,
          neutralMentions,
          negativeMentions,
          sharePercentage,
        })),
        enginePerformance: analysis.enginePerformance.map(({ engine, totalRuns, successfulRuns, failedRuns, successRate, totalCostCents }) => ({
          engine,
          totalRuns,
          successfulRuns,
          failedRuns,
          successRate,
          totalCostCents,
        })),
        generatedAt: analysis.generatedAt.toISOString(),
      },
    };
  }

  private async collectAnalysisData(demoRun: DemoRunRecord): Promise<DemoAnalysisData> {
    if (!demoRun.workspaceId) {
      throw new BadRequestException('Demo run is missing workspace context. Re-run the summary step.');
    }

    const workspaceId = demoRun.workspaceId;
    const normalizedDomain = demoRun.domain ? this.normalizeDomain(demoRun.domain) : { href: '', host: '' };
    const brandDomain = normalizedDomain.host || null;
    const brandLabelCandidate = (demoRun.brand ?? (brandDomain ? this.deriveBrandFromHost(brandDomain) : '')).trim();
    const brandLabel = brandLabelCandidate || 'Demo Brand';
    const brand: DemoEntityInfo = {
      key: this.normalizeEntityKey(brandLabel),
      label: brandLabel,
      domain: brandDomain,
    };

    const competitors: DemoEntityInfo[] = (demoRun.competitors ?? []).map((competitor) => {
      const normalized = this.normalizeDomain(competitor);
      const derivedLabel = this.deriveBrandFromHost(normalized.host);
      const label = this.formatEntityLabel(derivedLabel || normalized.host || competitor || 'Competitor');
      return {
        key: this.normalizeEntityKey(label),
        label,
        domain: normalized.host || competitor || null,
      };
    });

    const [runMetricsRow] = await this.prisma.$queryRaw<{
      totalRuns: number;
      completedRuns: number;
      failedRuns: number;
      totalCostCents: number;
    }>(
      `SELECT
         COUNT(*)::int AS "totalRuns",
         SUM(CASE WHEN pr."status" = 'SUCCESS' THEN 1 ELSE 0 END)::int AS "completedRuns",
         SUM(CASE WHEN pr."status" = 'FAILED' THEN 1 ELSE 0 END)::int AS "failedRuns",
         COALESCE(SUM(pr."costCents"), 0)::int AS "totalCostCents"
       FROM "prompt_runs" pr
       JOIN "prompts" p ON p.id = pr."promptId"
       WHERE pr."workspaceId" = $1
         AND 'demo' = ANY(p."tags")`,
      [workspaceId],
    );

    const totalRuns = Number(runMetricsRow?.totalRuns ?? 0);
    const completedRuns = Number(runMetricsRow?.completedRuns ?? 0);
    const failedRuns = Number(runMetricsRow?.failedRuns ?? 0);
    const totalCostCents = Number(runMetricsRow?.totalCostCents ?? 0);
    const successRate = totalRuns > 0 ? this.toPercentage(completedRuns / totalRuns) : 0;
    const failRate = totalRuns > 0 ? this.toPercentage(failedRuns / totalRuns) : 0;
    const avgCostCents = totalRuns > 0 ? Math.round(totalCostCents / totalRuns) : 0;

    const metrics: DemoRunMetrics = {
      totalRuns,
      completedRuns,
      failedRuns,
      successRate,
      failRate,
      totalCostCents,
      avgCostCents,
    };

    const mentionRows = await this.prisma.$queryRaw<{
      entityKey: string | null;
      entityLabel: string | null;
      mentions: number;
      positiveMentions: number;
      neutralMentions: number;
      negativeMentions: number;
    }>(
      `SELECT
         LOWER(m."brand") AS "entityKey",
         MIN(m."brand") AS "entityLabel",
         COUNT(*)::int AS "mentions",
         SUM(CASE WHEN m."sentiment" = 'POS' THEN 1 ELSE 0 END)::int AS "positiveMentions",
         SUM(CASE WHEN m."sentiment" = 'NEU' THEN 1 ELSE 0 END)::int AS "neutralMentions",
         SUM(CASE WHEN m."sentiment" = 'NEG' THEN 1 ELSE 0 END)::int AS "negativeMentions"
       FROM "mentions" m
       JOIN "answers" a ON a.id = m."answerId"
       JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
       JOIN "prompts" p ON p.id = pr."promptId"
       WHERE pr."workspaceId" = $1
         AND 'demo' = ANY(p."tags")
       GROUP BY LOWER(m."brand")
       ORDER BY COUNT(*) DESC`,
      [workspaceId],
    );

    const mentionStatsMap = new Map<string, DemoShareOfVoiceRow>();

    for (const row of mentionRows) {
      const rawKey = row.entityKey || row.entityLabel || 'Other';
      const key = this.normalizeEntityKey(rawKey);
      const isOther = !row.entityKey && !row.entityLabel;
      const label = isOther ? 'Other' : this.formatEntityLabel(row.entityLabel || rawKey);

      const mentions = Number(row.mentions ?? 0);
      const positiveMentions = Number(row.positiveMentions ?? 0);
      const neutralMentions = Number(row.neutralMentions ?? 0);
      const negativeMentions = Number(row.negativeMentions ?? 0);

      const existing = mentionStatsMap.get(key);
      if (existing) {
        existing.mentions += mentions;
        existing.positiveMentions += positiveMentions;
        existing.neutralMentions += neutralMentions;
        existing.negativeMentions += negativeMentions;
      } else {
        mentionStatsMap.set(key, {
          entityKey: key,
          entity: label,
          mentions,
          positiveMentions,
          neutralMentions,
          negativeMentions,
          sharePercentage: 0,
        });
      }
    }

    const ensureEntityRow = (info: DemoEntityInfo) => {
      if (!info.key) return;
      if (!mentionStatsMap.has(info.key)) {
        mentionStatsMap.set(info.key, {
          entityKey: info.key,
          entity: info.label,
          mentions: 0,
          positiveMentions: 0,
          neutralMentions: 0,
          negativeMentions: 0,
          sharePercentage: 0,
        });
      }
    };

    ensureEntityRow(brand);
    competitors.forEach(ensureEntityRow);

    const shareOfVoiceArray = Array.from(mentionStatsMap.values()).sort((a, b) => b.mentions - a.mentions);
    const totalMentions = shareOfVoiceArray.reduce((sum, row) => sum + row.mentions, 0);
    const shareOfVoice: DemoShareOfVoiceRow[] = shareOfVoiceArray.map((row) => ({
      ...row,
      sharePercentage: totalMentions > 0 ? this.toPercentage(row.mentions / totalMentions) : 0,
    }));

    const citationRows = await this.prisma.$queryRaw<{
      domain: string | null;
      references: number;
    }>(
      `SELECT
         LOWER(c."domain") AS "domain",
         COUNT(*)::int AS "references"
       FROM "citations" c
       JOIN "answers" a ON a.id = c."answerId"
       JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
       JOIN "prompts" p ON p.id = pr."promptId"
       WHERE pr."workspaceId" = $1
         AND 'demo' = ANY(p."tags")
       GROUP BY LOWER(c."domain")
       ORDER BY COUNT(*) DESC
       LIMIT 10`,
      [workspaceId],
    );

    const totalCitations = citationRows.reduce((sum, row) => sum + Number(row.references ?? 0), 0);
    const citations: DemoCitationStat[] = citationRows
      .filter((row) => (row.domain || '').trim().length > 0)
      .map((row) => {
        const domain = (row.domain || '').trim();
        const references = Number(row.references ?? 0);
        return {
          domain,
          references,
          sharePercentage: totalCitations > 0 ? this.toPercentage(references / totalCitations) : 0,
        };
      });

    const engineRows = await this.prisma.$queryRaw<{
      engine: string | null;
      totalRuns: number;
      successfulRuns: number;
      totalCostCents: number;
    }>(
      `SELECT
         e."key" AS "engine",
         COUNT(*)::int AS "totalRuns",
         SUM(CASE WHEN pr."status" = 'SUCCESS' THEN 1 ELSE 0 END)::int AS "successfulRuns",
         COALESCE(SUM(pr."costCents"), 0)::int AS "totalCostCents"
       FROM "prompt_runs" pr
       JOIN "prompts" p ON p.id = pr."promptId"
       JOIN "engines" e ON e.id = pr."engineId"
       WHERE pr."workspaceId" = $1
         AND 'demo' = ANY(p."tags")
       GROUP BY e."key"
       ORDER BY e."key"`,
      [workspaceId],
    );

    const enginePerformance: DemoEnginePerformanceRow[] = engineRows.map((row) => {
      const engineKey = (row.engine || 'UNKNOWN').toUpperCase();
      const engineTotalRuns = Number(row.totalRuns ?? 0);
      const successfulRuns = Number(row.successfulRuns ?? 0);
      const failedRunsComputed = Math.max(0, engineTotalRuns - successfulRuns);
      const totalEngineCost = Number(row.totalCostCents ?? 0);

      return {
        engine: engineKey,
        totalRuns: engineTotalRuns,
        successfulRuns,
        failedRuns: failedRunsComputed,
        successRate: engineTotalRuns > 0 ? this.toPercentage(successfulRuns / engineTotalRuns) : 0,
        totalCostCents: totalEngineCost,
      };
    });

    return {
      demoRun,
      brand,
      brandDomain,
      competitors,
      metrics,
      shareOfVoice,
      enginePerformance,
      citations,
      generatedAt: new Date(),
    };
  }

  private async buildInsightHighlights(
    analysis: DemoAnalysisData,
    workspaceId: string,
    brandName: string,
    domain?: string | null,
    competitors: string[] = []
  ): Promise<string[]> {
    const highlights: string[] = [];

    try {
      // Use DiagnosticInsightsService for comprehensive, evidence-backed insights
      const diagnosticResult = await this.diagnosticInsights.generateInsights(
        workspaceId,
        brandName,
        domain || undefined,
        competitors
      );

      // Extract top insights from diagnostic service
      const topInsights = diagnosticResult.topIssues.slice(0, 5);
      for (const insight of topInsights) {
        // Format insight as a highlight
        let highlight = insight.title;
        if (insight.description) {
          highlight += `: ${insight.description}`;
        }
        highlights.push(highlight);
      }

      // If we have fewer than 5 insights, supplement with basic analysis
      if (highlights.length < 5) {
        const brandRow = analysis.shareOfVoice.find((row) => row.entityKey === analysis.brand.key);
        const competitorRows = analysis.shareOfVoice
          .filter((row) => row.entityKey !== analysis.brand.key)
          .sort((a, b) => b.sharePercentage - a.sharePercentage);

        const topCompetitor = competitorRows[0];

        if (brandRow) {
          if (topCompetitor && topCompetitor.sharePercentage - brandRow.sharePercentage >= 5) {
            highlights.push(
              `${topCompetitor.entity} leads share of voice by ${(topCompetitor.sharePercentage - brandRow.sharePercentage).toFixed(1)} pts over ${analysis.brand.label}.`,
            );
          } else if (brandRow.sharePercentage >= 40) {
            highlights.push(`${analysis.brand.label} leads share of voice at ${brandRow.sharePercentage.toFixed(1)}%.`);
          } else if (brandRow.sharePercentage > 0) {
            highlights.push(`${analysis.brand.label} holds ${brandRow.sharePercentage.toFixed(1)}% share of voice across demo prompts.`);
          }
        }

        if (analysis.citations.length === 0) {
          highlights.push('No citations captured yet—focus on landing authoritative sources in follow-up runs.');
        } else {
          const citationLeader = analysis.citations[0];
          highlights.push(
            `${citationLeader.domain} contributes the most references (${citationLeader.sharePercentage.toFixed(1)}% of citations).`,
          );
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to generate diagnostic insights, using fallback: ${error instanceof Error ? error.message : String(error)}`);
      
      // Fallback to original logic
      const brandRow = analysis.shareOfVoice.find((row) => row.entityKey === analysis.brand.key);
      if (brandRow && brandRow.sharePercentage > 0) {
        highlights.push(`${analysis.brand.label} holds ${brandRow.sharePercentage.toFixed(1)}% share of voice across demo prompts.`);
      }
      if (analysis.citations.length === 0) {
        highlights.push('No citations captured yet—focus on landing authoritative sources in follow-up runs.');
      }
    }

    const unique = Array.from(new Set(highlights));
    return unique.slice(0, 8); // Return top 8 insights
  }

  private async generateRecommendations(
    analysis: DemoAnalysisData,
    workspaceId: string,
    brandName: string,
    domain?: string | null,
    competitors: string[] = []
  ): Promise<DemoRecommendationItem[]> {
    const recommendations: DemoRecommendationItem[] = [];
    const { metrics, demoRun: demoRunRecord } = analysis;
    
    try {
      // Use DiagnosticInsightsService for evidence-based recommendations
      const diagnosticResult = await this.diagnosticInsights.generateInsights(
        workspaceId,
        brandName,
        domain || undefined,
        competitors
      );

      // Convert diagnostic insights to recommendations
      for (const insight of diagnosticResult.insights.slice(0, 10)) {
        const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
          critical: 'high',
          high: 'high',
          medium: 'medium',
          low: 'low',
        };

        const categoryMap: Record<string, 'visibility' | 'sentiment' | 'citations' | 'execution' | 'coverage'> = {
          visibility_blocker: 'visibility',
          trust_gap: 'citations',
          schema_gap: 'visibility',
          listing_inconsistency: 'citations',
          reputation_weakness: 'sentiment',
          content_gap: 'citations',
          competitor_advantage: 'visibility',
          hallucination_risk: 'citations',
          missing_fact: 'visibility',
        };

        recommendations.push({
          title: insight.title,
          description: insight.description,
          priority: priorityMap[insight.severity] || 'medium',
          category: categoryMap[insight.type] || 'visibility',
          relatedMetric: this.getRelatedMetric(insight.type),
          actionItems: insight.recommendations.slice(0, 3),
        });
      }
    } catch (error) {
      this.logger.warn(`Failed to generate diagnostic recommendations, using fallback: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Supplement with basic analysis if needed
    const brandRow = analysis.shareOfVoice.find((row) => row.entityKey === analysis.brand.key);
    const competitorRows = analysis.shareOfVoice
      .filter((row) => row.entityKey !== analysis.brand.key)
      .sort((a, b) => b.sharePercentage - a.sharePercentage);
    const topCompetitor = competitorRows[0];

    if (brandRow && topCompetitor && topCompetitor.sharePercentage - brandRow.sharePercentage >= 5) {
      const diff = topCompetitor.sharePercentage - brandRow.sharePercentage;
      recommendations.push({
        title: `Close visibility gap with ${topCompetitor.entity}`,
        description: `${topCompetitor.entity} outpaces ${analysis.brand.label} by ${diff.toFixed(1)} pts in share of voice across demo prompts.`,
        priority: 'high',
        category: 'visibility',
        relatedMetric: 'shareOfVoice',
        actionItems: [
          `Add prompts comparing ${analysis.brand.label} vs ${topCompetitor.entity} on pricing, trust, and feature depth.`,
          `Highlight recent wins and customer proof points where ${analysis.brand.label} beats ${topCompetitor.entity}.`,
        ],
      });
    } else if (brandRow && brandRow.sharePercentage < 35) {
      recommendations.push({
        title: 'Expand brand visibility footprint',
        description: `${analysis.brand.label} captures only ${brandRow.sharePercentage.toFixed(1)}% of share of voice—boost coverage with broader prompt variety.`,
        priority: 'medium',
        category: 'visibility',
        relatedMetric: 'shareOfVoice',
        actionItems: [
          'Spin up prompts covering new use cases, industries, and comparative angles.',
          'Repurpose high-performing prompts with fresh messaging to capture additional impressions.',
        ],
      });
    }

    if (brandRow && brandRow.mentions > 0) {
      const positiveShare = this.toPercentage(brandRow.positiveMentions / brandRow.mentions);
      if (positiveShare < 35) {
        recommendations.push({
          title: 'Elevate positive sentiment signals',
          description: `${analysis.brand.label} positive sentiment is only ${positiveShare.toFixed(1)}%. Reinforce proof points and address objections surfaced in negative snippets.`,
          priority: 'medium',
          category: 'sentiment',
          relatedMetric: 'sentiment',
          actionItems: [
            'Highlight social proof, awards, and customer outcomes in prompt answers.',
            'Draft objection-handling prompts that tackle common negative narratives head-on.',
          ],
        });
      }
    }

    if (analysis.citations.length === 0) {
      recommendations.push({
        title: 'Land authoritative citations',
        description: 'No authoritative sources were captured during the demo run. Prioritize trusted publications to back your answers.',
        priority: 'high',
        category: 'citations',
        relatedMetric: 'citations',
        actionItems: [
          'Pitch or source content from tier-one publications covering your category.',
          'Incorporate product documentation or analyst reports that can be cited in AI answers.',
        ],
      });
    } else {
      const citationLeader = analysis.citations[0];
      const brandDomainKey = analysis.brandDomain ? this.normalizeDomain(analysis.brandDomain).host : null;
      if (brandDomainKey && citationLeader.domain !== brandDomainKey) {
        recommendations.push({
          title: 'Increase branded citation coverage',
          description: `${citationLeader.domain} currently leads citation volume. Secure more references pointing to ${analysis.brand.label}'s owned assets.`,
          priority: 'medium',
          category: 'citations',
          relatedMetric: 'citations',
          actionItems: [
            'Publish or refresh cornerstone content that AI agents can cite confidently.',
            'Build schema and metadata to improve discoverability of owned resources.',
          ],
        });
      }
    }

    const strugglingEngines = analysis.enginePerformance.filter((engine) => engine.successRate < 70);
    if (strugglingEngines.length > 0) {
      const engineList = strugglingEngines.map((engine) => engine.engine).join(', ');
      recommendations.push({
        title: `Stabilize performance on ${engineList}`,
        description: `Success rates on ${engineList} fall below 70%. Address provider errors or adjust prompts to improve completion.`,
        priority: 'medium',
        category: 'execution',
        relatedMetric: 'enginePerformance',
        actionItems: [
          'Review provider logs for rate limits or auth issues and re-run failed jobs.',
          'Adjust prompt wording to better align with each engine’s strengths.',
        ],
      });
    }

    const totalPlannedJobs = Number(demoRunRecord.analysisJobsTotal ?? metrics.totalRuns);
    const finishedJobs = metrics.completedRuns + metrics.failedRuns;
    if (totalPlannedJobs > finishedJobs) {
      const remaining = totalPlannedJobs - finishedJobs;
      recommendations.push({
        title: 'Resume pending demo jobs',
        description: `${remaining} queued jobs are still outstanding—complete them to unlock full insight coverage.`,
        priority: 'medium',
        category: 'coverage',
        relatedMetric: 'analysisProgress',
        actionItems: [
          'Verify background workers are running and connected to Redis.',
          'Re-run /v1/demo/run after resolving provider limits to finish the workload.',
        ],
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        title: 'Maintain momentum',
        description: 'The demo run is performing well—extend coverage with additional competitor comparisons to keep gaining insights.',
        priority: 'low',
        category: 'visibility',
        relatedMetric: 'shareOfVoice',
        actionItems: [
          'Add prompts covering emerging competitors and adjacent categories.',
          'Schedule periodic re-runs to monitor shifts in citations and sentiment.',
        ],
      });
    }

    // Sort by priority and impact
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    recommendations.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.title.localeCompare(b.title);
    });

    return recommendations.slice(0, 10); // Return top 10 recommendations
  }

  /**
   * Get related metric for insight type
   */
  private getRelatedMetric(insightType: string): string {
    const metricMap: Record<string, string> = {
      visibility_blocker: 'shareOfVoice',
      trust_gap: 'citations',
      schema_gap: 'structuralScore',
      listing_inconsistency: 'citations',
      reputation_weakness: 'sentiment',
      content_gap: 'citations',
      competitor_advantage: 'shareOfVoice',
      hallucination_risk: 'citations',
      missing_fact: 'entityStrength',
    };
    return metricMap[insightType] || 'shareOfVoice';
  }

  private normalizeEntityKey(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  private formatEntityLabel(raw: string | null | undefined): string {
    if (!raw) {
      return 'Unknown';
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return 'Unknown';
    }
    return trimmed
      .split(/\s+/)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private toPercentage(value: number, precision = 2): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }
    const multiplier = 10 ** precision;
    return Math.round(value * 100 * multiplier) / multiplier;
  }

  private ensureStatusAtLeast(demoRun: DemoRunRecord, requiredStatus: string, errorMessage: string): void {
    const currentRank = this.statusOrder[demoRun.status] ?? -1;
    const requiredRank = this.statusOrder[requiredStatus] ?? Number.MAX_SAFE_INTEGER;
    if (currentRank < requiredRank) {
      throw new BadRequestException(errorMessage);
    }
  }

  private validateDemoConfiguration(engines: string[]): void {
    if (process.env.MOCK_PROVIDERS === 'true') {
      throw new BadRequestException('Turn off MOCK_PROVIDERS to run the live demo workflow.');
    }

    const missingCredentials: string[] = [];
    for (const engine of engines) {
      const requirements = this.engineEnvRequirements[engine];
      if (!requirements) continue;

      const missingForEngine = requirements.filter((variable) => {
        const value = process.env[variable];
        if (value === undefined || value === null || value.toString().trim().length === 0) {
          return true;
        }
        return false;
      });

      if (missingForEngine.length > 0) {
        missingCredentials.push(`${engine}: ${missingForEngine.join(', ')}`);
      }
    }

    if (missingCredentials.length > 0) {
      throw new BadRequestException(
        `Missing provider credentials for engines: ${missingCredentials.join('; ')}. Set the required environment variables and retry.`,
      );
    }
  }

  private async loadDemoRun(demoRunId: string): Promise<DemoRunRecord> {
    const rows = await this.prisma.$queryRaw<DemoRunRecord>(
      `SELECT "id", "workspaceId", "domain", "brand", "summary", "competitors",
              "analysisJobsTotal", "analysisJobsCompleted", "analysisJobsFailed",
              "status", "progress", "updatedAt"
       FROM "demo_runs"
       WHERE "id" = $1
       LIMIT 1`,
      [demoRunId]
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Demo run ${demoRunId} not found.`);
    }

    return rows[0];
  }

  private computeProgress(currentProgress: number, totalJobs: number, finishedJobs: number): number {
    const base = currentProgress ?? 0;
    if (totalJobs <= 0) {
      return Math.min(100, Math.max(base, 80));
    }

    const ratio = Math.min(1, Math.max(0, finishedJobs / totalJobs));
    const target = ratio >= 1 ? 100 : Math.max(80, Math.round(80 + ratio * 20));
    return Math.min(100, Math.max(base, target));
  }

  private normalizeDomain(domain: string): { href: string; host: string } {
    try {
      const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
      return { href: url.origin, host: url.hostname.replace(/^www\./, '') };
    } catch (error) {
      this.logger.warn(`Invalid domain supplied (${domain}), using fallback.`);
      const sanitized = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return { href: `https://${sanitized}`, host: sanitized.split('/')[0].replace(/^www\./, '') };
    }
  }

  private deriveBrandFromHost(host: string): string {
    if (!host) return 'Demo Brand';
    const parts = host.split('.');
    const primary = parts[0];
    return primary.charAt(0).toUpperCase() + primary.slice(1);
  }

  private generateWorkspaceId(host: string): string {
    const safeHost = host.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return `demo_${safeHost || randomUUID()}`;
  }

  private async ensureWorkspace(workspaceId: string, name: string): Promise<void> {
    await this.prisma.$executeRaw(
      `INSERT INTO "workspaces" ("id", "name", "tier", "createdAt")
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name"`,
      [workspaceId, name, 'INSIGHTS']
    );
  }

  private async generateSummary(
    workspaceId: string,
    domain: string,
    brand: string,
    override?: string,
  ): Promise<{ summary: string; source: 'user' | 'llm' | 'fallback'; entityData?: any }> {
    if (override && override.trim().length > 0) {
      return { summary: override.trim(), source: 'user' };
    }

    try {
      // Use EntityExtractorService for comprehensive entity-first extraction
      const entityData = await this.entityExtractor.extractEntityFromDomain(workspaceId, domain);
      
      // Use the LLM-optimized summary from entity extraction
      if (entityData.summary && entityData.summary.length > 0) {
        return {
          summary: entityData.summary,
          source: 'llm',
          entityData: {
            businessName: entityData.businessName,
            category: entityData.category,
            vertical: entityData.vertical,
            services: entityData.services,
            geography: entityData.geography,
            pricePositioning: entityData.pricePositioning,
            valueProps: entityData.valueProps,
            credibilityMarkers: entityData.credibilityMarkers,
            structuredSummary: entityData.structuredSummary,
            metadata: entityData.metadata,
          },
        };
      }
    } catch (error) {
      this.logger.warn(`Entity extraction failed, falling back to simple summary: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Fallback to simple LLM generation if entity extraction fails
    const prompt = `Analyze the brand hosted at ${domain}.
Provide a concise 2-3 sentence overview describing what ${brand} does, who it serves, and its value proposition.
Keep the tone factual and neutral.`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt);
      const text = (response.content || response.text || '').trim();
      if (text.length > 0) {
        return { summary: text, source: 'llm' };
      }
    } catch (error) {
      this.logger.warn(`LLM summary generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const fallback = `${brand} operates at ${domain} and provides digital services for its customers.`;
    return { summary: fallback, source: 'fallback' };
  }

  private async upsertWorkspaceProfile(workspaceId: string, brand: string, summary: string): Promise<void> {
    const existing = await this.prisma.$queryRaw<{ id: string }>(
      'SELECT "id" FROM "workspace_profiles" WHERE "workspaceId" = $1 LIMIT 1',
      [workspaceId]
    );

    if (existing.length > 0) {
      await this.prisma.$executeRaw(
        `UPDATE "workspace_profiles"
         SET "businessName" = $1,
             "description" = $2,
             "updatedAt" = NOW()
         WHERE "workspaceId" = $3`,
        [brand, summary, workspaceId]
      );
      return;
    }

    const profileId = `profile_${randomUUID()}`;
    await this.prisma.$executeRaw(
      `INSERT INTO "workspace_profiles"
        ("id", "workspaceId", "businessName", "services", "description", "verified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())`,
      [profileId, workspaceId, brand, [], summary]
    );
  }

  private async createDemoRun(params: {
    workspaceId: string;
    domain: string;
    brand: string;
    summary: string;
    status: string;
    progress: number;
  }): Promise<{ id: string }> {
    const demoRunId = randomUUID();
    const rows = await this.prisma.$queryRaw<{ id: string }>(
      `INSERT INTO "demo_runs"
        ("id", "workspaceId", "domain", "brand", "summary", "competitors",
         "analysisJobsTotal", "analysisJobsCompleted", "analysisJobsFailed",
         "status", "progress", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING "id"`,
      [
        demoRunId,
        params.workspaceId,
        params.domain,
        params.brand,
        params.summary,
        [],
        null,
        0,
        0,
        params.status,
        params.progress,
      ]
    );

    return rows[0];
  }

  private normalizePromptList(
    prompts: string[],
    source: 'seed' | 'llm' | 'user'
  ): Array<{ text: string; source: 'seed' | 'llm' | 'user' }> {
    if (!prompts) return [];
    const seen = new Set<string>();
    const normalized: Array<{ text: string; source: 'seed' | 'llm' | 'user' }> = [];

    for (const prompt of prompts) {
      const trimmed = (prompt || '').replace(/\s+/g, ' ').trim();
      if (trimmed.length === 0) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({ text: trimmed, source });
    }

    return normalized;
  }

  private mergePromptSources(
    prompts: Array<{ text: string; source: 'seed' | 'llm' | 'user' }>
  ): Array<{ text: string; source: 'seed' | 'llm' | 'user' }> {
    const seen = new Set<string>();
    const merged: Array<{ text: string; source: 'seed' | 'llm' | 'user' }> = [];

    for (const prompt of prompts) {
      const key = prompt.text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(prompt);
    }

    return merged;
  }

  private async generatePromptSuggestions(
    workspaceId: string,
    brand: string,
    summary: string,
    seedPrompts: string[],
    domain?: string | null,
  ): Promise<Array<{ text: string; source: 'llm' | 'seed' | 'user' }>> {
    try {
      // Get entity data if available for better context
      let entityData: any = null;
      if (domain) {
        try {
          const profile = await this.prisma.$queryRaw<{ businessName: string; description: string; services: any[] }>(
            'SELECT "businessName", "description", "services" FROM "workspace_profiles" WHERE "workspaceId" = $1 LIMIT 1',
            [workspaceId]
          );
          if (profile.length > 0) {
            try {
              entityData = await this.entityExtractor.extractEntityFromDomain(workspaceId, domain);
            } catch (error) {
              // Continue without entity data
            }
          }
        } catch (error) {
          // Continue without entity data
        }
      }

      // Use IntentClustererService for intent-based prompt generation
      const intentBasedPrompts = await this.intentClusterer.generateIntentBasedPrompts(
        workspaceId,
        {
          brandName: brand,
          category: entityData?.category || 'General Business',
          vertical: entityData?.vertical || 'General',
          summary: summary || entityData?.summary || '',
          services: entityData?.services || [],
          geography: entityData?.geography || undefined,
        },
        ['BEST', 'ALTERNATIVES', 'HOWTO', 'PRICING', 'COMPARISON'] // Target intents
      );

      // Convert to expected format
      const suggestions = intentBasedPrompts.map(p => ({
        text: p.text,
        source: 'llm' as const,
      }));

      // Include seed prompts and merge
      const allPrompts = this.mergePromptSources([
        ...this.normalizePromptList(seedPrompts, 'seed'),
        ...suggestions,
      ]);

      if (allPrompts.length > 0) {
        return allPrompts;
      }
    } catch (error) {
      this.logger.warn(`Intent-based prompt generation failed, falling back to simple generation: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Fallback to simple LLM generation
    const prompt = `You are helping an analyst evaluate ${brand}.
Use the brand summary below and the provided seed prompts to suggest additional high-impact prompts that capture how AI search users or customers might research this brand.

Brand summary:
${summary || 'No summary available.'}

Seed prompts:
${seedPrompts.map((p, idx) => `${idx + 1}. ${p}`).join('\n')}

Return a JSON array of 3 to 6 concise prompts (strings). Each prompt should be unique and focus on comparisons, benefits, challenges, or alternatives related to ${brand}.`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt, {
        temperature: 0.3,
        maxTokens: 256,
      });

      const raw = (response.content || response.text || '').trim();
      const parsed = JSON.parse(raw) as string[];
      const suggestions = this.normalizePromptList(parsed, 'llm');
      if (suggestions.length > 0) {
        return this.mergePromptSources([
          ...this.normalizePromptList(seedPrompts, 'seed'),
          ...suggestions,
        ]);
      }
    } catch (error) {
      this.logger.warn(`Prompt expansion failed, falling back to heuristics: ${error instanceof Error ? error.message : String(error)}`);
    }

    return this.normalizePromptList(this.buildPromptFallbacks(brand, seedPrompts), 'llm');
  }

  private buildPromptFallbacks(brand: string, seedPrompts: string[]): string[] {
    const base = seedPrompts.slice(0, 2);
    const variations = [
      `Why choose ${brand} over other competitors?`,
      `Strengths and weaknesses of ${brand} in 2025`,
      `Customer reviews and sentiment about ${brand}`,
      `How does ${brand} pricing compare to alternatives?`,
      `Top use cases for ${brand}`,
    ];
    return [...base, ...variations];
  }

  private async replaceWorkspacePrompts(
    workspaceId: string,
    prompts: Array<{ text: string; source: 'seed' | 'llm' | 'user' }>,
  ): Promise<void> {
    await this.prisma.$executeRaw(
      `DELETE FROM "prompts"
       WHERE "workspaceId" = $1
         AND $2 = ANY("tags")`,
      [workspaceId, 'demo']
    );

    for (const prompt of prompts) {
      const id = `prompt_${randomUUID()}`;
      await this.prisma.$executeRaw(
        `INSERT INTO "prompts"
          ("id", "workspaceId", "text", "canonicalText", "intent", "vertical", "active", "tags", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, NOW())`,
        [
          id,
          workspaceId,
          prompt.text,
          prompt.text,
          this.inferIntent(prompt.text),
          null,
          ['demo'],
        ]
      );
    }
  }

  private inferIntent(prompt: string): string {
    const text = prompt.toLowerCase();
    if (text.includes('vs ') || text.includes(' versus ') || text.includes('compare')) {
      return 'VS';
    }
    if (text.includes('alternative') || text.includes('instead of')) {
      return 'ALTERNATIVES';
    }
    if (text.includes('price') || text.includes('pricing') || text.includes('cost')) {
      return 'PRICING';
    }
    if (text.includes('how to') || text.startsWith('how do')) {
      return 'HOWTO';
    }
    return 'BEST';
  }

  private async updateDemoRun(
    demoRunId: string,
    update: {
      status?: string;
      progress?: number;
      competitors?: string[];
      analysisJobsTotal?: number | null;
      analysisJobsCompleted?: number;
      analysisJobsFailed?: number;
    },
  ): Promise<void> {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (update.status) {
      fields.push(`"status" = $${idx++}`);
      params.push(update.status);
    }
    if (typeof update.progress === 'number') {
      fields.push(`"progress" = $${idx++}`);
      params.push(update.progress);
    }
    if (update.competitors !== undefined) {
      fields.push(`"competitors" = $${idx++}`);
      params.push(update.competitors);
    }
    if (update.analysisJobsTotal !== undefined) {
      fields.push(`"analysisJobsTotal" = $${idx++}`);
      params.push(update.analysisJobsTotal);
    }
    if (update.analysisJobsCompleted !== undefined) {
      fields.push(`"analysisJobsCompleted" = $${idx++}`);
      params.push(update.analysisJobsCompleted);
    }
    if (update.analysisJobsFailed !== undefined) {
      fields.push(`"analysisJobsFailed" = $${idx++}`);
      params.push(update.analysisJobsFailed);
    }

    if (fields.length === 0) return;

    params.push(demoRunId);

    await this.prisma.$executeRaw(
      `UPDATE "demo_runs"
       SET ${fields.join(', ')}, "updatedAt" = NOW()
       WHERE "id" = $${idx}`,
      params
    );
  }

  private async getDemoPrompts(workspaceId: string): Promise<Array<{ id: string; text: string }>> {
    return this.prisma.$queryRaw(
      `SELECT "id", "text"
       FROM "prompts"
       WHERE "workspaceId" = $1
         AND 'demo' = ANY("tags")
       ORDER BY "createdAt" ASC`,
      [workspaceId]
    );
  }

  private normalizeDomainList(domains: string[]): string[] {
    if (!domains) return [];
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const domain of domains) {
      const cleaned = this.cleanDomain(domain);
      if (!cleaned) continue;
      if (seen.has(cleaned)) continue;
      seen.add(cleaned);
      normalized.push(cleaned);
    }

    return normalized;
  }

  private cleanDomain(domain: string): string | null {
    const trimmed = (domain || '').trim().toLowerCase();
    if (!trimmed) return null;

    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      return url.hostname.replace(/^www\./, '');
    } catch {
      return trimmed.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    }
  }

  private normalizeEngines(engines?: string[]): string[] {
    const allowed = new Set(['PERPLEXITY', 'AIO', 'BRAVE', 'OPENAI', 'ANTHROPIC', 'GEMINI']);
    const normalized = (engines && engines.length > 0 ? engines : this.defaultEngines)
      .map((engine) => (engine || '').toUpperCase().trim())
      .filter((engine) => allowed.has(engine));

    return normalized.length > 0 ? normalized : this.defaultEngines;
  }

  private async ensureEngines(workspaceId: string, engines: string[]): Promise<void> {
    const rows = await this.prisma.$queryRaw<{ key: string }>(
      `SELECT "key" FROM "engines" WHERE "workspaceId" = $1`,
      [workspaceId]
    );
    const existing = new Set(rows.map((row) => row.key));

    for (const engine of engines) {
      if (existing.has(engine)) continue;
      const id = `engine_${randomUUID()}`;
      await this.prisma.$executeRaw(
        `INSERT INTO "engines"
          ("id", "workspaceId", "key", "enabled", "config", "dailyBudgetCents", "concurrency", "createdAt")
         VALUES ($1, $2, $3, true, $4, $5, $6, NOW())`,
        [id, workspaceId, engine, {}, 500, 1]
      );
    }
  }

  private async generateCompetitorSuggestions(
    workspaceId: string,
    brand: string,
    summary: string,
    promptTexts: string[],
    domain?: string | null,
  ): Promise<string[]> {
    try {
      // Get entity data if available (from workspace profile or extract it)
      let entityData: any = null;
      try {
        const profile = await this.prisma.$queryRaw<{ businessName: string; description: string; services: any[] }>(
          'SELECT "businessName", "description", "services" FROM "workspace_profiles" WHERE "workspaceId" = $1 LIMIT 1',
          [workspaceId]
        );
        if (profile.length > 0 && domain) {
          // Try to extract entity data if we have domain
          try {
            entityData = await this.entityExtractor.extractEntityFromDomain(workspaceId, domain);
          } catch (error) {
            this.logger.warn('Entity extraction for competitor detection failed, using summary only');
          }
        }
      } catch (error) {
        // Continue without entity data
      }

      // Get existing mentions and citations from database (if any analysis has run)
      const [existingMentions, citationDomains] = await Promise.all([
        this.getExistingMentions(workspaceId, brand),
        this.getCitationDomains(workspaceId),
      ]);

      // Build competitor detection context
      const context = {
        brandName: brand,
        domain: domain || '',
        category: entityData?.category || 'General Business',
        vertical: entityData?.vertical || 'General',
        geography: entityData?.geography || undefined,
        services: entityData?.services || [],
        pricePositioning: entityData?.pricePositioning || undefined,
        summary: summary || entityData?.summary || '',
        promptTexts: promptTexts || [],
        existingMentions: existingMentions,
        citationDomains: citationDomains,
      };

      // Use CompetitorDetectorService for comprehensive detection
      const detectionResult = await this.competitorDetector.detectCompetitors(workspaceId, context);

      // Combine all competitors and return domains
      const allCompetitors = detectionResult.all;
      const domains = allCompetitors
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 8) // Limit to top 8
        .map(c => c.domain);

      if (domains.length > 0) {
        return this.normalizeDomainList(domains);
      }
    } catch (error) {
      this.logger.warn(`Competitor detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Fallback to simple LLM-based detection
    const prompt = `You are analyzing competitors for ${brand}.
Use the brand summary and prompts below to identify likely competitors.

Brand summary:
${summary || 'No summary provided.'}

Research prompts:
${promptTexts.map((p, idx) => `${idx + 1}. ${p}`).join('\n')}

Return a JSON array of 3 to 6 competitor domains (only the domain, e.g., "paypal.com").`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt, {
        temperature: 0.2,
        maxTokens: 256,
      });

      const raw = (response.content || response.text || '').trim();
      const parsed = JSON.parse(raw) as string[];
      const normalized = this.normalizeDomainList(parsed);
      if (normalized.length > 0) {
        return normalized;
      }
    } catch (error) {
      this.logger.warn(`Competitor suggestion generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const host = domain ? this.normalizeDomain(domain).host : undefined;
    return this.getDefaultCompetitors(brand, host);
  }

  /**
   * Get existing mentions from database for competitor detection
   */
  private async getExistingMentions(
    workspaceId: string,
    brandName: string
  ): Promise<Array<{ brand: string; domain?: string }>> {
    try {
      const mentions = await this.prisma.$queryRaw<{ brand: string }>(
        `SELECT DISTINCT m."brand"
         FROM "mentions" m
         JOIN "answers" a ON a.id = m."answerId"
         JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
         JOIN "prompts" p ON p.id = pr."promptId"
         WHERE pr."workspaceId" = $1
           AND LOWER(m."brand") != LOWER($2)
           AND 'demo' = ANY(p."tags")
         LIMIT 20`,
        [workspaceId, brandName]
      );

      return mentions.map(m => ({ brand: m.brand }));
    } catch (error) {
      this.logger.warn('Failed to get existing mentions:', error);
      return [];
    }
  }

  /**
   * Get citation domains from database
   */
  private async getCitationDomains(workspaceId: string): Promise<string[]> {
    try {
      const citations = await this.prisma.$queryRaw<{ domain: string }>(
        `SELECT DISTINCT c."domain"
         FROM "citations" c
         JOIN "answers" a ON a.id = c."answerId"
         JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
         JOIN "prompts" p ON p.id = pr."promptId"
         WHERE pr."workspaceId" = $1
           AND 'demo' = ANY(p."tags")
         LIMIT 30`,
        [workspaceId]
      );

      return citations.map(c => c.domain).filter(Boolean);
    } catch (error) {
      this.logger.warn('Failed to get citation domains:', error);
      return [];
    }
  }

  private getDefaultCompetitors(brand: string, host?: string): string[] {
    const generic = ['paypal.com', 'adyen.com', 'squareup.com', 'stripe.com', 'checkout.com'];
    const brandWords = (brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const brandHost = (host || '').toLowerCase();
    return generic.filter(comp => comp !== brandHost && !comp.includes(brandWords));
  }

  /**
   * Orchestrates all demo steps automatically for instant summary
   * Returns summary, prompts, competitors, and starts analysis in background
   */
  async getInstantSummary(domain: string): Promise<{ ok: boolean; data: any }> {
    try {
      // Step 1: Generate summary
      const summaryResult = await this.prepareSummary({ domain });
      if (!summaryResult.ok || !summaryResult.data.demoRunId) {
        throw new BadRequestException('Failed to generate summary');
      }

      const demoRunId = summaryResult.data.demoRunId;
      const workspaceId = summaryResult.data.workspaceId;
      const summary = summaryResult.data.summary;
      const brand = summaryResult.data.brand;

      // Step 2: Auto-generate prompts (use brand name as seed)
      const seedPrompts = [`Best ${brand} alternatives`, `Compare ${brand} with competitors`];
      const promptsResult = await this.preparePrompts({
        demoRunId,
        seedPrompts,
      });

      if (!promptsResult.ok) {
        throw new BadRequestException('Failed to generate prompts');
      }

      const prompts = promptsResult.data.prompts.map((p: { text: string }) => p.text);

      // Step 3: Auto-detect competitors
      const competitorsResult = await this.prepareCompetitors({
        demoRunId,
        competitorDomains: undefined, // Auto-detect
      });

      if (!competitorsResult.ok) {
        throw new BadRequestException('Failed to detect competitors');
      }

      const competitors = competitorsResult.data.finalCompetitors || [];

      // Step 4: Start analysis in background
      const runResult = await this.runDemo({
        demoRunId,
        engines: undefined, // Use defaults
      });

      if (!runResult.ok) {
        this.logger.warn(`Analysis queueing failed for demoRunId ${demoRunId}, but returning partial results`);
      }

      // Step 5: Get initial engine visibility status (all false initially, will update as jobs complete)
      const engines = this.defaultEngines.map((engineKey) => ({
        key: engineKey,
        visible: false, // Will be true once jobs complete
      }));

      // Step 6: Get current status
      const statusResult = await this.getStatus(demoRunId);
      const currentStatus = statusResult.data.status;
      const currentProgress = statusResult.data.progress;

      // Step 7: Try to get insights data if analysis is complete or partially complete
      let shareOfVoice: any[] = [];
      let topCitations: any[] = [];
      let enginePerformance: any[] = [];
      let geoScore = 0;
      let insights: string[] = [];
      let citationFrequency: Record<string, number> = {};
      let recommendationFrequency: Record<string, number> = {};

      // If analysis is complete, get full insights
      if (currentStatus === 'analysis_complete') {
        try {
          const insightsResult = await this.getInsights(demoRunId);
          if (insightsResult.ok && insightsResult.data) {
            shareOfVoice = insightsResult.data.shareOfVoice || [];
            topCitations = insightsResult.data.topCitations || [];
            enginePerformance = insightsResult.data.enginePerformance || [];
            insights = insightsResult.data.insightHighlights || [];

            // Calculate citation frequency
            topCitations.forEach(citation => {
              citationFrequency[citation.domain] = citation.references || 0;
            });

            // Calculate GEO score from share of voice
            if (shareOfVoice.length > 0) {
              const mainEntity = shareOfVoice[0];
              if (mainEntity) {
                // GEO score based on mentions, sentiment, and engine coverage
                const mentionScore = Math.min(100, (mainEntity.mentions || 0) * 10);
                const sentimentScore = mainEntity.positiveMentions > 0 
                  ? Math.min(30, (mainEntity.positiveMentions / (mainEntity.mentions || 1)) * 30)
                  : 0;
                const engineCoverageScore = engines.filter(e => e.visible).length * 20;
                geoScore = Math.min(100, Math.round(mentionScore * 0.5 + sentimentScore * 0.2 + engineCoverageScore * 0.3));
              }
            }

            // Calculate recommendation frequency (how often each competitor is mentioned)
            shareOfVoice.forEach(entity => {
              if (entity.entity !== brand) {
                recommendationFrequency[entity.entity] = entity.mentions || 0;
              }
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to get insights for instant summary: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (currentProgress > 0) {
        // Analysis is running - try to get partial data
        try {
          const demoRun = await this.loadDemoRun(demoRunId);
          if (demoRun.workspaceId) {
            // Get partial share of voice from completed jobs
            try {
              const mentionRows = await this.prisma.$queryRaw<{
                entityKey: string;
                entityLabel: string;
                mentions: number;
                positiveMentions: number;
                neutralMentions: number;
                negativeMentions: number;
              }>(
                `SELECT
                   LOWER(m."brand") AS "entityKey",
                   MIN(m."brand") AS "entityLabel",
                   COUNT(*)::int AS "mentions",
                   COUNT(*) FILTER (WHERE m."sentiment" = 'positive')::int AS "positiveMentions",
                   COUNT(*) FILTER (WHERE m."sentiment" = 'neutral')::int AS "neutralMentions",
                   COUNT(*) FILTER (WHERE m."sentiment" = 'negative')::int AS "negativeMentions"
                 FROM "mentions" m
                 JOIN "answers" a ON a.id = m."answerId"
                 JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
                 JOIN "prompts" p ON p.id = pr."promptId"
                 WHERE pr."workspaceId" = $1
                   AND pr."status" = 'SUCCESS'
                   AND 'demo' = ANY(p."tags")
                 GROUP BY LOWER(m."brand")
                 ORDER BY COUNT(*) DESC
                 LIMIT 10`,
                [demoRun.workspaceId],
              );

              const totalMentions = mentionRows.reduce((sum, row) => sum + (row.mentions || 0), 0);
              shareOfVoice = mentionRows.map(row => ({
                entity: row.entityLabel || row.entityKey,
                mentions: row.mentions || 0,
                positiveMentions: row.positiveMentions || 0,
                neutralMentions: row.neutralMentions || 0,
                negativeMentions: row.negativeMentions || 0,
                sharePercentage: totalMentions > 0 ? Math.round((row.mentions / totalMentions) * 100) : 0,
              }));

              // Calculate partial GEO score
              if (shareOfVoice.length > 0) {
                const mainEntity = shareOfVoice[0];
                if (mainEntity) {
                  const mentionScore = Math.min(100, (mainEntity.mentions || 0) * 10);
                  const sentimentScore = mainEntity.positiveMentions > 0 
                    ? Math.min(30, (mainEntity.positiveMentions / (mainEntity.mentions || 1)) * 30)
                    : 0;
                  const engineCoverageScore = engines.filter(e => e.visible).length * 20;
                  geoScore = Math.min(100, Math.round(mentionScore * 0.5 + sentimentScore * 0.2 + engineCoverageScore * 0.3));
                }
              }
            } catch (error) {
              this.logger.warn(`Failed to get partial share of voice: ${error instanceof Error ? error.message : String(error)}`);
            }

            // Get partial citations
            try {
              const citationRows = await this.prisma.$queryRaw<{
                domain: string | null;
                references: number;
              }>(
                `SELECT
                   LOWER(c."domain") AS "domain",
                   COUNT(*)::int AS "references"
                 FROM "citations" c
                 JOIN "answers" a ON a.id = c."answerId"
                 JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
                 JOIN "prompts" p ON p.id = pr."promptId"
                 WHERE pr."workspaceId" = $1
                   AND 'demo' = ANY(p."tags")
                 GROUP BY LOWER(c."domain")
                 ORDER BY COUNT(*) DESC
                 LIMIT 10`,
                [demoRun.workspaceId],
              );

              topCitations = citationRows.map(row => ({
                domain: row.domain || 'Unknown',
                references: row.references || 0,
              }));

              // Calculate citation frequency
              topCitations.forEach(citation => {
                citationFrequency[citation.domain] = citation.references || 0;
              });
            } catch (error) {
              this.logger.warn(`Failed to get partial citations: ${error instanceof Error ? error.message : String(error)}`);
            }

            // Get engine performance
            try {
              const engineRows = await this.prisma.$queryRaw<{
                engine: string;
                totalRuns: number;
                successfulRuns: number;
                failedRuns: number;
              }>(
                `SELECT
                   e."key" AS "engine",
                   COUNT(*)::int AS "totalRuns",
                   COUNT(*) FILTER (WHERE pr."status" = 'SUCCESS')::int AS "successfulRuns",
                   COUNT(*) FILTER (WHERE pr."status" = 'FAILED')::int AS "failedRuns"
                 FROM "prompt_runs" pr
                 JOIN "engines" e ON e.id = pr."engineId"
                 JOIN "prompts" p ON p.id = pr."promptId"
                 WHERE pr."workspaceId" = $1
                   AND 'demo' = ANY(p."tags")
                 GROUP BY e."key"`,
                [demoRun.workspaceId],
              );

              enginePerformance = engineRows.map(row => ({
                engine: row.engine,
                totalRuns: row.totalRuns || 0,
                successfulRuns: row.successfulRuns || 0,
                failedRuns: row.failedRuns || 0,
                successRate: row.totalRuns > 0 ? Math.round((row.successfulRuns / row.totalRuns) * 100) : 0,
                totalCostCents: 0, // Not calculated in partial data
              }));
            } catch (error) {
              this.logger.warn(`Failed to get engine performance: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to get partial insights: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return {
        ok: true,
        data: {
          demoRunId,
          workspaceId,
          domain: summaryResult.data.domain,
          brand,
          summary,
          detectedPrompts: prompts,
          competitors,
          engines,
          geoScore,
          insights,
          status: currentStatus,
          progress: currentProgress,
          totalJobs: statusResult.data.totalJobs,
          completedJobs: statusResult.data.completedJobs,
          // Include detailed analytics
          shareOfVoice,
          topCitations,
          enginePerformance,
          citationFrequency,
          recommendationFrequency,
        },
      };
    } catch (error) {
      this.logger.error(`Instant summary failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(`Failed to generate instant summary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}


import { Injectable, Logger } from '@nestjs/common';
import { LLMRouterService } from '@ai-visibility/shared';
import { IndustryDetectorService } from '../industry/industry-detector.service';
import { EvidenceCollectorService } from '../evidence/evidence-collector.service';
import { PrismaClient } from '@prisma/client';

export interface PremiumCompetitor {
  domain: string;
  brandName: string;
  type: 'direct' | 'content' | 'authority' | 'geo' | 'category';
  confidence: number; // 0-1
  reasoning: string;
  evidence: {
    foundInPrompts: string[];
    foundInEngines: string[];
    citationCount: number;
    mentionFrequency: number;
    coOccurrenceCount: number; // How often mentioned together
  };
  visibility: {
    perEngine: {
      engine: string;
      visible: boolean;
      promptsVisible: number;
      promptsTested: number;
    }[];
    overallVisibility: number; // 0-100
  };
  ranking: {
    averagePosition: number; // When mentioned, average position
    bestPosition: number;
    worstPosition: number;
  };
}

@Injectable()
export class PremiumCompetitorDetectorService {
  private readonly logger = new Logger(PremiumCompetitorDetectorService.name);
  private prisma: PrismaClient;

  constructor(
    private readonly llmRouter: LLMRouterService,
    private readonly industryDetector: IndustryDetectorService,
    private readonly evidenceCollector: EvidenceCollectorService,
  ) {
    this.prisma = new PrismaClient();
  }

  /**
   * Detect competitors using multiple signals with evidence
   */
  async detectPremiumCompetitors(
    workspaceId: string,
    domain: string,
    brandName: string,
    industry?: string
  ): Promise<PremiumCompetitor[]> {
    const competitors = new Map<string, PremiumCompetitor>();

    // 1. Detect industry if not provided
    let detectedIndustry = industry;
    if (!detectedIndustry) {
      try {
        const industryContext = await this.industryDetector.getIndustryContext(workspaceId, domain);
        detectedIndustry = industryContext.industry;
      } catch (error) {
        this.logger.warn(`Industry detection failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 2. LLM-based competitor detection
    const llmCompetitors = await this.detectViaLLM(workspaceId, domain, brandName, detectedIndustry || '');
    for (const comp of llmCompetitors) {
      competitors.set(comp.domain.toLowerCase(), comp);
    }

    // 3. Co-occurrence detection (competitors mentioned together in answers)
    const coOccurrenceCompetitors = await this.detectViaCoOccurrence(workspaceId, brandName);
    for (const comp of coOccurrenceCompetitors) {
      const existing = competitors.get(comp.domain.toLowerCase());
      if (existing) {
        // Merge evidence
        existing.evidence.coOccurrenceCount += comp.evidence.coOccurrenceCount;
        existing.confidence = Math.min(1.0, existing.confidence + 0.1);
      } else {
        competitors.set(comp.domain.toLowerCase(), comp);
      }
    }

    // 4. Citation-based detection (domains frequently cited together)
    const citationCompetitors = await this.detectViaCitations(workspaceId, domain);
    for (const comp of citationCompetitors) {
      const existing = competitors.get(comp.domain.toLowerCase());
      if (existing) {
        existing.evidence.citationCount += comp.evidence.citationCount;
        existing.confidence = Math.min(1.0, existing.confidence + 0.1);
      } else {
        competitors.set(comp.domain.toLowerCase(), comp);
      }
    }

    // 5. Collect visibility evidence for all competitors
    for (const [domainKey, competitor] of competitors.entries()) {
      competitor.visibility = await this.collectVisibilityEvidence(workspaceId, competitor.brandName);
      competitor.ranking = await this.collectRankingEvidence(workspaceId, competitor.brandName);
    }

    // Sort by confidence and evidence strength
    return Array.from(competitors.values())
      .sort((a, b) => {
        const scoreA = a.confidence * 0.5 + (a.visibility.overallVisibility / 100) * 0.5;
        const scoreB = b.confidence * 0.5 + (b.visibility.overallVisibility / 100) * 0.5;
        return scoreB - scoreA;
      })
      .slice(0, 15); // Top 15 competitors
  }

  /**
   * Detect competitors via LLM analysis
   */
  private async detectViaLLM(
    workspaceId: string,
    domain: string,
    brandName: string,
    industry: string
  ): Promise<PremiumCompetitor[]> {
    const competitors: PremiumCompetitor[] = [];

    try {
      const prompt = `You are an expert competitive analyst. Identify competitors for this business.

Business:
- Domain: ${domain}
- Brand: ${brandName}
- Industry: ${industry}

Identify competitors across these categories:
1. Direct competitors (same industry, similar services)
2. Content competitors (compete for same search queries)
3. Authority competitors (compete for industry authority)
4. GEO competitors (compete for local visibility, if applicable)
5. Category competitors (same category, different approach)

For each competitor, provide:
- Domain (e.g., competitor.com)
- Brand name
- Type (direct|content|authority|geo|category)
- Confidence (0.0-1.0)
- Reasoning (why this is a competitor)

Return JSON array:
[
  {
    "domain": "competitor.com",
    "brandName": "Competitor Name",
    "type": "direct",
    "confidence": 0.9,
    "reasoning": "Direct competitor in same industry"
  }
]

Focus on REAL competitors that would appear in AI search results for industry queries.`;

      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt, {
        temperature: 0.3,
        maxTokens: 1000,
      });

      const text = (response.content || response.text || '').trim();
      const cleaned = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned) as Array<{
        domain: string;
        brandName: string;
        type: string;
        confidence: number;
        reasoning: string;
      }>;

      for (const item of parsed) {
        competitors.push({
          domain: item.domain,
          brandName: item.brandName,
          type: item.type as any,
          confidence: item.confidence || 0.7,
          reasoning: item.reasoning,
          evidence: {
            foundInPrompts: [],
            foundInEngines: [],
            citationCount: 0,
            mentionFrequency: 0,
            coOccurrenceCount: 0,
          },
          visibility: {
            perEngine: [],
            overallVisibility: 0,
          },
          ranking: {
            averagePosition: 0,
            bestPosition: 0,
            worstPosition: 0,
          },
        });
      }
    } catch (error) {
      this.logger.warn(`LLM competitor detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return competitors;
  }

  /**
   * Detect competitors via co-occurrence in answers
   */
  private async detectViaCoOccurrence(
    workspaceId: string,
    brandName: string
  ): Promise<PremiumCompetitor[]> {
    const competitors: PremiumCompetitor[] = [];

    try {
      // Find domains that are frequently mentioned in the same answers as the brand
      const coOccurrences = await this.prisma.$queryRaw<{
        competitorBrand: string;
        competitorDomain: string;
        coOccurrenceCount: number;
      }>(
        `SELECT
           m2."brand" AS "competitorBrand",
           MIN(c."domain") AS "competitorDomain",
           COUNT(*)::int AS "coOccurrenceCount"
         FROM "mentions" m1
         JOIN "answers" a ON a.id = m1."answerId"
         JOIN "mentions" m2 ON m2."answerId" = a.id
         JOIN "citations" c ON c."answerId" = a.id
         JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
         JOIN "prompts" p ON p.id = pr."promptId"
         WHERE pr."workspaceId" = $1
           AND LOWER(m1."brand") = LOWER($2)
           AND LOWER(m2."brand") != LOWER($2)
           AND pr."status" = 'SUCCESS'
           AND 'demo' = ANY(p."tags")
         GROUP BY m2."brand"
         HAVING COUNT(*) >= 2
         ORDER BY COUNT(*) DESC
         LIMIT 20`,
        [workspaceId, brandName]
      );

      for (const co of coOccurrences) {
        competitors.push({
          domain: co.competitorDomain || co.competitorBrand,
          brandName: co.competitorBrand,
          type: 'content', // Co-occurrence suggests content competition
          confidence: Math.min(1.0, co.coOccurrenceCount / 10), // More co-occurrences = higher confidence
          reasoning: `Mentioned together ${co.coOccurrenceCount} times in AI search results`,
          evidence: {
            foundInPrompts: [],
            foundInEngines: [],
            citationCount: 0,
            mentionFrequency: co.coOccurrenceCount,
            coOccurrenceCount: co.coOccurrenceCount,
          },
          visibility: {
            perEngine: [],
            overallVisibility: 0,
          },
          ranking: {
            averagePosition: 0,
            bestPosition: 0,
            worstPosition: 0,
          },
        });
      }
    } catch (error) {
      this.logger.warn(`Co-occurrence detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return competitors;
  }

  /**
   * Detect competitors via citation patterns
   */
  private async detectViaCitations(
    workspaceId: string,
    domain: string
  ): Promise<PremiumCompetitor[]> {
    const competitors: PremiumCompetitor[] = [];

    try {
      // Find domains that are frequently cited in the same contexts
      const citationPatterns = await this.prisma.$queryRaw<{
        competitorDomain: string;
        citationCount: number;
      }>(
        `SELECT
           c."domain" AS "competitorDomain",
           COUNT(*)::int AS "citationCount"
         FROM "citations" c
         JOIN "answers" a ON a.id = c."answerId"
         JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
         JOIN "prompts" p ON p.id = pr."promptId"
         WHERE pr."workspaceId" = $1
           AND c."domain" != $2
           AND pr."status" = 'SUCCESS'
           AND 'demo' = ANY(p."tags")
         GROUP BY c."domain"
         HAVING COUNT(*) >= 3
         ORDER BY COUNT(*) DESC
         LIMIT 15`,
        [workspaceId, domain]
      );

      for (const pattern of citationPatterns) {
        // Extract brand name from domain
        const brandName = pattern.competitorDomain.split('.')[0];
        const capitalized = brandName.charAt(0).toUpperCase() + brandName.slice(1);

        competitors.push({
          domain: pattern.competitorDomain,
          brandName: capitalized,
          type: 'authority', // Frequently cited = authority competitor
          confidence: Math.min(1.0, pattern.citationCount / 20),
          reasoning: `Frequently cited (${pattern.citationCount} citations) in AI search results`,
          evidence: {
            foundInPrompts: [],
            foundInEngines: [],
            citationCount: pattern.citationCount,
            mentionFrequency: 0,
            coOccurrenceCount: 0,
          },
          visibility: {
            perEngine: [],
            overallVisibility: 0,
          },
          ranking: {
            averagePosition: 0,
            bestPosition: 0,
            worstPosition: 0,
          },
        });
      }
    } catch (error) {
      this.logger.warn(`Citation-based detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return competitors;
  }

  /**
   * Collect visibility evidence for a competitor
   */
  private async collectVisibilityEvidence(
    workspaceId: string,
    competitorBrand: string
  ): Promise<PremiumCompetitor['visibility']> {
    const perEngine: Array<{ engine: string; visible: boolean; promptsVisible: number; promptsTested: number }> = [];
    const engines = ['PERPLEXITY', 'AIO', 'BRAVE'];

    for (const engine of engines) {
      const visibility = await this.prisma.$queryRaw<{
        promptsVisible: number;
        promptsTested: number;
      }>(
        `SELECT
           COUNT(DISTINCT CASE WHEN m.id IS NOT NULL THEN pr.id END)::int AS "promptsVisible",
           COUNT(DISTINCT pr.id)::int AS "promptsTested"
         FROM "prompt_runs" pr
         JOIN "prompts" p ON p.id = pr."promptId"
         JOIN "engines" e ON e.id = pr."engineId"
         LEFT JOIN "answers" a ON a."promptRunId" = pr.id
         LEFT JOIN "mentions" m ON m."answerId" = a.id AND LOWER(m."brand") = LOWER($2)
         WHERE pr."workspaceId" = $1
           AND e."key" = $3
           AND pr."status" = 'SUCCESS'
           AND 'demo' = ANY(p."tags")`,
        [workspaceId, competitorBrand, engine]
      );

      const data = visibility[0];
      const visible = (data?.promptsVisible || 0) > 0;
      const coverage = data?.promptsTested > 0
        ? ((data.promptsVisible || 0) / data.promptsTested) * 100
        : 0;

      perEngine.push({
        engine,
        visible,
        promptsVisible: data?.promptsVisible || 0,
        promptsTested: data?.promptsTested || 0,
      });
    }

    const overallVisibility = perEngine.reduce((sum, e) => {
      const coverage = e.promptsTested > 0 ? (e.promptsVisible / e.promptsTested) * 100 : 0;
      return sum + coverage;
    }, 0) / perEngine.length;

    return {
      perEngine,
      overallVisibility: Math.round(overallVisibility),
    };
  }

  /**
   * Collect ranking evidence for a competitor
   */
  private async collectRankingEvidence(
    workspaceId: string,
    competitorBrand: string
  ): Promise<PremiumCompetitor['ranking']> {
    try {
      const rankings = await this.prisma.$queryRaw<{
        position: number;
      }>(
        `SELECT
           ROW_NUMBER() OVER (PARTITION BY pr.id ORDER BY m."createdAt") AS "position"
         FROM "mentions" m
         JOIN "answers" a ON a.id = m."answerId"
         JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
         JOIN "prompts" p ON p.id = pr."promptId"
         WHERE pr."workspaceId" = $1
           AND LOWER(m."brand") = LOWER($2)
           AND pr."status" = 'SUCCESS'
           AND 'demo' = ANY(p."tags")`,
        [workspaceId, competitorBrand]
      );

      if (rankings.length > 0) {
        const positions = rankings.map(r => r.position);
        return {
          averagePosition: Math.round(positions.reduce((a, b) => a + b, 0) / positions.length),
          bestPosition: Math.min(...positions),
          worstPosition: Math.max(...positions),
        };
      }
    } catch (error) {
      this.logger.warn(`Ranking evidence collection failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      averagePosition: 0,
      bestPosition: 0,
      worstPosition: 0,
    };
  }
}


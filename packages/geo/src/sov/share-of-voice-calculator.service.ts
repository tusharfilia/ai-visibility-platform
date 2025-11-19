import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export interface EngineSOV {
  engine: string;
  brandSOV: number;
  competitorSOV: Array<{ brand: string; sov: number }>;
  totalMentions: number;
  brandMentions: number;
}

export interface IntentClusterSOV {
  intent: string;
  brandSOV: number;
  competitorSOV: Array<{ brand: string; sov: number }>;
  promptCount: number;
}

export interface CitationFrequency {
  domain: string;
  frequency: number;
  brandMentions: number;
  competitorMentions: number;
  averagePosition: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  authorityScore: number;
  recency: Date | null;
}

export interface ShareOfVoiceResult {
  overall: {
    brandSOV: number;
    competitorSOV: Array<{ brand: string; sov: number }>;
    totalMentions: number;
  };
  perEngine: EngineSOV[];
  perIntentCluster: IntentClusterSOV[];
  citationFrequency: CitationFrequency[];
  blended: {
    brandSOV: number;
    competitorSOV: Array<{ brand: string; sov: number }>;
  };
}

@Injectable()
export class ShareOfVoiceCalculatorService {
  private dbPool: Pool;

  constructor() {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Calculate multi-dimensional share of voice
   */
  async calculateShareOfVoice(
    workspaceId: string,
    brandName: string,
    competitors: string[] = [],
    options?: {
      engines?: string[];
      intentClusters?: string[];
    }
  ): Promise<ShareOfVoiceResult> {
    const engines = options?.engines || ['PERPLEXITY', 'BRAVE', 'AIO'];
    
    // Calculate in parallel
    const [overall, perEngine, perIntentCluster, citationFrequency] = await Promise.all([
      this.calculateOverallSOV(workspaceId, brandName, competitors),
      this.calculateEngineSOV(workspaceId, brandName, competitors, engines),
      this.calculateIntentClusterSOV(workspaceId, brandName, competitors),
      this.calculateCitationFrequency(workspaceId, brandName, competitors),
    ]);

    // Calculate blended SOV (average across engines)
    const blended = this.calculateBlendedSOV(perEngine, brandName, competitors);

    return {
      overall,
      perEngine,
      perIntentCluster,
      citationFrequency,
      blended,
    };
  }

  /**
   * Calculate overall share of voice
   */
  private async calculateOverallSOV(
    workspaceId: string,
    brandName: string,
    competitors: string[]
  ): Promise<{
    brandSOV: number;
    competitorSOV: Array<{ brand: string; sov: number }>;
    totalMentions: number;
  }> {
    const query = `
      SELECT 
        LOWER(m."brand") AS "brand",
        COUNT(*)::int AS "mentions"
      FROM "mentions" m
      JOIN "answers" a ON a.id = m."answerId"
      JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
      WHERE pr."workspaceId" = $1
      GROUP BY LOWER(m."brand")
      ORDER BY COUNT(*) DESC
    `;

    const result = await this.dbPool.query(query, [workspaceId]);
    const mentionMap = new Map<string, number>();
    
    for (const row of result.rows) {
      mentionMap.set(row.brand.toLowerCase(), row.mentions);
    }

    const brandMentions = mentionMap.get(brandName.toLowerCase()) || 0;
    const totalMentions = Array.from(mentionMap.values()).reduce((sum, count) => sum + count, 0);

    const brandSOV = totalMentions > 0 ? (brandMentions / totalMentions) * 100 : 0;

    const competitorSOV: Array<{ brand: string; sov: number }> = competitors
      .map(competitor => {
        const mentions = mentionMap.get(competitor.toLowerCase()) || 0;
        const sov = totalMentions > 0 ? (mentions / totalMentions) * 100 : 0;
        return { brand: competitor, sov };
      })
      .filter(c => c.sov > 0)
      .sort((a, b) => b.sov - a.sov);

    return {
      brandSOV,
      competitorSOV,
      totalMentions,
    };
  }

  /**
   * Calculate share of voice per engine
   */
  private async calculateEngineSOV(
    workspaceId: string,
    brandName: string,
    competitors: string[],
    engines: string[]
  ): Promise<EngineSOV[]> {
    const engineSOVs: EngineSOV[] = [];

    for (const engine of engines) {
      const query = `
        SELECT 
          LOWER(m."brand") AS "brand",
          COUNT(*)::int AS "mentions"
        FROM "mentions" m
        JOIN "answers" a ON a.id = m."answerId"
        JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
        JOIN "engines" e ON e.id = pr."engineId"
        WHERE pr."workspaceId" = $1
          AND e."key" = $2
          AND pr."status" = 'SUCCESS'
        GROUP BY LOWER(m."brand")
      `;

      const result = await this.dbPool.query(query, [workspaceId, engine]);
      const mentionMap = new Map<string, number>();
      
      for (const row of result.rows) {
        mentionMap.set(row.brand.toLowerCase(), row.mentions);
      }

      const brandMentions = mentionMap.get(brandName.toLowerCase()) || 0;
      const totalMentions = Array.from(mentionMap.values()).reduce((sum, count) => sum + count, 0);
      const brandSOV = totalMentions > 0 ? (brandMentions / totalMentions) * 100 : 0;

      const competitorSOV: Array<{ brand: string; sov: number }> = competitors
        .map(competitor => {
          const mentions = mentionMap.get(competitor.toLowerCase()) || 0;
          const sov = totalMentions > 0 ? (mentions / totalMentions) * 100 : 0;
          return { brand: competitor, sov };
        })
        .filter(c => c.sov > 0)
        .sort((a, b) => b.sov - a.sov);

      engineSOVs.push({
        engine,
        brandSOV,
        competitorSOV,
        totalMentions,
        brandMentions,
      });
    }

    return engineSOVs;
  }

  /**
   * Calculate share of voice per intent cluster
   */
  private async calculateIntentClusterSOV(
    workspaceId: string,
    brandName: string,
    competitors: string[]
  ): Promise<IntentClusterSOV[]> {
    // Get prompts with their intent tags
    const query = `
      SELECT 
        p."intent",
        LOWER(m."brand") AS "brand",
        COUNT(*)::int AS "mentions"
      FROM "mentions" m
      JOIN "answers" a ON a.id = m."answerId"
      JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
      JOIN "prompts" p ON p.id = pr."promptId"
      WHERE pr."workspaceId" = $1
        AND pr."status" = 'SUCCESS'
        AND p."intent" IS NOT NULL
      GROUP BY p."intent", LOWER(m."brand")
    `;

    const result = await this.dbPool.query(query, [workspaceId]);
    
    // Group by intent
    const intentMap = new Map<string, Map<string, number>>();
    const intentPromptCount = new Map<string, number>();

    for (const row of result.rows) {
      const intent = row.intent || 'UNKNOWN';
      if (!intentMap.has(intent)) {
        intentMap.set(intent, new Map());
        intentPromptCount.set(intent, 0);
      }
      
      const brandMap = intentMap.get(intent)!;
      brandMap.set(row.brand.toLowerCase(), row.mentions);
    }

    // Get prompt counts per intent
    const promptCountQuery = `
      SELECT 
        "intent",
        COUNT(DISTINCT "id")::int AS "count"
      FROM "prompts"
      WHERE "workspaceId" = $1
        AND "intent" IS NOT NULL
      GROUP BY "intent"
    `;
    const promptCountResult = await this.dbPool.query(promptCountQuery, [workspaceId]);
    for (const row of promptCountResult.rows) {
      intentPromptCount.set(row.intent, row.count);
    }

    const intentSOVs: IntentClusterSOV[] = [];

    for (const [intent, brandMap] of intentMap.entries()) {
      const brandMentions = brandMap.get(brandName.toLowerCase()) || 0;
      const totalMentions = Array.from(brandMap.values()).reduce((sum, count) => sum + count, 0);
      const brandSOV = totalMentions > 0 ? (brandMentions / totalMentions) * 100 : 0;

      const competitorSOV: Array<{ brand: string; sov: number }> = competitors
        .map(competitor => {
          const mentions = brandMap.get(competitor.toLowerCase()) || 0;
          const sov = totalMentions > 0 ? (mentions / totalMentions) * 100 : 0;
          return { brand: competitor, sov };
        })
        .filter(c => c.sov > 0)
        .sort((a, b) => b.sov - a.sov);

      intentSOVs.push({
        intent,
        brandSOV,
        competitorSOV,
        promptCount: intentPromptCount.get(intent) || 0,
      });
    }

    return intentSOVs.sort((a, b) => b.brandSOV - a.brandSOV);
  }

  /**
   * Calculate citation frequency with detailed metrics
   */
  private async calculateCitationFrequency(
    workspaceId: string,
    brandName: string,
    competitors: string[]
  ): Promise<CitationFrequency[]> {
    const query = `
      SELECT 
        c."domain",
        COUNT(*)::int AS "frequency",
        COUNT(DISTINCT CASE WHEN LOWER(m."brand") = LOWER($2) THEN m."id" END)::int AS "brandMentions",
        COUNT(DISTINCT CASE WHEN LOWER(m."brand") != LOWER($2) THEN m."id" END)::int AS "competitorMentions",
        AVG(c."rank")::float AS "averagePosition",
        SUM(CASE WHEN m."sentiment" = 'POS' THEN 1 ELSE 0 END)::int AS "positive",
        SUM(CASE WHEN m."sentiment" = 'NEU' THEN 1 ELSE 0 END)::int AS "neutral",
        SUM(CASE WHEN m."sentiment" = 'NEG' THEN 1 ELSE 0 END)::int AS "negative",
        AVG(c."authorityScore")::float AS "authorityScore",
        MAX(c."freshness") AS "recency"
      FROM "citations" c
      JOIN "answers" a ON a.id = c."answerId"
      JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
      LEFT JOIN "mentions" m ON m."answerId" = a.id
      WHERE pr."workspaceId" = $1
      GROUP BY c."domain"
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `;

    const result = await this.dbPool.query(query, [workspaceId, brandName]);

    return result.rows.map((row: any) => ({
      domain: row.domain,
      frequency: row.frequency || 0,
      brandMentions: row.brandMentions || 0,
      competitorMentions: row.competitorMentions || 0,
      averagePosition: row.averagePosition || 0,
      sentiment: {
        positive: row.positive || 0,
        neutral: row.neutral || 0,
        negative: row.negative || 0,
      },
      authorityScore: row.authorityScore || 0,
      recency: row.recency ? new Date(row.recency) : null,
    }));
  }

  /**
   * Calculate blended SOV (average across engines)
   */
  private calculateBlendedSOV(
    perEngine: EngineSOV[],
    brandName: string,
    competitors: string[]
  ): {
    brandSOV: number;
    competitorSOV: Array<{ brand: string; sov: number }>;
  } {
    if (perEngine.length === 0) {
      return {
        brandSOV: 0,
        competitorSOV: [],
      };
    }

    // Average brand SOV across engines
    const brandSOV = perEngine.reduce((sum, engine) => sum + engine.brandSOV, 0) / perEngine.length;

    // Average competitor SOV across engines
    const competitorMap = new Map<string, number[]>();
    
    for (const engine of perEngine) {
      for (const comp of engine.competitorSOV) {
        if (!competitorMap.has(comp.brand)) {
          competitorMap.set(comp.brand, []);
        }
        competitorMap.get(comp.brand)!.push(comp.sov);
      }
    }

    const competitorSOV: Array<{ brand: string; sov: number }> = Array.from(competitorMap.entries())
      .map(([brand, sovs]) => ({
        brand,
        sov: sovs.reduce((sum, s) => sum + s, 0) / sovs.length,
      }))
      .filter(c => c.sov > 0)
      .sort((a, b) => b.sov - a.sov);

    return {
      brandSOV,
      competitorSOV,
    };
  }
}


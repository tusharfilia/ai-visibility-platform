/**
 * GEO Data Service
 * Fetches real data from database for GEO scoring and analysis
 */

import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export interface ScoringDataInput {
  workspaceId: string;
  brandName: string;
  startDate: Date;
  endDate: Date;
  engines: string[];
  competitors?: string[];
}

export interface ScoringData {
  mentions: Array<{
    text: string;
    context: string;
    position: number;
    engine: string;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
  rankings: Array<{
    position: number;
    frequency: number;
    engine: string;
  }>;
  citations: Array<{
    domain: string;
    domainAuthority: number;
    content: string;
    engine: string;
    date: Date;
    url: string;
    sourceType?: string;
    authorityScore?: number;
  }>;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
  authority: {
    domainAuthority: number;
    trustSignals: number;
    backlinks: number;
    socialSignals: number;
  };
  freshness: Date;
  trends: {
    weekly: number;
    monthly: number;
    quarterly: number;
  };
  competitors: Array<{
    brand: string;
    score: number;
  }>;
}

@Injectable()
export class GEODataService {
  private dbPool: Pool;

  constructor() {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Get real scoring data from database
   */
  async getScoringData(input: ScoringDataInput): Promise<ScoringData> {
    const { workspaceId, brandName, startDate, endDate, engines, competitors = [] } = input;

    // Query mentions
    const mentionsQuery = `
      SELECT 
        m.snippet as text,
        m.sentiment as context,
        m.position,
        e.key as engine
      FROM "Mention" m
      JOIN "Answer" a ON m."answerId" = a.id
      JOIN "PromptRun" pr ON a."promptRunId" = pr.id
      JOIN "Engine" e ON pr."engineId" = e.id
      WHERE pr."workspaceId" = $1
        AND m.brand = $2
        AND pr."startedAt" >= $3
        AND pr."startedAt" <= $4
        AND e.key = ANY($5::text[])
        AND pr.status = 'SUCCESS'
      ORDER BY pr."startedAt" DESC
      LIMIT 1000
    `;

    const mentionsResult = await this.dbPool.query(mentionsQuery, [
      workspaceId,
      brandName,
      startDate,
      endDate,
      engines,
    ]);

    // Query citations
    const citationsQuery = `
      SELECT 
        c.domain,
        c."authorityScore" as "domainAuthority",
        c.url,
        c."sourceType",
        c."authorityScore",
        a."createdAt" as date,
        e.key as engine
      FROM "Citation" c
      JOIN "Answer" a ON c."answerId" = a.id
      JOIN "PromptRun" pr ON a."promptRunId" = pr.id
      JOIN "Engine" e ON pr."engineId" = e.id
      WHERE pr."workspaceId" = $1
        AND pr."startedAt" >= $2
        AND pr."startedAt" <= $3
        AND e.key = ANY($4::text[])
        AND pr.status = 'SUCCESS'
      ORDER BY c.rank ASC NULLS LAST, a."createdAt" DESC
      LIMIT 500
    `;

    const citationsResult = await this.dbPool.query(citationsQuery, [
      workspaceId,
      startDate,
      endDate,
      engines,
    ]);

    // Calculate rankings
    const rankingsMap = new Map<string, Map<number, number>>();
    mentionsResult.rows.forEach((mention: any) => {
      if (!rankingsMap.has(mention.engine)) {
        rankingsMap.set(mention.engine, new Map());
      }
      const engineRankings = rankingsMap.get(mention.engine)!;
      const currentCount = engineRankings.get(mention.position) || 0;
      engineRankings.set(mention.position, currentCount + 1);
    });

    const rankings: ScoringData['rankings'] = [];
    rankingsMap.forEach((positions, engine) => {
      positions.forEach((frequency, position) => {
        rankings.push({ position, frequency, engine });
      });
    });

    // Calculate sentiment
    const sentiment = {
      positive: mentionsResult.rows.filter((m: any) => m.context === 'POSITIVE').length,
      negative: mentionsResult.rows.filter((m: any) => m.context === 'NEGATIVE').length,
      neutral: mentionsResult.rows.filter((m: any) => m.context === 'NEUTRAL').length,
    };

    // Calculate authority (average of citation authority scores)
    const authorityScores = citationsResult.rows
      .map((c: any) => c.authorityScore || c.domainAuthority || 0)
      .filter((score: number) => score > 0);

    const avgAuthority = authorityScores.length > 0
      ? authorityScores.reduce((a: number, b: number) => a + b, 0) / authorityScores.length
      : 50;

    // Get freshness (most recent citation date)
    const latestDate = citationsResult.rows.length > 0
      ? new Date(Math.max(...citationsResult.rows.map((c: any) => new Date(c.date).getTime())))
      : new Date();

    // Calculate trends
    const now = new Date();
    const weeklyStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthlyStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const quarterlyStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const weeklyCount = mentionsResult.rows.filter(
      (m: any) => new Date(m.date || startDate) >= weeklyStart
    ).length;
    const monthlyCount = mentionsResult.rows.filter(
      (m: any) => new Date(m.date || startDate) >= monthlyStart
    ).length;
    const quarterlyCount = mentionsResult.rows.filter(
      (m: any) => new Date(m.date || startDate) >= quarterlyStart
    ).length;

    // Calculate competitor scores
    const competitorScores = await Promise.all(
      competitors.map(async (competitor) => {
        const competitorMentions = await this.dbPool.query(
          `SELECT COUNT(*) as count
           FROM "Mention" m
           JOIN "Answer" a ON m."answerId" = a.id
           JOIN "PromptRun" pr ON a."promptRunId" = pr.id
           WHERE pr."workspaceId" = $1
             AND m.brand = $2
             AND pr."startedAt" >= $3
             AND pr."startedAt" <= $4
             AND pr.status = 'SUCCESS'`,
          [workspaceId, competitor, startDate, endDate]
        );
        const count = parseInt(competitorMentions.rows[0]?.count || '0', 10);
        return {
          brand: competitor,
          score: Math.min(100, (count / 10) * 10), // Simple scoring based on mention count
        };
      })
    );

    return {
      mentions: mentionsResult.rows.map((m: any) => ({
        text: m.text,
        context: m.context.toLowerCase(),
        position: m.position || 0,
        engine: m.engine,
        sentiment: m.context === 'POSITIVE' ? 'positive' : m.context === 'NEGATIVE' ? 'negative' : 'neutral',
      })),
      rankings,
      citations: citationsResult.rows.map((c: any) => ({
        domain: c.domain,
        domainAuthority: c.domainAuthority || c.authorityScore || 50,
        content: c.url, // Use URL as content identifier
        engine: c.engine,
        date: new Date(c.date),
        url: c.url,
        sourceType: c.sourceType,
        authorityScore: c.authorityScore || c.domainAuthority || 50,
      })),
      sentiment,
      authority: {
        domainAuthority: avgAuthority,
        trustSignals: avgAuthority * 0.9, // Estimate
        backlinks: Math.floor(avgAuthority * 10), // Estimate
        socialSignals: avgAuthority * 0.7, // Estimate
      },
      freshness: latestDate,
      trends: {
        weekly: weeklyCount,
        monthly: monthlyCount,
        quarterly: quarterlyCount,
      },
      competitors: competitorScores,
    };
  }

  /**
   * Get real AI responses from database
   */
  async getAIResponses(workspaceId: string, brandName: string): Promise<Array<{ text: string; engine: string; timestamp: Date }>> {
    const query = `
      SELECT 
        a."rawText" as text,
        e.key as engine,
        a."createdAt" as timestamp
      FROM "Answer" a
      JOIN "PromptRun" pr ON a."promptRunId" = pr.id
      JOIN "Engine" e ON pr."engineId" = e.id
      WHERE pr."workspaceId" = $1
        AND a."rawText" ILIKE $2
        AND pr.status = 'SUCCESS'
      ORDER BY a."createdAt" DESC
      LIMIT 50
    `;

    const result = await this.dbPool.query(query, [workspaceId, `%${brandName}%`]);
    
    return result.rows.map((row: any) => ({
      text: row.text,
      engine: row.engine,
      timestamp: new Date(row.timestamp),
    }));
  }

  /**
   * Get real business data from workspace profile
   */
  async getBusinessData(workspaceId: string): Promise<any> {
    const query = `
      SELECT *
      FROM "WorkspaceProfile"
      WHERE "workspaceId" = $1
    `;

    const result = await this.dbPool.query(query, [workspaceId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const profile = result.rows[0];
    return {
      industry: profile.industry || 'technology',
      founded: profile.facts?.foundedYear?.toString() || 'Unknown',
      headquarters: profile.address || 'Unknown',
      website: profile.website || '',
      description: profile.description || '',
      name: profile.name,
      facts: profile.facts || {},
    };
  }
}


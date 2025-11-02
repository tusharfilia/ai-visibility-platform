/**
 * GEO Data Controller (Test Mode - No Auth)
 * Provides endpoints to show actual citations, mentions, and evidence data from database
 */

import { Controller, Get, Query } from '@nestjs/common';
import { Pool } from 'pg';

@Controller('geo/data')
export class DataControllerTest {
  private dbPool: Pool;

  constructor() {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  @Get('citations')
  async getCitations(
    @Query('workspaceId') workspaceId?: string,
    @Query('limit') limit?: string
  ): Promise<{
    ok: boolean;
    data: {
      total: number;
      citations: any[];
      summary: {
        byEngine: Record<string, number>;
        bySourceType: Record<string, number>;
        topDomains: Array<{ domain: string; count: number }>;
      };
    };
  }> {
    try {
      const targetWorkspaceId = workspaceId || 'test-workspace-id';
      const limitNum = limit ? parseInt(limit, 10) : 50;

      // Get total count
      const totalResult = await this.dbPool.query(
        `SELECT COUNT(*) as count FROM citations 
         WHERE "workspaceId" = $1 OR EXISTS (
           SELECT 1 FROM "prompt_runs" pr 
           WHERE pr."workspaceId" = $1 
           AND EXISTS (
             SELECT 1 FROM answers a 
             WHERE a."promptRunId" = pr.id 
             AND a.id = citations."answerId"
           )
         )`,
        [targetWorkspaceId]
      );
      const total = parseInt(totalResult.rows[0]?.count || '0', 10);

      // Get actual citations
      let citationsResult;
      try {
        citationsResult = await this.dbPool.query(
          `SELECT 
             c.*, 
             c.url as citationUrl,
             c.domain,
             c."rank" as "citationRank",
             c."sourceType",
             c."authorityScore",
             a.id as "answerId",
             pr."workspaceId"
           FROM citations c
           LEFT JOIN answers a ON c."answerId" = a.id
           LEFT JOIN "prompt_runs" pr ON a."promptRunId" = pr.id
           WHERE pr."workspaceId" = $1 OR c."workspaceId" = $1
           ORDER BY c."createdAt" DESC
           LIMIT $2`,
          [targetWorkspaceId, limitNum]
        );
      } catch (error) {
        console.warn('Error fetching citations with joins, trying direct query:', (error as Error).message);
        citationsResult = await this.dbPool.query(
          `SELECT * FROM citations 
           WHERE "workspaceId" = $1
           ORDER BY "createdAt" DESC
           LIMIT $2`,
          [targetWorkspaceId, limitNum]
        );
      }

      const citations = citationsResult.rows || [];

      // Summary by engine
      const byEngine: Record<string, number> = {};
      const bySourceType: Record<string, number> = {};
      const domainCount: Record<string, number> = {};

      for (const citation of citations) {
        const engine = citation.engine || citation.engineKey || 'unknown';
        byEngine[engine] = (byEngine[engine] || 0) + 1;

        const sourceType = citation.sourceType || 'unknown';
        bySourceType[sourceType] = (bySourceType[sourceType] || 0) + 1;

        const domain = citation.domain || 'unknown';
        domainCount[domain] = (domainCount[domain] || 0) + 1;
      }

      const topDomains = Object.entries(domainCount)
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        ok: true,
        data: {
          total,
          citations,
          summary: {
            byEngine,
            bySourceType,
            topDomains,
          },
        },
      };
    } catch (error) {
      console.error('Error fetching citations:', error);
      return {
        ok: false,
        data: {
          total: 0,
          citations: [],
          summary: {
            byEngine: {},
            bySourceType: {},
            topDomains: [],
          },
        },
      };
    }
  }

  @Get('mentions')
  async getMentions(
    @Query('workspaceId') workspaceId?: string,
    @Query('limit') limit?: string
  ): Promise<{
    ok: boolean;
    data: {
      total: number;
      mentions: any[];
      summary: {
        byEngine: Record<string, number>;
        bySentiment: Record<string, number>;
        topBrands: Array<{ brand: string; count: number }>;
      };
    };
  }> {
    try {
      const targetWorkspaceId = workspaceId || 'test-workspace-id';
      const limitNum = limit ? parseInt(limit, 10) : 50;

      // Get total count
      const totalResult = await this.dbPool.query(
        `SELECT COUNT(*) as count FROM mentions 
         WHERE "workspaceId" = $1 OR EXISTS (
           SELECT 1 FROM "prompt_runs" pr 
           WHERE pr."workspaceId" = $1 
           AND EXISTS (
             SELECT 1 FROM answers a 
             WHERE a."promptRunId" = pr.id 
             AND a.id = mentions."answerId"
           )
         )`,
        [targetWorkspaceId]
      );
      const total = parseInt(totalResult.rows[0]?.count || '0', 10);

      // Get actual mentions
      let mentionsResult;
      try {
        mentionsResult = await this.dbPool.query(
          `SELECT 
             m.*,
             m."brand" as brandName,
             m.position,
             m.sentiment,
             m.snippet,
             m.engine,
             a.id as "answerId",
             pr."workspaceId"
           FROM mentions m
           LEFT JOIN answers a ON m."answerId" = a.id
           LEFT JOIN "prompt_runs" pr ON a."promptRunId" = pr.id
           WHERE pr."workspaceId" = $1 OR m."workspaceId" = $1
           ORDER BY m."createdAt" DESC
           LIMIT $2`,
          [targetWorkspaceId, limitNum]
        );
      } catch (error) {
        console.warn('Error fetching mentions with joins, trying direct query:', (error as Error).message);
        mentionsResult = await this.dbPool.query(
          `SELECT * FROM mentions 
           WHERE "workspaceId" = $1
           ORDER BY "createdAt" DESC
           LIMIT $2`,
          [targetWorkspaceId, limitNum]
        );
      }

      const mentions = mentionsResult.rows || [];

      // Summary by engine and sentiment
      const byEngine: Record<string, number> = {};
      const bySentiment: Record<string, number> = {};
      const brandCount: Record<string, number> = {};

      for (const mention of mentions) {
        const engine = mention.engine || mention.engineKey || 'unknown';
        byEngine[engine] = (byEngine[engine] || 0) + 1;

        const sentiment = mention.sentiment || 'neutral';
        bySentiment[sentiment] = (bySentiment[sentiment] || 0) + 1;

        const brand = mention.brand || mention.brandName || 'unknown';
        brandCount[brand] = (brandCount[brand] || 0) + 1;
      }

      const topBrands = Object.entries(brandCount)
        .map(([brand, count]) => ({ brand, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        ok: true,
        data: {
          total,
          mentions,
          summary: {
            byEngine,
            bySentiment,
            topBrands,
          },
        },
      };
    } catch (error) {
      console.error('Error fetching mentions:', error);
      return {
        ok: false,
        data: {
          total: 0,
          mentions: [],
          summary: {
            byEngine: {},
            bySentiment: {},
            topBrands: [],
          },
        },
      };
    }
  }

  @Get('evidence')
  async getEvidence(
    @Query('workspaceId') workspaceId?: string
  ): Promise<{
    ok: boolean;
    data: {
      citations: any;
      mentions: any;
      evidenceNodes: number;
      recommendations: string[];
    };
  }> {
    try {
      const targetWorkspaceId = workspaceId || 'test-workspace-id';

      const [citationsData, mentionsData] = await Promise.all([
        this.getCitations(targetWorkspaceId, '100'),
        this.getMentions(targetWorkspaceId, '100'),
      ]);

      const evidenceNodes = (citationsData.data.citations.length + mentionsData.data.mentions.length);
      
      const recommendations: string[] = [];
      
      if (citationsData.data.total === 0) {
        recommendations.push('No citations found - start tracking citations from AI search engines');
      }
      
      if (mentionsData.data.total === 0) {
        recommendations.push('No brand mentions found - start monitoring brand mentions across engines');
      }

      if (citationsData.data.summary.byEngine && Object.keys(citationsData.data.summary.byEngine).length === 0) {
        recommendations.push('No citations from any engine tracked - enable tracking for Perplexity, AIO, ChatGPT, etc.');
      }

      if (mentionsData.data.total > 0 && citationsData.data.total === 0) {
        recommendations.push('Found mentions but no citations - ensure citation tracking is properly configured');
      }

      if (evidenceNodes === 0) {
        recommendations.push('Build evidence graph by running prompt discovery and citation tracking');
      }

      return {
        ok: true,
        data: {
          citations: citationsData.data,
          mentions: mentionsData.data,
          evidenceNodes,
          recommendations: recommendations.length > 0 ? recommendations : ['Evidence tracking is working well'],
        },
      };
    } catch (error) {
      console.error('Error fetching evidence:', error);
      return {
        ok: false,
        data: {
          citations: { total: 0, citations: [], summary: {} },
          mentions: { total: 0, mentions: [], summary: {} },
          evidenceNodes: 0,
          recommendations: ['Error fetching evidence data'],
        },
      };
    }
  }

  @Get('summary')
  async getSummary(
    @Query('workspaceId') workspaceId?: string
  ): Promise<{
    ok: boolean;
    data: {
      workspaceId: string;
      dataHealth: {
        hasCitations: boolean;
        hasMentions: boolean;
        hasEvidenceGraph: boolean;
        dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
      };
      citationSummary: {
        total: number;
        enginesTracked: number;
        sourceTypesTracked: number;
        topSource: string;
      };
      mentionSummary: {
        total: number;
        enginesTracked: number;
        sentimentBreakdown: Record<string, number>;
      };
      recommendations: string[];
    };
  }> {
    try {
      const targetWorkspaceId = workspaceId || 'test-workspace-id';

      const evidence = await this.getEvidence(targetWorkspaceId);

      const hasCitations = evidence.data.citations.total > 0;
      const hasMentions = evidence.data.mentions.total > 0;
      const hasEvidenceGraph = evidence.data.evidenceNodes > 0;

      let dataQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
      if (hasCitations && hasMentions && evidence.data.evidenceNodes > 50) {
        dataQuality = 'excellent';
      } else if (hasCitations && hasMentions && evidence.data.evidenceNodes > 10) {
        dataQuality = 'good';
      } else if (hasCitations || hasMentions) {
        dataQuality = 'fair';
      }

      const citationSummary = {
        total: evidence.data.citations.total,
        enginesTracked: Object.keys(evidence.data.citations.summary.byEngine || {}).length,
        sourceTypesTracked: Object.keys(evidence.data.citations.summary.bySourceType || {}).length,
        topSource: evidence.data.citations.summary.topDomains[0]?.domain || 'none',
      };

      const mentionSummary = {
        total: evidence.data.mentions.total,
        enginesTracked: Object.keys(evidence.data.mentions.summary.byEngine || {}).length,
        sentimentBreakdown: evidence.data.mentions.summary.bySentiment || {},
      };

      return {
        ok: true,
        data: {
          workspaceId: targetWorkspaceId,
          dataHealth: {
            hasCitations,
            hasMentions,
            hasEvidenceGraph,
            dataQuality,
          },
          citationSummary,
          mentionSummary,
          recommendations: evidence.data.recommendations,
        },
      };
    } catch (error) {
      console.error('Error generating summary:', error);
      return {
        ok: false,
        data: {
          workspaceId: workspaceId || 'unknown',
          dataHealth: {
            hasCitations: false,
            hasMentions: false,
            hasEvidenceGraph: false,
            dataQuality: 'poor',
          },
          citationSummary: {
            total: 0,
            enginesTracked: 0,
            sourceTypesTracked: 0,
            topSource: 'none',
          },
          mentionSummary: {
            total: 0,
            enginesTracked: 0,
            sentimentBreakdown: {},
          },
          recommendations: ['Error generating summary'],
        },
      };
    }
  }
}



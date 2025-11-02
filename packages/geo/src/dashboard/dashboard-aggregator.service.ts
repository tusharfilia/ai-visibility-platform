/**
 * Dashboard Aggregator Service
 * Aggregates data from multiple sources for dashboard display
 */

import { Injectable } from '@nestjs/common';
import { GEOMaturityCalculatorService, GEOMaturityScore } from '../maturity/maturity-calculator.service';
import { PrescriptiveRecommendationEngine, Recommendation } from '../maturity/prescriptive-recommendations.service';
import { EvidenceGraphBuilderService, FactConsensusScore } from '../evidence/evidence-graph.builder';
import { EEATCalculatorService, EEATScore } from '../trust/eeat-calculator.service';
import { VisibilityScoreCalculator, VisibilityScoreInput } from '../scoring/visibility-score';
import { CitationAuthorityService } from '../scoring/citation-authority.service';
import { CitationClassifierService } from '../citations/citation-classifier.service';
import { EngineKey } from '@ai-visibility/shared';
import { Pool } from 'pg';

export interface DashboardOverview {
  maturityScore: GEOMaturityScore;
  eeatScore?: EEATScore;
  recommendations: Recommendation[];
  engineComparison: EngineVisibilityComparison[];
  progress: MaturityProgressPoint[];
  factConsensus?: FactConsensusScore[];
  lastUpdated: Date;
}

export interface EngineVisibilityComparison {
  engine: EngineKey;
  visibilityScore: number; // 0-100
  mentionCount: number;
  averagePosition: number;
  citationCount: number;
  citationAuthority: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

export interface MaturityProgressPoint {
  date: Date;
  overallScore: number;
  entityStrength: number;
  citationDepth: number;
  structuralClarity: number;
  updateCadence: number;
}

@Injectable()
export class DashboardAggregatorService {
  private dbPool: Pool;
  private readonly cache: Map<string, { data: DashboardOverview; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  private visibilityCalculator: VisibilityScoreCalculator;

  constructor(
    private maturityCalculator: GEOMaturityCalculatorService,
    private recommendationEngine: PrescriptiveRecommendationEngine,
    private evidenceBuilder: EvidenceGraphBuilderService,
    private eeatCalculator: EEATCalculatorService,
    private citationAuthority: CitationAuthorityService,
    private citationClassifier: CitationClassifierService
  ) {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    
    // Initialize visibility calculator
    this.visibilityCalculator = new VisibilityScoreCalculator();
  }

  /**
   * Get complete dashboard overview
   */
  async getDashboardOverview(workspaceId: string): Promise<DashboardOverview> {
    // Check cache
    const cached = this.cache.get(workspaceId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      // Aggregate data in parallel
      const [
        maturityScore,
        recommendations,
        engineComparison,
        progress,
      ] = await Promise.all([
        this.maturityCalculator.calculateMaturityScore(workspaceId),
        this.recommendationEngine.generateRecommendations(workspaceId),
        this.calculateEngineComparison(workspaceId),
        this.getMaturityProgress(workspaceId, 30), // Last 30 days
      ]);

      // Get E-E-A-T score (optional, may fail if not implemented)
      let eeatScore: EEATScore | undefined;
      try {
        eeatScore = await this.eeatCalculator.calculateEEATScore(workspaceId);
      } catch (error) {
        console.warn('E-E-A-T score not available:', error.message);
      }

      // Get fact consensus (optional)
      let factConsensus: FactConsensusScore[] | undefined;
      try {
        factConsensus = await this.evidenceBuilder.calculateFactLevelConsensus(workspaceId);
      } catch (error) {
        console.warn('Fact consensus not available:', error.message);
      }

      const overview: DashboardOverview = {
        maturityScore,
        eeatScore,
        recommendations: recommendations.slice(0, 10), // Top 10 recommendations
        engineComparison,
        progress,
        factConsensus,
        lastUpdated: new Date(),
      };

      // Cache the result
      this.cache.set(workspaceId, {
        data: overview,
        timestamp: Date.now(),
      });

      return overview;
    } catch (error) {
      console.error(`Error aggregating dashboard data for ${workspaceId}:`, error);
      throw new Error(`Failed to aggregate dashboard data: ${error.message}`);
    }
  }

  /**
   * Get maturity scores only
   */
  async getMaturityScores(workspaceId: string): Promise<{
    current: GEOMaturityScore;
    trends: {
      weekly: number;
      monthly: number;
      quarterly: number;
    };
  }> {
    const current = await this.maturityCalculator.calculateMaturityScore(workspaceId);
    const progress = await this.getMaturityProgress(workspaceId, 90); // 90 days for trends

    // Calculate trends
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    const weekAgoScore = this.findScoreAtDate(progress, new Date(sevenDaysAgo));
    const monthAgoScore = this.findScoreAtDate(progress, new Date(thirtyDaysAgo));
    const quarterAgoScore = this.findScoreAtDate(progress, new Date(ninetyDaysAgo));

    return {
      current,
      trends: {
        weekly: current.overallScore - (weekAgoScore?.overallScore || current.overallScore),
        monthly: current.overallScore - (monthAgoScore?.overallScore || current.overallScore),
        quarterly: current.overallScore - (quarterAgoScore?.overallScore || current.overallScore),
      },
    };
  }

  /**
   * Get recommendations only
   */
  async getRecommendations(workspaceId: string): Promise<Recommendation[]> {
    return this.recommendationEngine.generateRecommendations(workspaceId);
  }

  /**
   * Get engine comparison
   */
  async getEngineComparison(workspaceId: string): Promise<EngineVisibilityComparison[]> {
    return this.calculateEngineComparison(workspaceId);
  }

  /**
   * Get maturity progress history
   */
  async getProgressHistory(
    workspaceId: string,
    days: number = 30
  ): Promise<MaturityProgressPoint[]> {
    return this.getMaturityProgress(workspaceId, days);
  }

  /**
   * Calculate engine comparison scores
   */
  private async calculateEngineComparison(
    workspaceId: string
  ): Promise<EngineVisibilityComparison[]> {
    // Only include engines that exist in enum
    const engines: EngineKey[] = [
      EngineKey.PERPLEXITY,
      EngineKey.AIO,
      EngineKey.BRAVE,
      // OPENAI, ANTHROPIC, GEMINI, COPILOT may not be in enum - using string literals as fallback
      'OPENAI' as EngineKey,
      'ANTHROPIC' as EngineKey,
      'GEMINI' as EngineKey,
      'COPILOT' as EngineKey,
    ].filter(Boolean) as EngineKey[];

    const comparisons: EngineVisibilityComparison[] = [];

    for (const engine of engines) {
      try {
        // Get citations and mentions for this engine
        const citations = await this.getCitationsForEngine(workspaceId, engine);
        const mentions = await this.getMentionsForEngine(workspaceId, engine);

        // Calculate visibility score for this engine
        const input: VisibilityScoreInput = {
          mentions: mentions.map(m => ({
            brand: m.brand,
            position: m.position || 0,
            sentiment: m.sentiment as any,
            snippet: m.snippet,
            engine: engine.toLowerCase(),
            confidence: m.confidence || 0.5,
          })),
          citations,
          rankings: [],
          competitorData: [],
          engineKey: engine,
        };

        const visibilityScore = this.visibilityCalculator.calculateScore(input);

        // Calculate citation authority
        const citationAuthority = citations.length > 0
          ? citations.reduce((sum, c) => sum + (c.authorityScore || 0), 0) / citations.length
          : 0;

        // Calculate average position
        const positions = mentions.filter(m => m.position).map(m => m.position!);
        const averagePosition = positions.length > 0
          ? positions.reduce((sum, p) => sum + p, 0) / positions.length
          : 0;

        // Calculate trend (simplified - compare with previous period)
        const previousScore = await this.getPreviousPeriodScore(workspaceId, engine);
        const trend = this.calculateTrend(visibilityScore.overall, previousScore);

        comparisons.push({
          engine,
          visibilityScore: visibilityScore.overall,
          mentionCount: mentions.length,
          averagePosition: Math.round(averagePosition * 100) / 100,
          citationCount: citations.length,
          citationAuthority: Math.round(citationAuthority * 100) / 100,
          trend: trend.direction,
          trendPercentage: trend.percentage,
        });
      } catch (error) {
        console.warn(`Error calculating comparison for engine ${engine}:`, error);
        // Continue with other engines
      }
    }

    return comparisons.sort((a, b) => b.visibilityScore - a.visibilityScore);
  }

  /**
   * Get maturity progress over time
   */
  private async getMaturityProgress(
    workspaceId: string,
    days: number
  ): Promise<MaturityProgressPoint[]> {
    try {
      const result = await this.dbPool.query(
        `SELECT * FROM "geo_maturity_scores" 
         WHERE "workspaceId" = $1 
         AND "updatedAt" >= NOW() - INTERVAL '${days} days'
         ORDER BY "updatedAt" ASC`,
        [workspaceId]
      );

      return result.rows.map(row => ({
        date: row.updatedAt,
        overallScore: row.overallScore,
        entityStrength: row.entityStrength,
        citationDepth: row.citationDepth,
        structuralClarity: row.structuralClarity,
        updateCadence: row.updateCadence,
      }));
    } catch (error) {
      console.error('Error fetching maturity progress:', error);
      // Return current score as single point if history unavailable
      const current = await this.maturityCalculator.calculateMaturityScore(workspaceId);
      return [{
        date: new Date(),
        overallScore: current.overallScore,
        entityStrength: current.entityStrength,
        citationDepth: current.citationDepth,
        structuralClarity: current.structuralClarity,
        updateCadence: current.updateCadence,
      }];
    }
  }

  /**
   * Find score at specific date (closest match)
   */
  private findScoreAtDate(
    progress: MaturityProgressPoint[],
    targetDate: Date
  ): MaturityProgressPoint | null {
    if (progress.length === 0) return null;

    // Find closest point before or at target date
    const before = progress.filter(p => p.date <= targetDate);
    if (before.length === 0) return null;

    return before[before.length - 1];
  }

  /**
   * Get citations for specific engine
   */
  private async getCitationsForEngine(workspaceId: string, engine: EngineKey): Promise<any[]> {
    const result = await this.dbPool.query(`
      SELECT c.*, pr."engineKey"
      FROM "Citation" c
      INNER JOIN "Answer" a ON c."answerId" = a.id
      INNER JOIN "PromptRun" pr ON a."promptRunId" = pr.id
      INNER JOIN "Engine" e ON pr."engineId" = e.id
      WHERE pr."workspaceId" = $1
      AND e.key = $2
      ORDER BY c."rank" ASC NULLS LAST
      LIMIT 50
    `, [workspaceId, engine]);

    return result.rows;
  }

  /**
   * Get mentions for specific engine
   */
  private async getMentionsForEngine(workspaceId: string, engine: EngineKey): Promise<any[]> {
    const result = await this.dbPool.query(`
      SELECT m.*, pr."engineKey"
      FROM "Mention" m
      INNER JOIN "Answer" a ON m."answerId" = a.id
      INNER JOIN "PromptRun" pr ON a."promptRunId" = pr.id
      INNER JOIN "Engine" e ON pr."engineId" = e.id
      WHERE pr."workspaceId" = $1
      AND e.key = $2
      LIMIT 100
    `, [workspaceId, engine]);

    return result.rows;
  }

  /**
   * Get previous period score for trend calculation
   */
  private async getPreviousPeriodScore(workspaceId: string, engine: EngineKey): Promise<number | null> {
    try {
      // Get score from 30 days ago (simplified)
      const result = await this.dbPool.query(`
        SELECT "overallScore" FROM "geo_maturity_scores"
        WHERE "workspaceId" = $1
        AND "updatedAt" <= NOW() - INTERVAL '30 days'
        ORDER BY "updatedAt" DESC
        LIMIT 1
      `, [workspaceId]);

      return result.rows.length > 0 ? result.rows[0].overallScore : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate trend direction and percentage
   */
  private calculateTrend(
    current: number,
    previous: number | null
  ): { direction: 'up' | 'down' | 'stable'; percentage: number } {
    if (!previous) {
      return { direction: 'stable', percentage: 0 };
    }

    const diff = current - previous;
    const percentage = Math.round((diff / previous) * 100);

    if (Math.abs(percentage) < 1) {
      return { direction: 'stable', percentage };
    }

    return {
      direction: diff > 0 ? 'up' : 'down',
      percentage: Math.abs(percentage),
    };
  }

  /**
   * Clear cache for workspace
   */
  clearCache(workspaceId: string): void {
    this.cache.delete(workspaceId);
  }
}


import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GEOMaturityCalculatorService } from '../maturity/maturity-calculator.service';
import { StructuralScoringService } from '../structural/structural-scoring.service';
import { TrustSignalAggregator } from '../trust/trust-signal-aggregator.service';

export interface GEOVisibilityScore {
  overall: number;
  breakdown: {
    mentions: number;
    rankings: number;
    citations: number;
    sentiment: number;
    authority: number;
    freshness: number;
  };
  trends: {
    weekly: number;
    monthly: number;
    quarterly: number;
  };
  competitors: {
    position: number;
    gap: number;
    opportunities: number;
  };
  recommendations: string[];
  lastUpdated: Date;
}

export interface ScoringContext {
  workspaceId: string;
  brandName: string;
  competitors: string[];
  timeRange: {
    start: Date;
    end: Date;
  };
  engines: string[];
  industry: string;
}

@Injectable()
export class EnhancedGEOScoringService {
  private readonly weights = {
    mentions: 0.25,
    rankings: 0.20,
    citations: 0.20,
    sentiment: 0.15,
    authority: 0.10,
    freshness: 0.10,
  };

  private readonly industryMultipliers = {
    'technology': 1.2,
    'finance': 1.1,
    'healthcare': 1.0,
    'retail': 0.9,
    'education': 0.8,
    'default': 1.0,
  };

  constructor(
    private configService: ConfigService,
    private maturityCalculator: GEOMaturityCalculatorService,
    private structuralScoring: StructuralScoringService,
    private trustAggregator: TrustSignalAggregator
  ) {}

  /**
   * Calculate comprehensive GEO visibility score
   */
  async calculateVisibilityScore(
    context: ScoringContext,
    rawData: any
  ): Promise<GEOVisibilityScore> {
    const startTime = Date.now();

    try {
      // Calculate individual components
      const mentions = await this.calculateMentionScore(rawData.mentions, context);
      const rankings = await this.calculateRankingScore(rawData.rankings, context);
      const citations = await this.calculateCitationScore(rawData.citations, context);
      const sentiment = await this.calculateSentimentScore(rawData.sentiment, context);
      const authority = await this.calculateAuthorityScore(rawData.authority, context);
      const freshness = await this.calculateFreshnessScore(rawData.freshness, context);

      // Calculate weighted overall score
      const overall = this.calculateWeightedScore({
        mentions,
        rankings,
        citations,
        sentiment,
        authority,
        freshness,
      });

      // Calculate trends
      const trends = await this.calculateTrends(rawData.trends, context);

      // Calculate competitive position
      const competitors = await this.calculateCompetitivePosition(rawData.competitors, context);

      // Generate recommendations
      const recommendations = await this.generateRecommendations({
        mentions,
        rankings,
        citations,
        sentiment,
        authority,
        freshness,
        trends,
        competitors,
      }, context);

      const processingTime = Date.now() - startTime;

      return {
        overall: Math.round(overall * 100) / 100,
        breakdown: {
          mentions: Math.round(mentions * 100) / 100,
          rankings: Math.round(rankings * 100) / 100,
          citations: Math.round(citations * 100) / 100,
          sentiment: Math.round(sentiment * 100) / 100,
          authority: Math.round(authority * 100) / 100,
          freshness: Math.round(freshness * 100) / 100,
        },
        trends,
        competitors,
        recommendations,
        lastUpdated: new Date(),
      };

    } catch (error) {
      console.error('Error calculating GEO visibility score:', error);
      throw new Error(`Failed to calculate visibility score: ${error.message}`);
    }
  }

  /**
   * Calculate mention score based on frequency, context, and relevance
   */
  private async calculateMentionScore(mentions: any[], context: ScoringContext): Promise<number> {
    if (!mentions || mentions.length === 0) return 0;

    let score = 0;
    let totalWeight = 0;

    for (const mention of mentions) {
      const relevance = this.calculateRelevance(mention.text, context.brandName);
      const contextScore = this.calculateContextScore(mention.context);
      const positionScore = this.calculatePositionScore(mention.position);
      
      const mentionScore = (relevance * 0.5) + (contextScore * 0.3) + (positionScore * 0.2);
      const weight = this.getEngineWeight(mention.engine);
      
      score += mentionScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.min(score / totalWeight, 100) : 0;
  }

  /**
   * Calculate ranking score based on position and frequency
   */
  private async calculateRankingScore(rankings: any[], context: ScoringContext): Promise<number> {
    if (!rankings || rankings.length === 0) return 0;

    let score = 0;
    let totalWeight = 0;

    for (const ranking of rankings) {
      const positionScore = this.calculatePositionScore(ranking.position);
      const frequencyScore = Math.min(ranking.frequency / 10, 1) * 100; // Normalize frequency
      const engineWeight = this.getEngineWeight(ranking.engine);
      
      const rankingScore = (positionScore * 0.7) + (frequencyScore * 0.3);
      
      score += rankingScore * engineWeight;
      totalWeight += engineWeight;
    }

    return totalWeight > 0 ? Math.min(score / totalWeight, 100) : 0;
  }

  /**
   * Calculate citation score based on authority and relevance
   */
  private async calculateCitationScore(citations: any[], context: ScoringContext): Promise<number> {
    if (!citations || citations.length === 0) return 0;

    let score = 0;
    let totalWeight = 0;

    for (const citation of citations) {
      const authorityScore = citation.domainAuthority || 0;
      const relevanceScore = this.calculateRelevance(citation.content, context.brandName);
      const freshnessScore = await this.calculateFreshnessScore(citation.date, context);
      
      const citationScore = (authorityScore * 0.4) + (relevanceScore * 0.4) + (freshnessScore * 0.2);
      const weight = this.getEngineWeight(citation.engine);
      
      score += citationScore * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.min(score / totalWeight, 100) : 0;
  }

  /**
   * Calculate sentiment score based on positive/negative mentions
   */
  private async calculateSentimentScore(sentiment: any, context: ScoringContext): Promise<number> {
    if (!sentiment) return 50; // Neutral baseline

    const positive = sentiment.positive || 0;
    const negative = sentiment.negative || 0;
    const neutral = sentiment.neutral || 0;
    const total = positive + negative + neutral;

    if (total === 0) return 50;

    // Calculate weighted sentiment score
    const sentimentScore = ((positive * 1) + (neutral * 0.5) + (negative * 0)) / total;
    return sentimentScore * 100;
  }

  /**
   * Calculate authority score based on domain authority and trust signals
   */
  private async calculateAuthorityScore(authority: any, context: ScoringContext): Promise<number> {
    if (!authority) return 0;

    const domainAuthority = authority.domainAuthority || 0;
    const trustSignals = authority.trustSignals || 0;
    const backlinks = authority.backlinks || 0;
    const socialSignals = authority.socialSignals || 0;

    // Weighted authority calculation
    const authorityScore = (
      (domainAuthority * 0.4) +
      (trustSignals * 0.3) +
      (backlinks * 0.2) +
      (socialSignals * 0.1)
    );

    return Math.min(authorityScore, 100);
  }

  /**
   * Calculate freshness score based on recency of mentions
   */
  private async calculateFreshnessScore(freshness: any, context: ScoringContext): Promise<number> {
    if (!freshness) return 0;

    const now = new Date();
    const freshnessDate = new Date(freshness);
    const daysDiff = (now.getTime() - freshnessDate.getTime()) / (1000 * 60 * 60 * 24);

    // Exponential decay based on recency
    if (daysDiff <= 1) return 100;
    if (daysDiff <= 7) return 90;
    if (daysDiff <= 30) return 70;
    if (daysDiff <= 90) return 50;
    if (daysDiff <= 365) return 30;
    return 10;
  }

  /**
   * Calculate weighted overall score
   */
  private calculateWeightedScore(components: any): number {
    let score = 0;
    let totalWeight = 0;

    for (const [component, value] of Object.entries(components)) {
      const weight = this.weights[component] || 0;
      score += (value as number) * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  /**
   * Calculate trends over different time periods
   */
  private async calculateTrends(trends: any, context: ScoringContext): Promise<any> {
    if (!trends) {
      return {
        weekly: 0,
        monthly: 0,
        quarterly: 0,
      };
    }

    return {
      weekly: trends.weekly || 0,
      monthly: trends.monthly || 0,
      quarterly: trends.quarterly || 0,
    };
  }

  /**
   * Calculate competitive position
   */
  private async calculateCompetitivePosition(competitors: any[], context: ScoringContext): Promise<any> {
    if (!competitors || competitors.length === 0) {
      return {
        position: 0,
        gap: 0,
        opportunities: 0,
      };
    }

    // Sort competitors by score
    const sortedCompetitors = competitors.sort((a, b) => b.score - a.score);
    const ourPosition = sortedCompetitors.findIndex(c => c.brand === context.brandName) + 1;
    const topCompetitor = sortedCompetitors[0];
    const gap = topCompetitor ? topCompetitor.score - (sortedCompetitors[ourPosition - 1]?.score || 0) : 0;
    const opportunities = competitors.filter(c => c.score < 50).length;

    return {
      position: ourPosition || competitors.length + 1,
      gap: Math.round(gap * 100) / 100,
      opportunities: opportunities,
    };
  }

  /**
   * Generate actionable recommendations
   */
  private async generateRecommendations(scores: any, context: ScoringContext): Promise<string[]> {
    const recommendations: string[] = [];

    // Mention-based recommendations
    if (scores.mentions < 30) {
      recommendations.push('Increase brand mention frequency by optimizing content for target keywords');
    }

    // Ranking-based recommendations
    if (scores.rankings < 40) {
      recommendations.push('Improve search ranking by enhancing content relevance and authority');
    }

    // Citation-based recommendations
    if (scores.citations < 35) {
      recommendations.push('Build more authoritative citations through thought leadership and partnerships');
    }

    // Sentiment-based recommendations
    if (scores.sentiment < 60) {
      recommendations.push('Improve brand sentiment through better customer experience and reputation management');
    }

    // Authority-based recommendations
    if (scores.authority < 50) {
      recommendations.push('Strengthen domain authority through quality backlinks and content optimization');
    }

    // Freshness-based recommendations
    if (scores.freshness < 40) {
      recommendations.push('Increase content freshness with regular updates and new material');
    }

    // Competitive recommendations
    if (scores.competitors.gap > 20) {
      recommendations.push(`Close the ${scores.competitors.gap} point gap with top competitor through targeted optimization`);
    }

    // Industry-specific recommendations
    const industryMultiplier = this.industryMultipliers[context.industry] || this.industryMultipliers.default;
    if (industryMultiplier < 1.0) {
      recommendations.push(`Consider industry-specific optimization strategies for ${context.industry}`);
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  /**
   * Helper methods
   */
  private calculateRelevance(text: string, brandName: string): number {
    if (!text || !brandName) return 0;
    
    const textLower = text.toLowerCase();
    const brandLower = brandName.toLowerCase();
    
    // Simple relevance scoring based on brand name mentions
    const mentions = (textLower.match(new RegExp(brandLower, 'g')) || []).length;
    return Math.min(mentions * 20, 100);
  }

  private calculateContextScore(context: string): number {
    if (!context) return 50;
    
    // Score based on context quality indicators
    const positiveIndicators = ['recommended', 'best', 'top', 'leading', 'expert'];
    const negativeIndicators = ['avoid', 'worst', 'poor', 'bad', 'terrible'];
    
    const contextLower = context.toLowerCase();
    const positiveCount = positiveIndicators.filter(indicator => contextLower.includes(indicator)).length;
    const negativeCount = negativeIndicators.filter(indicator => contextLower.includes(indicator)).length;
    
    return Math.max(0, Math.min(100, 50 + (positiveCount * 10) - (negativeCount * 10)));
  }

  private calculatePositionScore(position: number): number {
    if (!position || position <= 0) return 0;
    
    // Exponential decay for position scoring
    if (position === 1) return 100;
    if (position <= 3) return 90;
    if (position <= 5) return 80;
    if (position <= 10) return 70;
    if (position <= 20) return 50;
    if (position <= 50) return 30;
    return 10;
  }

  private getEngineWeight(engine: string): number {
    const weights = {
      'perplexity': 1.0,
      'aio': 0.9,
      'brave': 0.8,
      'openai': 1.1,
      'anthropic': 1.1,
      'gemini': 1.0,
      'copilot': 1.2,
    };
    
    return weights[engine] || 0.5;
  }

  /**
   * Calculate comprehensive GEO score with 7 sub-scores
   * Formula: Entity Strength (25%) + Citation Depth (20%) + Structural Clarity (20%) + 
   *          Update Cadence (15%) + Competitor Gap (10%) + Engine Coverage (5%) + Trust Signals (5%)
   */
  async calculateComprehensiveGEOScore(
    workspaceId: string,
    context?: {
      brandName?: string;
      competitors?: string[];
      engines?: string[];
    }
  ): Promise<{
    overall: number;
    subScores: {
      entityStrength: number;
      citationDepth: number;
      structuralClarity: number;
      updateCadence: number;
      competitorGap: number;
      engineCoverage: number;
      trustSignals: number;
    };
    breakdown: {
      entityStrength: { score: number; weight: number; weighted: number };
      citationDepth: { score: number; weight: number; weighted: number };
      structuralClarity: { score: number; weight: number; weighted: number };
      updateCadence: { score: number; weight: number; weighted: number };
      competitorGap: { score: number; weight: number; weighted: number };
      engineCoverage: { score: number; weight: number; weighted: number };
      trustSignals: { score: number; weight: number; weighted: number };
    };
    benchmarked?: {
      category?: string;
      industryAverage?: number;
      percentile?: number;
    };
  }> {
    try {
      // Get maturity score (includes Entity Strength, Citation Depth, Structural Clarity, Update Cadence)
      const maturityScore = await this.maturityCalculator.calculateMaturityScore(workspaceId);

      // Calculate Competitor Gap (10%)
      const competitorGap = await this.calculateCompetitorGapScore(
        workspaceId,
        context?.brandName,
        context?.competitors || []
      );

      // Calculate Engine Coverage (5%)
      const engineCoverage = await this.calculateEngineCoverageScore(
        workspaceId,
        context?.engines || ['PERPLEXITY', 'BRAVE', 'AIO']
      );

      // Calculate Trust Signals (5%)
      const trustSignals = await this.calculateTrustSignalsScore(workspaceId);

      // Calculate weighted overall score
      const weights = {
        entityStrength: 0.25,
        citationDepth: 0.20,
        structuralClarity: 0.20,
        updateCadence: 0.15,
        competitorGap: 0.10,
        engineCoverage: 0.05,
        trustSignals: 0.05,
      };

      const overall = Math.round(
        maturityScore.entityStrength * weights.entityStrength +
        maturityScore.citationDepth * weights.citationDepth +
        maturityScore.structuralClarity * weights.structuralClarity +
        maturityScore.updateCadence * weights.updateCadence +
        competitorGap * weights.competitorGap +
        engineCoverage * weights.engineCoverage +
        trustSignals * weights.trustSignals
      );

      return {
        overall: Math.min(100, Math.max(0, overall)),
        subScores: {
          entityStrength: Math.round(maturityScore.entityStrength),
          citationDepth: Math.round(maturityScore.citationDepth),
          structuralClarity: Math.round(maturityScore.structuralClarity),
          updateCadence: Math.round(maturityScore.updateCadence),
          competitorGap: Math.round(competitorGap),
          engineCoverage: Math.round(engineCoverage),
          trustSignals: Math.round(trustSignals),
        },
        breakdown: {
          entityStrength: {
            score: maturityScore.entityStrength,
            weight: weights.entityStrength,
            weighted: maturityScore.entityStrength * weights.entityStrength,
          },
          citationDepth: {
            score: maturityScore.citationDepth,
            weight: weights.citationDepth,
            weighted: maturityScore.citationDepth * weights.citationDepth,
          },
          structuralClarity: {
            score: maturityScore.structuralClarity,
            weight: weights.structuralClarity,
            weighted: maturityScore.structuralClarity * weights.structuralClarity,
          },
          updateCadence: {
            score: maturityScore.updateCadence,
            weight: weights.updateCadence,
            weighted: maturityScore.updateCadence * weights.updateCadence,
          },
          competitorGap: {
            score: competitorGap,
            weight: weights.competitorGap,
            weighted: competitorGap * weights.competitorGap,
          },
          engineCoverage: {
            score: engineCoverage,
            weight: weights.engineCoverage,
            weighted: engineCoverage * weights.engineCoverage,
          },
          trustSignals: {
            score: trustSignals,
            weight: weights.trustSignals,
            weighted: trustSignals * weights.trustSignals,
          },
        },
      };
    } catch (error) {
      console.error('Error calculating comprehensive GEO score:', error);
      throw new Error(`Failed to calculate comprehensive GEO score: ${error.message}`);
    }
  }

  /**
   * Calculate competitor gap score (0-100)
   * Higher score = better position relative to competitors
   */
  private async calculateCompetitorGapScore(
    workspaceId: string,
    brandName?: string,
    competitors: string[] = []
  ): Promise<number> {
    if (!brandName || competitors.length === 0) {
      return 50; // Neutral score if no competitors
    }

    try {
      // Get share of voice for brand and competitors
      const Pool = require('pg').Pool;
      const dbPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });

      // Get mention counts
      const mentionQuery = `
        SELECT 
          LOWER(m."brand") AS "brand",
          COUNT(*)::int AS "mentions"
        FROM "mentions" m
        JOIN "answers" a ON a.id = m."answerId"
        JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
        WHERE pr."workspaceId" = $1
        GROUP BY LOWER(m."brand")
      `;

      const mentionResult = await dbPool.query(mentionQuery, [workspaceId]);
      const mentionMap = new Map<string, number>();
      
      for (const row of mentionResult.rows) {
        mentionMap.set(row.brand.toLowerCase(), row.mentions);
      }

      const brandMentions = mentionMap.get(brandName.toLowerCase()) || 0;
      const competitorMentions = competitors
        .map(c => mentionMap.get(c.toLowerCase()) || 0)
        .reduce((sum, count) => sum + count, 0);

      const totalMentions = brandMentions + competitorMentions;
      if (totalMentions === 0) {
        return 50; // Neutral if no mentions
      }

      // Calculate share of voice
      const brandSOV = (brandMentions / totalMentions) * 100;
      const avgCompetitorSOV = competitors.length > 0
        ? (competitorMentions / competitors.length) / totalMentions * 100
        : 0;

      // Score based on how much better we are than average competitor
      const gap = brandSOV - avgCompetitorSOV;
      
      // Normalize to 0-100 scale
      // If gap is positive (we're ahead), score is 50 + (gap * 2) capped at 100
      // If gap is negative (we're behind), score is 50 + (gap * 2) floored at 0
      const score = Math.min(100, Math.max(0, 50 + (gap * 2)));

      return score;
    } catch (error) {
      console.warn('Failed to calculate competitor gap:', error);
      return 50; // Neutral fallback
    }
  }

  /**
   * Calculate engine coverage score (0-100)
   * Higher score = visible in more engines
   */
  private async calculateEngineCoverageScore(
    workspaceId: string,
    engines: string[] = ['PERPLEXITY', 'BRAVE', 'AIO']
  ): Promise<number> {
    try {
      const Pool = require('pg').Pool;
      const dbPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });

      // Count engines where we have successful runs with mentions
      const coverageQuery = `
        SELECT DISTINCT e."key" AS "engine"
        FROM "prompt_runs" pr
        JOIN "engines" e ON e.id = pr."engineId"
        JOIN "answers" a ON a."promptRunId" = pr.id
        JOIN "mentions" m ON m."answerId" = a.id
        WHERE pr."workspaceId" = $1
          AND pr."status" = 'SUCCESS'
          AND e."key" = ANY($2::text[])
      `;

      const coverageResult = await dbPool.query(coverageQuery, [workspaceId, engines]);
      const enginesWithMentions = coverageResult.rows.length;

      // Score: percentage of engines where we're visible
      const score = (enginesWithMentions / engines.length) * 100;
      return Math.round(score);
    } catch (error) {
      console.warn('Failed to calculate engine coverage:', error);
      return 0;
    }
  }

  /**
   * Calculate trust signals score (0-100)
   * Based on reviews, certifications, verified listings, etc.
   */
  private async calculateTrustSignalsScore(workspaceId: string): Promise<number> {
    try {
      // Get workspace profile for verified status
      const Pool = require('pg').Pool;
      const dbPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });

      const profileQuery = 'SELECT "verified", "description" FROM "workspace_profiles" WHERE "workspaceId" = $1';
      const profileResult = await dbPool.query(profileQuery, [workspaceId]);
      const profile = profileResult.rows[0];

      let score = 0;

      // Verified status (30 points)
      if (profile?.verified) {
        score += 30;
      }

      // Profile completeness (20 points)
      if (profile?.description && profile.description.length > 50) {
        score += 20;
      }

      // Licensed publisher citations (25 points)
      const licensedQuery = `
        SELECT COUNT(*)::int AS "count"
        FROM "citations" c
        JOIN "answers" a ON a.id = c."answerId"
        JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
        WHERE pr."workspaceId" = $1
          AND c."isLicensed" = true
      `;
      const licensedResult = await dbPool.query(licensedQuery, [workspaceId]);
      const licensedCount = licensedResult.rows[0]?.count || 0;
      score += Math.min(25, licensedCount * 5); // 5 points per licensed citation, max 25

      // Directory listings (15 points)
      const directoryQuery = `
        SELECT COUNT(DISTINCT c."domain")::int AS "count"
        FROM "citations" c
        JOIN "answers" a ON a.id = c."answerId"
        JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
        WHERE pr."workspaceId" = $1
          AND c."directoryType" IS NOT NULL
      `;
      const directoryResult = await dbPool.query(directoryQuery, [workspaceId]);
      const directoryCount = directoryResult.rows[0]?.count || 0;
      score += Math.min(15, directoryCount * 3); // 3 points per directory, max 15

      // Positive sentiment (10 points)
      const sentimentQuery = `
        SELECT 
          SUM(CASE WHEN m."sentiment" = 'POS' THEN 1 ELSE 0 END)::int AS "positive",
          COUNT(*)::int AS "total"
        FROM "mentions" m
        JOIN "answers" a ON a.id = m."answerId"
        JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
        WHERE pr."workspaceId" = $1
      `;
      const sentimentResult = await dbPool.query(sentimentQuery, [workspaceId]);
      const positive = sentimentResult.rows[0]?.positive || 0;
      const total = sentimentResult.rows[0]?.total || 0;
      if (total > 0) {
        const positiveRatio = positive / total;
        score += Math.round(positiveRatio * 10); // Up to 10 points for positive sentiment
      }

      return Math.min(100, score);
    } catch (error) {
      console.warn('Failed to calculate trust signals:', error);
      return 0;
    }
  }
}

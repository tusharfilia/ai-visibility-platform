/**
 * Ranking Calculator
 * Calculates ranking position and visibility in AI search results
 */

export interface RankingInput {
  engine: string;
  totalResults: number;
  position: number;
  visibility: number;
  context: string;
}

export interface RankingResult {
  engine: string;
  position: number;
  totalResults: number;
  visibility: number;
  score: number;
  percentile: number;
  context: string;
}

export interface RankingMetrics {
  averagePosition: number;
  topRankings: number;
  visibilityScore: number;
  engineDistribution: Record<string, number>;
  positionTrends: Record<string, number[]>;
}

export class RankingCalculator {
  private positionWeights = {
    1: 100,
    2: 90,
    3: 80,
    4: 70,
    5: 60,
    6: 50,
    7: 40,
    8: 30,
    9: 20,
    10: 10
  };

  /**
   * Calculate ranking score for a single result
   */
  calculateRankingScore(input: RankingInput): RankingResult {
    const positionScore = this.getPositionScore(input.position);
    const visibilityScore = this.getVisibilityScore(input.visibility);
    const contextScore = this.getContextScore(input.context);
    
    const totalScore = (positionScore * 0.5) + (visibilityScore * 0.3) + (contextScore * 0.2);
    const percentile = this.calculatePercentile(input.position, input.totalResults);
    
    return {
      engine: input.engine,
      position: input.position,
      totalResults: input.totalResults,
      visibility: input.visibility,
      score: Math.round(totalScore),
      percentile,
      context: input.context
    };
  }

  /**
   * Calculate ranking metrics for multiple results
   */
  calculateRankingMetrics(rankings: RankingResult[]): RankingMetrics {
    if (rankings.length === 0) {
      return {
        averagePosition: 0,
        topRankings: 0,
        visibilityScore: 0,
        engineDistribution: {},
        positionTrends: {}
      };
    }

    const averagePosition = rankings.reduce((sum, r) => sum + r.position, 0) / rankings.length;
    const topRankings = rankings.filter(r => r.position <= 5).length;
    const visibilityScore = rankings.reduce((sum, r) => sum + r.visibility, 0) / rankings.length;
    
    const engineDistribution = rankings.reduce((acc, r) => {
      acc[r.engine] = (acc[r.engine] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const positionTrends = this.calculatePositionTrends(rankings);

    return {
      averagePosition: Math.round(averagePosition * 100) / 100,
      topRankings,
      visibilityScore: Math.round(visibilityScore * 100) / 100,
      engineDistribution,
      positionTrends
    };
  }

  /**
   * Get position score based on ranking position
   */
  private getPositionScore(position: number): number {
    if (position <= 10) {
      return this.positionWeights[position as keyof typeof this.positionWeights] || 0;
    }
    
    // Calculate score for positions beyond 10
    return Math.max(0, 100 - (position * 5));
  }

  /**
   * Get visibility score
   */
  private getVisibilityScore(visibility: number): number {
    // Visibility is already a 0-1 score, convert to 0-100
    return Math.round(visibility * 100);
  }

  /**
   * Get context score based on surrounding text
   */
  private getContextScore(context: string): number {
    if (!context) return 50; // Neutral score for no context
    
    let score = 50; // Base score
    
    // Positive context indicators
    const positiveIndicators = [
      'recommended', 'best', 'top', 'leading', 'premium', 'quality',
      'excellent', 'outstanding', 'superior', 'advanced'
    ];
    
    // Negative context indicators
    const negativeIndicators = [
      'worst', 'poor', 'bad', 'terrible', 'avoid', 'problematic',
      'unreliable', 'outdated', 'expensive', 'slow'
    ];
    
    const contextLower = context.toLowerCase();
    
    // Check for positive indicators
    positiveIndicators.forEach(indicator => {
      if (contextLower.includes(indicator)) {
        score += 10;
      }
    });
    
    // Check for negative indicators
    negativeIndicators.forEach(indicator => {
      if (contextLower.includes(indicator)) {
        score -= 10;
      }
    });
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate percentile ranking
   */
  private calculatePercentile(position: number, totalResults: number): number {
    if (totalResults === 0) return 0;
    
    const percentile = ((totalResults - position + 1) / totalResults) * 100;
    return Math.round(percentile * 100) / 100;
  }

  /**
   * Calculate position trends over time
   */
  private calculatePositionTrends(rankings: RankingResult[]): Record<string, number[]> {
    const trends: Record<string, number[]> = {};
    
    // Group by engine and sort by position
    const engineGroups = rankings.reduce((acc, r) => {
      if (!acc[r.engine]) acc[r.engine] = [];
      acc[r.engine].push(r.position);
      return acc;
    }, {} as Record<string, number[]>);
    
    // Calculate trends for each engine
    Object.entries(engineGroups).forEach(([engine, positions]) => {
      trends[engine] = positions.sort((a, b) => a - b);
    });
    
    return trends;
  }

  /**
   * Get ranking improvement recommendations
   */
  getImprovementRecommendations(rankings: RankingResult[]): string[] {
    const recommendations: string[] = [];
    
    if (rankings.length === 0) {
      recommendations.push('No rankings found - ensure content is optimized for AI engines');
      return recommendations;
    }
    
    const averagePosition = rankings.reduce((sum, r) => sum + r.position, 0) / rankings.length;
    const topRankings = rankings.filter(r => r.position <= 5).length;
    const visibilityScore = rankings.reduce((sum, r) => sum + r.visibility, 0) / rankings.length;
    
    if (averagePosition > 10) {
      recommendations.push('Improve content quality and relevance to achieve better rankings');
    }
    
    if (topRankings === 0) {
      recommendations.push('Focus on achieving top 5 rankings in at least one engine');
    }
    
    if (visibilityScore < 0.5) {
      recommendations.push('Increase content visibility and engagement metrics');
    }
    
    if (rankings.length < 3) {
      recommendations.push('Expand presence across more AI engines');
    }
    
    return recommendations;
  }

  /**
   * Get ranking comparison with competitors
   */
  getCompetitorComparison(
    ownRankings: RankingResult[],
    competitorRankings: Record<string, RankingResult[]>
  ): {
    ownAverage: number;
    competitorAverages: Record<string, number>;
    competitiveAdvantage: Record<string, number>;
  } {
    const ownAverage = ownRankings.reduce((sum, r) => sum + r.position, 0) / ownRankings.length;
    
    const competitorAverages: Record<string, number> = {};
    const competitiveAdvantage: Record<string, number> = {};
    
    Object.entries(competitorRankings).forEach(([competitor, rankings]) => {
      const average = rankings.reduce((sum, r) => sum + r.position, 0) / rankings.length;
      competitorAverages[competitor] = average;
      competitiveAdvantage[competitor] = average - ownAverage;
    });
    
    return {
      ownAverage,
      competitorAverages,
      competitiveAdvantage
    };
  }

  /**
   * Get ranking score by engine
   */
  getRankingScoreByEngine(rankings: RankingResult[]): Record<string, number> {
    const engineScores: Record<string, number> = {};
    
    rankings.forEach(ranking => {
      if (!engineScores[ranking.engine]) {
        engineScores[ranking.engine] = 0;
      }
      engineScores[ranking.engine] += ranking.score;
    });
    
    // Calculate average score per engine
    Object.keys(engineScores).forEach(engine => {
      const engineRankings = rankings.filter(r => r.engine === engine);
      engineScores[engine] = engineScores[engine] / engineRankings.length;
    });
    
    return engineScores;
  }
}



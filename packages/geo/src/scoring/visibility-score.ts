/**
 * GEO Visibility Scoring Algorithm
 * Calculates visibility score (0-100) based on AI engine mentions and rankings
 */

import { EngineKey } from '@ai-visibility/shared';
import { CitationAuthorityService } from './citation-authority.service';
import { CitationClassifierService } from '../citations/citation-classifier.service';

export interface VisibilityScoreInput {
  mentions: Mention[];
  citations: Citation[];
  rankings: Ranking[];
  competitorData: CompetitorData[];
  engineKey?: EngineKey;
  structuralScore?: number; // 0-100
}

export interface Mention {
  brand: string;
  position: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  snippet: string;
  engine: string;
  confidence: number;
}

export interface Citation {
  url: string;
  domain: string;
  rank?: number;
  confidence?: number;
  relevance?: number;
  sourceType?: string;
  isLicensed?: boolean;
  authorityScore?: number;
  freshness?: Date;
}

export interface Ranking {
  engine: string;
  position: number;
  totalResults: number;
  visibility: number; // 0-1
}

export interface CompetitorData {
  brand: string;
  mentions: number;
  averagePosition: number;
  visibility: number;
}

export interface VisibilityScore {
  overall: number;
  breakdown: {
    mentionScore: number;
    rankingScore: number;
    citationScore: number;
    competitorScore: number;
    structuralScore?: number;
  };
  details: {
    totalMentions: number;
    averagePosition: number;
    topRankings: number;
    citationAuthority: number;
    engineKey?: EngineKey;
  };
}

export class VisibilityScoreCalculator {
  private weights = {
    mentionScore: 0.35,
    rankingScore: 0.25,
    citationScore: 0.20,
    competitorScore: 0.10,
    structuralScore: 0.10
  };

  private authorityService: CitationAuthorityService;
  private classifier: CitationClassifierService;

  constructor() {
    this.authorityService = new CitationAuthorityService();
    this.classifier = new CitationClassifierService();
  }

  /**
   * Calculate overall visibility score (engine-aware)
   */
  calculateScore(input: VisibilityScoreInput): VisibilityScore {
    const engineKey = input.engineKey;
    const mentionScore = this.calculateMentionScore(input.mentions);
    const rankingScore = this.calculateRankingScore(input.rankings);
    
    // Use engine-aware citation scoring if engineKey provided
    const citationScore = engineKey
      ? this.calculateEngineAwareCitationScore(input.citations, engineKey)
      : this.calculateCitationScore(input.citations);
    
    const competitorScore = this.calculateCompetitorScore(input.competitorData);
    
    // Structural score (defaults to 50 if not provided)
    const structuralScore = input.structuralScore !== undefined ? input.structuralScore : 50;

    const overall = Math.round(
      mentionScore * this.weights.mentionScore +
      rankingScore * this.weights.rankingScore +
      citationScore * this.weights.citationScore +
      competitorScore * this.weights.competitorScore +
      structuralScore * this.weights.structuralScore
    );

    return {
      overall: Math.min(100, Math.max(0, overall)),
      breakdown: {
        mentionScore,
        rankingScore,
        citationScore,
        competitorScore,
        structuralScore
      },
      details: {
        totalMentions: input.mentions.length,
        averagePosition: this.calculateAveragePosition(input.mentions),
        topRankings: this.countTopRankings(input.rankings),
        citationAuthority: this.calculateCitationAuthority(input.citations),
        engineKey
      }
    };
  }

  /**
   * Calculate mention score based on position and sentiment
   */
  private calculateMentionScore(mentions: Mention[]): number {
    if (mentions.length === 0) return 0;

    let totalScore = 0;
    let weightedCount = 0;

    mentions.forEach(mention => {
      const positionWeight = this.getPositionWeight(mention.position);
      const sentimentWeight = this.getSentimentWeight(mention.sentiment);
      const confidenceWeight = mention.confidence;
      
      const mentionScore = positionWeight * sentimentWeight * confidenceWeight;
      totalScore += mentionScore;
      weightedCount += confidenceWeight;
    });

    return weightedCount > 0 ? Math.round((totalScore / weightedCount) * 100) : 0;
  }

  /**
   * Calculate ranking score based on position in results
   */
  private calculateRankingScore(rankings: Ranking[]): number {
    if (rankings.length === 0) return 0;

    let totalScore = 0;
    let engineCount = 0;

    rankings.forEach(ranking => {
      const positionScore = this.getPositionScore(ranking.position, ranking.totalResults);
      const visibilityBonus = ranking.visibility * 10; // Bonus for high visibility
      
      totalScore += positionScore + visibilityBonus;
      engineCount++;
    });

    return engineCount > 0 ? Math.round((totalScore / engineCount) * 100) : 0;
  }

  /**
   * Calculate citation score based on authority and relevance
   */
  private calculateCitationScore(citations: Citation[]): number {
    if (citations.length === 0) return 0;

    let totalScore = 0;
    let weightedCount = 0;

    citations.forEach(citation => {
      const rankScore = this.getCitationRankScore(citation.rank || 0);
      const authorityScore = citation.authorityScore || this.getDomainAuthority(citation.domain);
      const relevanceScore = citation.relevance || 0.5;
      
      const citationScore = rankScore * authorityScore * relevanceScore;
      totalScore += citationScore;
      weightedCount += relevanceScore;
    });

    return weightedCount > 0 ? Math.round((totalScore / weightedCount) * 100) : 0;
  }

  /**
   * Calculate engine-aware citation score with source multipliers (synchronous)
   */
  private calculateEngineAwareCitationScore(citations: Citation[], engineKey: EngineKey): number {
    if (citations.length === 0) return 0;

    let totalScore = 0;
    let weightedCount = 0;

    citations.forEach(citation => {
      const baseAuthority = citation.authorityScore || this.getDomainAuthority(citation.domain);
      
      // Calculate authority (without async classification if not available)
      const authority = this.authorityService.calculateAuthority(
        {
          ...citation,
          sourceType: citation.sourceType,
          isLicensed: citation.isLicensed,
          authorityScore: baseAuthority,
        },
        engineKey
      );

      const rankScore = this.getCitationRankScore(citation.rank || 0);
      const relevanceScore = citation.relevance || 0.5;
      
      const citationScore = rankScore * authority * relevanceScore;
      totalScore += citationScore;
      weightedCount += relevanceScore;
    });

    return weightedCount > 0 ? Math.round((totalScore / weightedCount) * 100) : 0;
  }

  /**
   * Calculate competitor score (relative performance)
   */
  private calculateCompetitorScore(competitors: CompetitorData[]): number {
    if (competitors.length === 0) return 50; // Neutral score if no competitors

    const sortedCompetitors = competitors.sort((a, b) => b.visibility - a.visibility);
    const topCompetitor = sortedCompetitors[0];
    
    if (!topCompetitor) return 50;

    // Calculate relative performance
    const relativeScore = (topCompetitor.visibility / 100) * 100;
    return Math.round(relativeScore);
  }

  /**
   * Get position weight based on mention position
   */
  private getPositionWeight(position: number): number {
    if (position <= 1) return 1.0;
    if (position <= 3) return 0.8;
    if (position <= 5) return 0.6;
    if (position <= 10) return 0.4;
    if (position <= 20) return 0.2;
    return 0.1;
  }

  /**
   * Get sentiment weight
   */
  private getSentimentWeight(sentiment: string): number {
    switch (sentiment) {
      case 'positive': return 1.0;
      case 'neutral': return 0.7;
      case 'negative': return 0.3;
      default: return 0.5;
    }
  }

  /**
   * Get position score based on ranking position
   */
  private getPositionScore(position: number, totalResults: number): number {
    if (position <= 1) return 100;
    if (position <= 3) return 80;
    if (position <= 5) return 60;
    if (position <= 10) return 40;
    if (position <= 20) return 20;
    
    // Calculate relative position score
    const relativePosition = position / totalResults;
    return Math.max(0, 100 - (relativePosition * 100));
  }

  /**
   * Get citation rank score
   */
  private getCitationRankScore(rank: number): number {
    if (rank <= 1) return 1.0;
    if (rank <= 3) return 0.8;
    if (rank <= 5) return 0.6;
    if (rank <= 10) return 0.4;
    return 0.2;
  }

  /**
   * Get domain authority score
   */
  private getDomainAuthority(domain: string): number {
    // This would integrate with actual domain authority data
    const authorityMap: Record<string, number> = {
      'wikipedia.org': 1.0,
      'google.com': 1.0,
      'microsoft.com': 0.9,
      'apple.com': 0.9,
      'amazon.com': 0.9,
      'github.com': 0.8,
      'stackoverflow.com': 0.8,
      'reddit.com': 0.7,
      'youtube.com': 0.7,
      'twitter.com': 0.6
    };

    return authorityMap[domain] || 0.5;
  }

  /**
   * Calculate average position of mentions
   */
  private calculateAveragePosition(mentions: Mention[]): number {
    if (mentions.length === 0) return 0;
    
    const totalPosition = mentions.reduce((sum, mention) => sum + mention.position, 0);
    return Math.round(totalPosition / mentions.length);
  }

  /**
   * Count top rankings (positions 1-5)
   */
  private countTopRankings(rankings: Ranking[]): number {
    return rankings.filter(ranking => ranking.position <= 5).length;
  }

  /**
   * Calculate citation authority score
   */
  private calculateCitationAuthority(citations: Citation[]): number {
    if (citations.length === 0) return 0;
    
    const totalAuthority = citations.reduce((sum, citation) => {
      return sum + this.getDomainAuthority(citation.domain);
    }, 0);
    
    return Math.round((totalAuthority / citations.length) * 100);
  }

  /**
   * Get score breakdown by engine
   */
  getScoreByEngine(mentions: Mention[], rankings: Ranking[]): Record<string, number> {
    const engines = new Set([
      ...mentions.map(m => m.engine),
      ...rankings.map(r => r.engine)
    ]);

    const engineScores: Record<string, number> = {};

    engines.forEach(engine => {
      const engineMentions = mentions.filter(m => m.engine === engine);
      const engineRankings = rankings.filter(r => r.engine === engine);
      
      const mentionScore = this.calculateMentionScore(engineMentions);
      const rankingScore = this.calculateRankingScore(engineRankings);
      
      engineScores[engine] = Math.round((mentionScore + rankingScore) / 2);
    });

    return engineScores;
  }

  /**
   * Get improvement recommendations
   */
  getImprovementRecommendations(score: VisibilityScore): string[] {
    const recommendations: string[] = [];

    if (score.breakdown.mentionScore < 50) {
      recommendations.push('Improve brand mention quality and position in AI responses');
    }

    if (score.breakdown.rankingScore < 50) {
      recommendations.push('Optimize content for better ranking in AI search results');
    }

    if (score.breakdown.citationScore < 50) {
      recommendations.push('Build more authoritative citations and backlinks');
    }

    if (score.breakdown.competitorScore < 50) {
      recommendations.push('Analyze competitor strategies and improve competitive positioning');
    }

    if (score.details.totalMentions < 5) {
      recommendations.push('Increase brand mentions across AI engines');
    }

    if (score.details.averagePosition > 10) {
      recommendations.push('Improve content quality to achieve better positions');
    }

    return recommendations;
  }
}


import { Injectable } from '@nestjs/common';

export interface ImpactFactors {
  domainAuthority: number;
  citationFrequency: number;
  competitorCount: number;
  industryRelevance: number;
  contentQuality: number;
  audienceSize: number;
  engagementRate: number;
}

export interface ImpactCalculation {
  baseScore: number;
  factors: ImpactFactors;
  weightedScore: number;
  finalScore: number;
  recommendations: string[];
}

export interface CompetitorCitation {
  competitor: string;
  frequency: number;
  context: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

@Injectable()
export class ImpactCalculatorService {
  private readonly FACTOR_WEIGHTS = {
    domainAuthority: 0.30,
    citationFrequency: 0.25,
    competitorCount: 0.20,
    industryRelevance: 0.10,
    contentQuality: 0.08,
    audienceSize: 0.05,
    engagementRate: 0.02
  };

  /**
   * Calculate impact score for citation opportunity
   */
  async calculateImpact(
    domain: string,
    authority: number,
    citationCount: number,
    competitorCitations: CompetitorCitation[]
  ): Promise<number> {
    try {
      const factors = await this.analyzeImpactFactors(
        domain,
        authority,
        citationCount,
        competitorCitations
      );

      const calculation = this.calculateWeightedScore(factors);
      
      return Math.round(calculation.finalScore);
    } catch (error) {
      console.error(`Failed to calculate impact for ${domain}:`, error);
      return 0;
    }
  }

  /**
   * Get detailed impact analysis
   */
  async getDetailedImpactAnalysis(
    domain: string,
    authority: number,
    citationCount: number,
    competitorCitations: CompetitorCitation[]
  ): Promise<ImpactCalculation> {
    const factors = await this.analyzeImpactFactors(
      domain,
      authority,
      citationCount,
      competitorCitations
    );

    const calculation = this.calculateWeightedScore(factors);
    
    return {
      ...calculation,
      recommendations: this.generateRecommendations(factors, calculation.finalScore)
    };
  }

  /**
   * Compare multiple opportunities
   */
  async compareOpportunities(
    opportunities: Array<{
      domain: string;
      authority: number;
      citationCount: number;
      competitorCitations: CompetitorCitation[];
    }>
  ): Promise<Array<{
    domain: string;
    impactScore: number;
    rank: number;
    priority: 'high' | 'medium' | 'low';
  }>> {
    const analyses = await Promise.all(
      opportunities.map(async (opp) => ({
        domain: opp.domain,
        impactScore: await this.calculateImpact(
          opp.domain,
          opp.authority,
          opp.citationCount,
          opp.competitorCitations
        )
      }))
    );

    // Sort by impact score
    analyses.sort((a, b) => b.impactScore - a.impactScore);

    // Add ranking and priority
    return analyses.map((analysis, index) => ({
      ...analysis,
      rank: index + 1,
      priority: this.getPriority(analysis.impactScore)
    }));
  }

  /**
   * Calculate ROI estimate for outreach
   */
  async calculateROI(
    domain: string,
    authority: number,
    estimatedEffort: number,
    successProbability: number = 0.3
  ): Promise<{
    estimatedROI: number;
    effortScore: number;
    successProbability: number;
    recommendation: string;
  }> {
    const impactScore = await this.calculateImpact(domain, authority, 1, []);
    
    // Calculate effort score (1-10, where 10 is highest effort)
    const effortScore = Math.min(10, Math.max(1, estimatedEffort));
    
    // Calculate estimated ROI
    const estimatedROI = (impactScore * successProbability) / effortScore;
    
    let recommendation: string;
    if (estimatedROI >= 5) {
      recommendation = 'High ROI - Prioritize this opportunity';
    } else if (estimatedROI >= 2) {
      recommendation = 'Medium ROI - Consider if resources allow';
    } else {
      recommendation = 'Low ROI - Skip or defer to later';
    }

    return {
      estimatedROI: Math.round(estimatedROI * 100) / 100,
      effortScore,
      successProbability,
      recommendation
    };
  }

  /**
   * Analyze impact factors for domain
   */
  private async analyzeImpactFactors(
    domain: string,
    authority: number,
    citationCount: number,
    competitorCitations: CompetitorCitation[]
  ): Promise<ImpactFactors> {
    return {
      domainAuthority: authority / 100, // Normalize to 0-1
      citationFrequency: Math.min(1, citationCount / 10), // Normalize to 0-1
      competitorCount: Math.min(1, competitorCitations.length / 5), // Normalize to 0-1
      industryRelevance: await this.calculateIndustryRelevance(domain),
      contentQuality: await this.calculateContentQuality(domain),
      audienceSize: await this.calculateAudienceSize(domain),
      engagementRate: await this.calculateEngagementRate(domain)
    };
  }

  /**
   * Calculate weighted impact score
   */
  private calculateWeightedScore(factors: ImpactFactors): ImpactCalculation {
    const baseScore = Object.entries(this.FACTOR_WEIGHTS).reduce((total, [factor, weight]) => {
      return total + (factors[factor as keyof ImpactFactors] * weight * 100);
    }, 0);

    // Apply bonus for high-authority domains
    const authorityBonus = factors.domainAuthority >= 0.8 ? 10 : 0;
    
    // Apply bonus for high citation frequency
    const frequencyBonus = factors.citationFrequency >= 0.7 ? 5 : 0;
    
    const weightedScore = baseScore + authorityBonus + frequencyBonus;
    const finalScore = Math.min(100, Math.max(0, weightedScore));

    return {
      baseScore: Math.round(baseScore),
      factors,
      weightedScore: Math.round(weightedScore),
      finalScore: Math.round(finalScore),
      recommendations: []
    };
  }

  /**
   * Calculate industry relevance score
   */
  private async calculateIndustryRelevance(domain: string): Promise<number> {
    // Mock implementation - in real implementation, analyze domain content
    const industryDomains = {
      'tech': ['techcrunch.com', 'wired.com', 'theverge.com', 'arstechnica.com'],
      'business': ['forbes.com', 'bloomberg.com', 'wsj.com', 'ft.com'],
      'health': ['webmd.com', 'mayoclinic.org', 'healthline.com'],
      'finance': ['bloomberg.com', 'wsj.com', 'ft.com', 'reuters.com'],
      'education': ['wikipedia.org', 'edu', 'coursera.org']
    };

    for (const [industry, domains] of Object.entries(industryDomains)) {
      if (domains.some(d => domain.includes(d))) {
        return 0.8; // High relevance for industry-specific domains
      }
    }

    return 0.5; // Medium relevance for general domains
  }

  /**
   * Calculate content quality score
   */
  private async calculateContentQuality(domain: string): Promise<number> {
    // Mock implementation - in real implementation, analyze content quality
    const highQualityDomains = ['wikipedia.org', 'edu', 'gov', 'mayoclinic.org'];
    const mediumQualityDomains = ['forbes.com', 'bloomberg.com', 'techcrunch.com'];
    
    if (highQualityDomains.some(d => domain.includes(d))) return 0.9;
    if (mediumQualityDomains.some(d => domain.includes(d))) return 0.7;
    return 0.6;
  }

  /**
   * Calculate audience size estimate
   */
  private async calculateAudienceSize(domain: string): Promise<number> {
    // Mock implementation - in real implementation, use traffic data
    const highTrafficDomains = ['google.com', 'facebook.com', 'wikipedia.org', 'youtube.com'];
    const mediumTrafficDomains = ['reddit.com', 'stackoverflow.com', 'github.com'];
    
    if (highTrafficDomains.some(d => domain.includes(d))) return 0.9;
    if (mediumTrafficDomains.some(d => domain.includes(d))) return 0.7;
    return 0.5;
  }

  /**
   * Calculate engagement rate estimate
   */
  private async calculateEngagementRate(domain: string): Promise<number> {
    // Mock implementation - in real implementation, analyze engagement metrics
    const highEngagementDomains = ['reddit.com', 'twitter.com', 'linkedin.com'];
    const mediumEngagementDomains = ['medium.com', 'quora.com', 'stackoverflow.com'];
    
    if (highEngagementDomains.some(d => domain.includes(d))) return 0.8;
    if (mediumEngagementDomains.some(d => domain.includes(d))) return 0.6;
    return 0.4;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(factors: ImpactFactors, finalScore: number): string[] {
    const recommendations: string[] = [];

    if (factors.domainAuthority >= 0.8) {
      recommendations.push('High-authority domain - prioritize outreach');
    }

    if (factors.citationFrequency >= 0.7) {
      recommendations.push('High citation frequency - strong opportunity');
    }

    if (factors.competitorCount >= 0.6) {
      recommendations.push('Multiple competitors cited - competitive landscape');
    }

    if (factors.industryRelevance >= 0.8) {
      recommendations.push('High industry relevance - targeted audience');
    }

    if (finalScore >= 80) {
      recommendations.push('Very high impact opportunity - immediate action recommended');
    } else if (finalScore >= 60) {
      recommendations.push('High impact opportunity - prioritize in outreach queue');
    } else if (finalScore >= 40) {
      recommendations.push('Medium impact opportunity - consider if resources allow');
    } else {
      recommendations.push('Lower impact opportunity - monitor for future potential');
    }

    return recommendations;
  }

  /**
   * Get priority level based on score
   */
  private getPriority(score: number): 'high' | 'medium' | 'low' {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Calculate seasonal impact adjustment
   */
  calculateSeasonalAdjustment(domain: string, baseScore: number): number {
    // Mock implementation - in real implementation, analyze seasonal trends
    const seasonalDomains = {
      'holiday': ['christmas', 'holiday', 'gift'],
      'back-to-school': ['education', 'school', 'university'],
      'tax': ['tax', 'finance', 'accounting']
    };

    const currentMonth = new Date().getMonth();
    
    // Apply seasonal adjustments
    if (currentMonth >= 10 && currentMonth <= 11) { // Nov-Dec
      if (seasonalDomains.holiday.some(keyword => domain.includes(keyword))) {
        return baseScore * 1.2; // 20% boost during holiday season
      }
    }

    if (currentMonth >= 7 && currentMonth <= 8) { // Aug-Sep
      if (seasonalDomains['back-to-school'].some(keyword => domain.includes(keyword))) {
        return baseScore * 1.15; // 15% boost during back-to-school
      }
    }

    if (currentMonth >= 2 && currentMonth <= 3) { // Mar-Apr
      if (seasonalDomains.tax.some(keyword => domain.includes(keyword))) {
        return baseScore * 1.1; // 10% boost during tax season
      }
    }

    return baseScore;
  }
}
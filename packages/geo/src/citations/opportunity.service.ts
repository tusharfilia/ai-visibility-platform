import { Injectable } from '@nestjs/common';
import { DomainAnalyzerService } from './domain-analyzer';
import { ImpactCalculatorService } from './impact-calculator';

export interface CitationOpportunity {
  id: string;
  workspaceId: string;
  domain: string;
  domainAuthority: number;
  citationCount: number;
  impactScore: number;
  status: 'identified' | 'outreach' | 'cited';
  competitorsCited: string[];
  lastAnalyzed: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CitationAnalysis {
  domain: string;
  authority: number;
  citations: Array<{
    competitor: string;
    frequency: number;
    context: string;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
  opportunityScore: number;
  recommendedAction: string;
}

export interface CompetitorAnalysis {
  competitor: string;
  citationCount: number;
  domains: string[];
  averageAuthority: number;
  topDomains: Array<{
    domain: string;
    authority: number;
    citations: number;
  }>;
}

@Injectable()
export class CitationOpportunityService {
  constructor(
    private domainAnalyzer: DomainAnalyzerService,
    private impactCalculator: ImpactCalculatorService
  ) {}

  /**
   * Identify citation opportunities for a workspace
   */
  async identifyOpportunities(
    workspaceId: string,
    scanResults: any[],
    competitors: string[]
  ): Promise<CitationOpportunity[]> {
    try {
      // 1. Extract all citations from scan results
      const allCitations = this.extractCitationsFromResults(scanResults);
      
      // 2. Group citations by domain
      const domainCitations = this.groupCitationsByDomain(allCitations);
      
      // 3. Analyze each domain for opportunities
      const opportunities: CitationOpportunity[] = [];
      
      for (const [domain, citations] of domainCitations.entries()) {
        // Skip if domain is already cited for this workspace
        if (this.isWorkspaceCited(domain, citations, workspaceId)) {
          continue;
        }
        
        // Calculate domain authority
        const authority = await this.domainAnalyzer.calculateAuthority(domain);
        
        // Count competitor citations
        const competitorCitations = this.countCompetitorCitations(citations, competitors);
        
        if (competitorCitations.length > 0) {
          // Calculate impact score
          const impactScore = await this.impactCalculator.calculateImpact(
            domain,
            authority,
            competitorCitations.length,
            competitorCitations
          );
          
          // Only include high-impact opportunities
          if (impactScore >= 30) {
            const opportunity: CitationOpportunity = {
              id: this.generateId(),
              workspaceId,
              domain,
              domainAuthority: authority,
              citationCount: competitorCitations.length,
              impactScore,
              status: 'identified',
              competitorsCited: competitorCitations.map(c => c.competitor),
              lastAnalyzed: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            opportunities.push(opportunity);
          }
        }
      }
      
      // Sort by impact score (highest first)
      opportunities.sort((a, b) => b.impactScore - a.impactScore);
      
      return opportunities;
    } catch (error) {
      console.error('Citation opportunity identification failed:', error);
      throw new Error(`Failed to identify opportunities: ${error.message}`);
    }
  }

  /**
   * Analyze competitor citation patterns
   */
  async analyzeCompetitorPatterns(
    workspaceId: string,
    scanResults: any[],
    competitors: string[]
  ): Promise<CompetitorAnalysis[]> {
    const competitorAnalyses: CompetitorAnalysis[] = [];
    
    for (const competitor of competitors) {
      const competitorCitations = this.extractCompetitorCitations(scanResults, competitor);
      const domainMap = new Map<string, number>();
      
      // Count citations per domain
      competitorCitations.forEach(citation => {
        const domain = this.extractDomain(citation.url);
        domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
      });
      
      // Calculate domain authorities
      const domainAuthorities = new Map<string, number>();
      for (const domain of domainMap.keys()) {
        domainAuthorities.set(domain, await this.domainAnalyzer.calculateAuthority(domain));
      }
      
      // Create top domains list
      const topDomains = Array.from(domainMap.entries())
        .map(([domain, citations]) => ({
          domain,
          authority: domainAuthorities.get(domain) || 0,
          citations
        }))
        .sort((a, b) => b.citations - a.citations)
        .slice(0, 10);
      
      const analysis: CompetitorAnalysis = {
        competitor,
        citationCount: competitorCitations.length,
        domains: Array.from(domainMap.keys()),
        averageAuthority: Array.from(domainAuthorities.values()).reduce((a, b) => a + b, 0) / domainAuthorities.size,
        topDomains
      };
      
      competitorAnalyses.push(analysis);
    }
    
    return competitorAnalyses;
  }

  /**
   * Get detailed analysis for a specific domain
   */
  async analyzeDomain(
    domain: string,
    scanResults: any[],
    competitors: string[]
  ): Promise<CitationAnalysis> {
    const citations = this.extractCitationsFromResults(scanResults)
      .filter(citation => this.extractDomain(citation.url) === domain);
    
    const authority = await this.domainAnalyzer.calculateAuthority(domain);
    
    const competitorCitations = this.countCompetitorCitations(citations, competitors);
    
    const impactScore = await this.impactCalculator.calculateImpact(
      domain,
      authority,
      competitorCitations.length,
      competitorCitations
    );
    
    const recommendedAction = this.generateRecommendation(domain, authority, competitorCitations);
    
    return {
      domain,
      authority,
      citations: competitorCitations,
      opportunityScore: impactScore,
      recommendedAction
    };
  }

  /**
   * Update opportunity status
   */
  async updateOpportunityStatus(
    opportunityId: string,
    status: 'identified' | 'outreach' | 'cited'
  ): Promise<void> {
    // TODO: Implement database update
    console.log(`Updating opportunity ${opportunityId} status to ${status}`);
  }

  /**
   * Track outreach progress
   */
  async trackOutreach(
    opportunityId: string,
    action: 'email_sent' | 'follow_up' | 'response_received' | 'cited',
    details?: string
  ): Promise<void> {
    // TODO: Implement outreach tracking
    console.log(`Tracking outreach for opportunity ${opportunityId}: ${action}`, details);
  }

  /**
   * Extract citations from scan results
   */
  private extractCitationsFromResults(scanResults: any[]): Array<{
    url: string;
    domain: string;
    context: string;
    engine: string;
    competitor?: string;
  }> {
    const citations: Array<{
      url: string;
      domain: string;
      context: string;
      engine: string;
      competitor?: string;
    }> = [];
    
    scanResults.forEach(result => {
      if (result.citations && Array.isArray(result.citations)) {
        result.citations.forEach((citation: any) => {
          citations.push({
            url: citation.url,
            domain: this.extractDomain(citation.url),
            context: citation.context || '',
            engine: result.engine,
            competitor: citation.competitor
          });
        });
      }
    });
    
    return citations;
  }

  /**
   * Group citations by domain
   */
  private groupCitationsByDomain(citations: Array<{
    url: string;
    domain: string;
    context: string;
    engine: string;
    competitor?: string;
  }>): Map<string, Array<{
    url: string;
    domain: string;
    context: string;
    engine: string;
    competitor?: string;
  }>> {
    const domainMap = new Map<string, Array<{
      url: string;
      domain: string;
      context: string;
      engine: string;
      competitor?: string;
    }>>();
    
    citations.forEach(citation => {
      if (!domainMap.has(citation.domain)) {
        domainMap.set(citation.domain, []);
      }
      domainMap.get(citation.domain)!.push(citation);
    });
    
    return domainMap;
  }

  /**
   * Check if workspace is already cited on domain
   */
  private isWorkspaceCited(
    domain: string,
    citations: Array<{
      url: string;
      domain: string;
      context: string;
      engine: string;
      competitor?: string;
    }>,
    workspaceId: string
  ): boolean {
    // Mock implementation - in real implementation, check against workspace brand names
    return citations.some(citation => 
      citation.context.toLowerCase().includes('ai visibility platform')
    );
  }

  /**
   * Count citations for competitors
   */
  private countCompetitorCitations(
    citations: Array<{
      url: string;
      domain: string;
      context: string;
      engine: string;
      competitor?: string;
    }>,
    competitors: string[]
  ): Array<{
    competitor: string;
    frequency: number;
    context: string;
    sentiment: 'positive' | 'neutral' | 'negative';
  }> {
    const competitorCounts = new Map<string, {
      frequency: number;
      contexts: string[];
      sentiments: ('positive' | 'neutral' | 'negative')[];
    }>();
    
    citations.forEach(citation => {
      competitors.forEach(competitor => {
        if (citation.context.toLowerCase().includes(competitor.toLowerCase())) {
          if (!competitorCounts.has(competitor)) {
            competitorCounts.set(competitor, {
              frequency: 0,
              contexts: [],
              sentiments: []
            });
          }
          
          const count = competitorCounts.get(competitor)!;
          count.frequency++;
          count.contexts.push(citation.context);
          count.sentiments.push(this.analyzeSentiment(citation.context));
        }
      });
    });
    
    return Array.from(competitorCounts.entries()).map(([competitor, data]) => ({
      competitor,
      frequency: data.frequency,
      context: data.contexts.join('; '),
      sentiment: this.getOverallSentiment(data.sentiments)
    }));
  }

  /**
   * Extract competitor citations from scan results
   */
  private extractCompetitorCitations(scanResults: any[], competitor: string): Array<{
    url: string;
    context: string;
    engine: string;
  }> {
    const citations: Array<{
      url: string;
      context: string;
      engine: string;
    }> = [];
    
    scanResults.forEach(result => {
      if (result.citations && Array.isArray(result.citations)) {
        result.citations.forEach((citation: any) => {
          if (citation.context && citation.context.toLowerCase().includes(competitor.toLowerCase())) {
            citations.push({
              url: citation.url,
              context: citation.context,
              engine: result.engine
            });
          }
        });
      }
    });
    
    return citations;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  /**
   * Analyze sentiment of citation context
   */
  private analyzeSentiment(context: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['best', 'excellent', 'top', 'recommended', 'great', 'outstanding'];
    const negativeWords = ['worst', 'terrible', 'bad', 'avoid', 'poor', 'awful'];
    
    const lowerContext = context.toLowerCase();
    
    const positiveCount = positiveWords.filter(word => lowerContext.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContext.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Get overall sentiment from multiple sentiments
   */
  private getOverallSentiment(sentiments: ('positive' | 'neutral' | 'negative')[]): 'positive' | 'neutral' | 'negative' {
    const positiveCount = sentiments.filter(s => s === 'positive').length;
    const negativeCount = sentiments.filter(s => s === 'negative').length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Generate recommendation based on analysis
   */
  private generateRecommendation(
    domain: string,
    authority: number,
    competitorCitations: Array<{
      competitor: string;
      frequency: number;
      context: string;
      sentiment: 'positive' | 'neutral' | 'negative';
    }>
  ): string {
    if (authority >= 80) {
      return `High-authority domain (${authority}). Reach out to ${domain} for potential citation. Focus on providing unique value proposition.`;
    } else if (authority >= 60) {
      return `Medium-authority domain (${authority}). Consider outreach to ${domain} if resources allow.`;
    } else {
      return `Lower-authority domain (${authority}). Monitor for future opportunities.`;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `opp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
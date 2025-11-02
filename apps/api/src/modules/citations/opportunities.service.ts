import { Injectable } from '@nestjs/common';
import { CitationOpportunityService, DomainAnalyzerService, ImpactCalculatorService } from '@ai-visibility/geo';

@Injectable()
export class OpportunitiesApiService {
  constructor(
    private opportunityService: CitationOpportunityService,
    private domainAnalyzer: DomainAnalyzerService,
    private impactCalculator: ImpactCalculatorService
  ) {}

  /**
   * Wrapper for opportunity analysis with API-specific logic
   */
  async analyzeOpportunitiesForApi(
    workspaceId: string,
    scanResults: any[],
    competitors: string[],
    options: any = {}
  ) {
    return this.opportunityService.identifyOpportunities(
      workspaceId,
      scanResults,
      competitors
    );
  }

  /**
   * Wrapper for competitor analysis with API-specific logic
   */
  async analyzeCompetitorsForApi(
    workspaceId: string,
    scanResults: any[],
    competitors: string[]
  ) {
    return this.opportunityService.analyzeCompetitorPatterns(
      workspaceId,
      scanResults,
      competitors
    );
  }

  /**
   * Wrapper for domain analysis with API-specific logic
   */
  async analyzeDomainForApi(
    domain: string,
    scanResults: any[],
    competitors: string[]
  ) {
    return this.opportunityService.analyzeDomain(
      domain,
      scanResults,
      competitors
    );
  }

  /**
   * Wrapper for domain metrics with API-specific logic
   */
  async getDomainMetricsForApi(domain: string) {
    return this.domainAnalyzer.getDomainMetrics(domain);
  }

  /**
   * Wrapper for impact calculation with API-specific logic
   */
  async calculateImpactForApi(
    domain: string,
    authority: number,
    citationCount: number,
    competitorCitations: any[]
  ) {
    return this.impactCalculator.getDetailedImpactAnalysis(
      domain,
      authority,
      citationCount,
      competitorCitations
    );
  }
}
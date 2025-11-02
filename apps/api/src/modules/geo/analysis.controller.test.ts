/**
 * GEO Analysis Controller (Test Mode - No Auth)
 * Provides endpoint to analyze a website/domain with full GEO analysis
 */

import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import {
  EnhancedGEOScoringService,
  KnowledgeGraphBuilder,
  TrustSignalAggregator,
  EvidenceGraphBuilderService,
  GEOMaturityCalculatorService,
  EEATCalculatorService,
  DashboardAggregatorService,
  PrescriptiveRecommendationEngine,
  StructuralScoringService,
  type GEOVisibilityScore,
  type ScoringContext,
} from '@ai-visibility/geo';

@Controller('geo/analyze')
export class AnalysisControllerTest {
  constructor(
    private scoringService: EnhancedGEOScoringService,
    private knowledgeGraphBuilder: KnowledgeGraphBuilder,
    private trustAggregator: TrustSignalAggregator,
    private evidenceBuilder: EvidenceGraphBuilderService,
    private maturityCalculator: GEOMaturityCalculatorService,
    private eeatCalculator: EEATCalculatorService,
    private dashboardAggregator: DashboardAggregatorService,
    private recommendationEngine: PrescriptiveRecommendationEngine,
    private structuralScoring: StructuralScoringService,
  ) {}

  @Post('website')
  async analyzeWebsite(
    @Body() body: { url: string; workspaceId?: string; brandName?: string }
  ): Promise<{
    ok: boolean;
    data: {
      url: string;
      domain: string;
      brandName: string;
      workspaceId: string;
      visibilityScore?: GEOVisibilityScore;
      knowledgeGraph?: any;
      trustProfile?: any;
      evidenceGraph?: any;
      maturityScore?: any;
      eeatScore?: any;
      recommendations?: any[];
      structuralScore?: any;
      summary: {
        overallScore: number;
        status: 'excellent' | 'good' | 'fair' | 'poor';
        keyFindings: string[];
        topRecommendations: string[];
      };
    } | null;
    error?: string;
  }> {
    try {
      const { url, workspaceId = 'test-workspace-id', brandName } = body;

      if (!url) {
        return {
          ok: false,
          data: null,
          error: 'URL is required',
        };
      }

      // Extract domain and brand name from URL
      let domain: string;
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        domain = urlObj.hostname.replace('www.', '');
      } catch (error) {
        domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      }

      const extractedBrandName = brandName || domain.split('.')[0] || 'Unknown Brand';

      console.log(`🌐 Starting GEO analysis for: ${domain} (${extractedBrandName})`);

      // Run all analyses in parallel
      const [
        visibilityScore,
        knowledgeGraph,
        trustProfile,
        evidenceGraph,
        maturityScore,
        eeatScore,
        recommendations,
        structuralScore,
      ] = await Promise.allSettled([
        this.calculateVisibilityScore(extractedBrandName, domain, workspaceId),
        this.buildKnowledgeGraph(extractedBrandName, workspaceId),
        this.getTrustProfile(extractedBrandName, workspaceId, domain),
        this.buildEvidenceGraph(workspaceId),
        this.calculateMaturityScore(workspaceId),
        this.calculateEEATScore(workspaceId),
        this.getRecommendations(workspaceId),
        this.calculateStructuralScore(url),
      ]);

      // Extract results (handle errors gracefully)
      const results = {
        url,
        domain,
        brandName: extractedBrandName,
        workspaceId,
        visibilityScore: visibilityScore.status === 'fulfilled' && visibilityScore.value ? visibilityScore.value : undefined,
        knowledgeGraph: knowledgeGraph.status === 'fulfilled' && knowledgeGraph.value ? knowledgeGraph.value : undefined,
        trustProfile: trustProfile.status === 'fulfilled' && trustProfile.value ? trustProfile.value : undefined,
        evidenceGraph: evidenceGraph.status === 'fulfilled' && evidenceGraph.value ? evidenceGraph.value : undefined,
        maturityScore: maturityScore.status === 'fulfilled' && maturityScore.value ? maturityScore.value : undefined,
        eeatScore: eeatScore.status === 'fulfilled' && eeatScore.value ? eeatScore.value : undefined,
        recommendations: recommendations.status === 'fulfilled' && recommendations.value ? recommendations.value : undefined,
        structuralScore: structuralScore.status === 'fulfilled' && structuralScore.value ? structuralScore.value : undefined,
        summary: this.generateSummary(
          visibilityScore,
          maturityScore,
          eeatScore,
          recommendations,
        ),
      };

      return {
        ok: true,
        data: results,
      };
    } catch (error) {
      console.error('Error analyzing website:', error);
      return {
        ok: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  @Get('website')
  async analyzeWebsiteGet(
    @Query('url') url: string,
    @Query('workspaceId') workspaceId?: string,
    @Query('brandName') brandName?: string,
  ): Promise<any> {
    return this.analyzeWebsite({ url, workspaceId, brandName });
  }

  private async calculateVisibilityScore(
    brandName: string,
    domain: string,
    workspaceId: string,
  ): Promise<GEOVisibilityScore | null> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const context: ScoringContext = {
        workspaceId,
        brandName,
        competitors: [],
        timeRange: {
          start: thirtyDaysAgo,
          end: now,
        },
        engines: ['perplexity', 'aio', 'brave', 'openai', 'anthropic', 'gemini'],
        industry: 'technology',
      };

      // Mock data - in production, fetch from database
      const rawData = {
        mentions: [],
        citations: [],
        rankings: [],
        competitorData: [],
        structuralScore: 0,
      };

      return await this.scoringService.calculateVisibilityScore(context, rawData);
    } catch (error) {
      console.warn('Visibility score calculation failed:', error);
      return null;
    }
  }

  private async buildKnowledgeGraph(brandName: string, workspaceId: string): Promise<any> {
    try {
      // Mock AI responses and business data for now
      const aiResponses: any[] = [];
      const businessData: any = {};
      return await this.knowledgeGraphBuilder.buildKnowledgeGraph(workspaceId, brandName, aiResponses, businessData);
    } catch (error) {
      console.warn('Knowledge graph build failed:', error);
      return null;
    }
  }

  private async getTrustProfile(brandName: string, workspaceId: string, domain: string): Promise<any> {
    try {
      // aggregateTrustSignals expects: domain, entityType, optional timeRange
      return await this.trustAggregator.aggregateTrustSignals(domain, 'brand');
    } catch (error) {
      console.warn('Trust profile aggregation failed:', error);
      return null;
    }
  }

  private async buildEvidenceGraph(workspaceId: string): Promise<any> {
    try {
      if (!this.evidenceBuilder) {
        return null;
      }
      return await this.evidenceBuilder.buildEvidenceGraph(workspaceId);
    } catch (error) {
      console.warn('Evidence graph build failed:', error);
      return null;
    }
  }

  private async calculateMaturityScore(workspaceId: string): Promise<any> {
    try {
      return await this.maturityCalculator.calculateMaturityScore(workspaceId);
    } catch (error) {
      console.warn('Maturity score calculation failed:', error);
      return null;
    }
  }

  private async calculateEEATScore(workspaceId: string): Promise<any> {
    try {
      return await this.eeatCalculator.calculateEEATScore(workspaceId);
    } catch (error) {
      console.warn('E-E-A-T score calculation failed:', error);
      return null;
    }
  }

  private async getRecommendations(workspaceId: string): Promise<any[]> {
    try {
      return await this.recommendationEngine.generateRecommendations(workspaceId);
    } catch (error) {
      console.warn('Recommendations generation failed:', error);
      return [];
    }
  }

  private async calculateStructuralScore(url: string): Promise<any> {
    try {
      // This would fetch and analyze the webpage structure
      // For now, return a mock score
      return {
        score: 0,
        schemaMarkup: false,
        freshness: null,
        structure: null,
      };
    } catch (error) {
      console.warn('Structural score calculation failed:', error);
      return null;
    }
  }

  private generateSummary(
    visibilityScore: PromiseSettledResult<any>,
    maturityScore: PromiseSettledResult<any>,
    eeatScore: PromiseSettledResult<any>,
    recommendations: PromiseSettledResult<any[]>,
  ): {
    overallScore: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
    keyFindings: string[];
    topRecommendations: string[];
  } {
    const scores: number[] = [];

    if (visibilityScore.status === 'fulfilled' && visibilityScore.value) {
      scores.push(visibilityScore.value.overallScore || 0);
    }
    if (maturityScore.status === 'fulfilled' && maturityScore.value) {
      scores.push(maturityScore.value.overallScore || 0);
    }
    if (eeatScore.status === 'fulfilled' && eeatScore.value) {
      scores.push(eeatScore.value.overallScore || 0);
    }

    const overallScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    let status: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    if (overallScore >= 80) status = 'excellent';
    else if (overallScore >= 60) status = 'good';
    else if (overallScore >= 40) status = 'fair';

    const keyFindings: string[] = [];
    if (eeatScore.status === 'fulfilled' && eeatScore.value) {
      if (eeatScore.value.level === 'low') {
        keyFindings.push('E-E-A-T scores indicate low trustworthiness and authority');
      }
    }
    if (maturityScore.status === 'fulfilled' && maturityScore.value) {
      if (maturityScore.value.maturityLevel === 'emerging') {
        keyFindings.push('GEO maturity is in early stages');
      }
    }

    const topRecommendations: string[] = [];
    if (recommendations.status === 'fulfilled' && recommendations.value) {
      topRecommendations.push(
        ...recommendations.value
          .slice(0, 5)
          .map((r: any) => r.message || r.type)
          .filter(Boolean),
      );
    }

    if (keyFindings.length === 0) {
      keyFindings.push('Limited data available for analysis');
    }

    return {
      overallScore,
      status,
      keyFindings,
      topRecommendations: topRecommendations.slice(0, 5),
    };
  }
}


/**
 * Prescriptive Recommendation Engine
 * Generates actionable, count-based recommendations for GEO optimization
 */

import { Injectable } from '@nestjs/common';
import { GEOMaturityCalculatorService, GEOMaturityScore } from './maturity-calculator.service';
import { StructuralScoringService } from '../structural/structural-scoring.service';
import { EvidenceGraphBuilderService } from '../evidence/evidence-graph.builder';
import { CopilotActionType } from '@ai-visibility/shared';
import { Pool } from 'pg';

export interface Recommendation {
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  action: CopilotActionType;
  estimatedImpact: number;
  effort: 'low' | 'medium' | 'high';
  targetUrl?: string;
  targetDomain?: string;
}

@Injectable()
export class PrescriptiveRecommendationEngine {
  private dbPool: Pool;

  constructor(
    private maturityCalculator: GEOMaturityCalculatorService,
    private structuralScoring: StructuralScoringService,
    private evidenceBuilder: EvidenceGraphBuilderService
  ) {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Generate recommendations for workspace
   */
  async generateRecommendations(workspaceId: string): Promise<Recommendation[]> {
    try {
      const recommendations: Recommendation[] = [];

      // Get maturity score
      const maturityScore = await this.maturityCalculator.calculateMaturityScore(workspaceId);

      // Analyze gaps and generate recommendations
      recommendations.push(...await this.analyzeCitationGaps(workspaceId, maturityScore));
      recommendations.push(...await this.analyzeSchemaGaps(workspaceId));
      recommendations.push(...await this.analyzeRedditPresence(workspaceId));
      recommendations.push(...await this.analyzeFreshnessGaps(workspaceId));

      // Sort by priority and estimated impact
      return recommendations.sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.estimatedImpact - a.estimatedImpact;
      });
    } catch (error) {
      console.error(`Error generating recommendations for ${workspaceId}:`, error);
      return [];
    }
  }

  /**
   * Analyze citation gaps
   */
  private async analyzeCitationGaps(
    workspaceId: string,
    maturityScore: GEOMaturityScore
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Get evidence graph
    const evidenceGraph = await this.evidenceBuilder.buildEvidenceGraph(workspaceId);
    const metadata = evidenceGraph.metadata;

    // Licensed publisher gap
    const licensedCount = metadata.licensedPublisherCount;
    if (licensedCount < 3) {
      const needed = 3 - licensedCount;
      recommendations.push({
        type: 'citation_gap',
        priority: 'high',
        message: `You need ${needed} more trusted citations from licensed publishers (News Corp, FT, Axel Springer, AP)`,
        action: CopilotActionType.ADD_CITATIONS,
        estimatedImpact: 15,
        effort: 'medium',
      });
    }

    // Reddit gap
    const redditCount = metadata.redditMentionCount;
    if (redditCount < 5) {
      const needed = 5 - redditCount;
      recommendations.push({
        type: 'reddit_presence',
        priority: 'medium',
        message: `Reddit presence weak - create ${needed} policy-compliant threads (AMAs, how-tos, case studies)`,
        action: CopilotActionType.ADD_CITATIONS,
        estimatedImpact: 8,
        effort: 'high',
      });
    }

    // Directory gap
    const directoryCount = metadata.directoryCount;
    if (directoryCount < 5) {
      recommendations.push({
        type: 'directory_gap',
        priority: 'medium',
        message: `Only ${directoryCount} directory listings found - claim listings on GBP, Bing Places, G2, Capterra, Trustpilot`,
        action: CopilotActionType.ADD_CITATIONS,
        estimatedImpact: 10,
        effort: 'medium',
      });
    }

    // Citation depth gap
    if (maturityScore.citationDepth < 50) {
      recommendations.push({
        type: 'citation_depth',
        priority: 'high',
        message: `Citation depth is ${Math.round(maturityScore.citationDepth)}/100 - focus on building citations across multiple source types`,
        action: CopilotActionType.ADD_CITATIONS,
        estimatedImpact: 20,
        effort: 'high',
      });
    }

    return recommendations;
  }

  /**
   * Analyze schema gaps
   */
  private async analyzeSchemaGaps(workspaceId: string): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    try {
      const structuralScore = await this.structuralScoring.calculateStructuralScore(workspaceId);

      // Check schema recommendations
      const schemaRecommendations = structuralScore.recommendations.filter(r => 
        r.toLowerCase().includes('schema') || r.toLowerCase().includes('organization')
      );

      for (const rec of schemaRecommendations) {
        if (rec.includes('Organization')) {
          recommendations.push({
            type: 'schema_missing',
            priority: 'high',
            message: rec,
            action: CopilotActionType.FIX_SCHEMA,
            estimatedImpact: 10,
            effort: 'low',
            targetUrl: rec.includes(':') ? rec.split(':')[0] : undefined,
          });
        } else if (rec.includes('LocalBusiness')) {
          recommendations.push({
            type: 'schema_missing',
            priority: 'high',
            message: rec,
            action: CopilotActionType.FIX_SCHEMA,
            estimatedImpact: 10,
            effort: 'low',
            targetUrl: rec.includes(':') ? rec.split(':')[0] : undefined,
          });
        }
      }

      if (structuralScore.schemaScore < 50) {
        recommendations.push({
          type: 'schema_completeness',
          priority: 'medium',
          message: `Schema coverage is ${structuralScore.schemaScore}/100 - add Organization, LocalBusiness, Product, FAQ, or HowTo schemas`,
          action: CopilotActionType.FIX_SCHEMA,
          estimatedImpact: 8,
          effort: 'low',
        });
      }
    } catch (error) {
      console.error('Error analyzing schema gaps:', error);
    }

    return recommendations;
  }

  /**
   * Analyze Reddit presence
   */
  private async analyzeRedditPresence(workspaceId: string): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    try {
      const evidenceGraph = await this.evidenceBuilder.buildEvidenceGraph(workspaceId);
      const redditCount = evidenceGraph.metadata.redditMentionCount;

      if (redditCount < 5) {
        recommendations.push({
          type: 'reddit_presence',
          priority: 'medium',
          message: `Reddit presence weak - create 3 policy-compliant threads (AMAs, how-tos, case studies)`,
          action: CopilotActionType.ADD_CITATIONS,
          estimatedImpact: 8,
          effort: 'high',
        });
      }
    } catch (error) {
      console.error('Error analyzing Reddit presence:', error);
    }

    return recommendations;
  }

  /**
   * Analyze freshness gaps
   */
  private async analyzeFreshnessGaps(workspaceId: string): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    try {
      const structuralScore = await this.structuralScoring.calculateStructuralScore(workspaceId);

      // Find stale page recommendations
      const staleRecommendations = structuralScore.recommendations.filter(r =>
        r.toLowerCase().includes('stale') || r.toLowerCase().includes('updated')
      );

      for (const rec of staleRecommendations) {
        const urlMatch = rec.match(/https?:\/\/[^\s]+/);
        recommendations.push({
          type: 'freshness',
          priority: 'medium',
          message: rec,
          action: CopilotActionType.ADD_TLDR, // Using ADD_TLDR as proxy for content update
          estimatedImpact: 5,
          effort: 'low',
          targetUrl: urlMatch ? urlMatch[0] : undefined,
        });
      }

      if (structuralScore.freshnessScore < 50) {
        recommendations.push({
          type: 'freshness_overall',
          priority: 'medium',
          message: `Overall freshness score is ${structuralScore.freshnessScore}/100 - update stale pages and add "last updated" timestamps`,
          action: CopilotActionType.ADD_TLDR,
          estimatedImpact: 6,
          effort: 'medium',
        });
      }
    } catch (error) {
      console.error('Error analyzing freshness gaps:', error);
    }

    return recommendations;
  }
}



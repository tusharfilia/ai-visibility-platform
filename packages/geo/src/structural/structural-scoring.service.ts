/**
 * Structural Scoring Service
 * Orchestrates schema, freshness, and structure analysis
 */

import { Injectable } from '@nestjs/common';
import { SchemaAuditorService } from './schema-auditor';
import { FreshnessAnalyzerService } from './freshness-analyzer';
import { PageStructureAnalyzerService } from './page-structure-analyzer';
import Redis from 'ioredis';

export interface StructuralScore {
  schemaScore: number;      // 0-100
  freshnessScore: number;   // 0-100
  structureScore: number;    // 0-100
  overall: number;           // Weighted average
  recommendations: string[];
}

@Injectable()
export class StructuralScoringService {
  private redis: Redis;
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private schemaAuditor: SchemaAuditorService,
    private freshnessAnalyzer: FreshnessAnalyzerService,
    private pageStructureAnalyzer: PageStructureAnalyzerService
  ) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('[StructuralScoringService] REDIS_URL is not configured');
    }
    this.redis = new Redis(redisUrl);
  }

  /**
   * Calculate structural score for workspace
   */
  async calculateStructuralScore(workspaceId: string): Promise<StructuralScore> {
    // Check cache
    const cacheKey = `structural_score:${workspaceId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Get workspace profile to find key pages
      const keyPages = await this.getKeyPages(workspaceId);
      
      if (keyPages.length === 0) {
        return {
          schemaScore: 0,
          freshnessScore: 0,
          structureScore: 0,
          overall: 0,
          recommendations: ['No key pages found for workspace'],
        };
      }

      // Analyze each page
      const schemaScores: number[] = [];
      const freshnessScores: number[] = [];
      const structureScores: number[] = [];
      const allRecommendations: string[] = [];

      for (const page of keyPages) {
        try {
          // Schema audit
          const schemaAudit = await this.schemaAuditor.auditPage(page.url);
          schemaScores.push(schemaAudit.coverageScore);
          allRecommendations.push(...schemaAudit.recommendations.map(r => `${page.url}: ${r}`));

          // Freshness analysis
          const freshnessAnalysis = await this.freshnessAnalyzer.analyzeFreshness(page.url);
          freshnessScores.push(freshnessAnalysis.freshnessScore);
          if (freshnessAnalysis.isStale) {
            allRecommendations.push(`${page.url}: Page is stale (last updated ${freshnessAnalysis.ageInDays} days ago)`);
          }

          // Structure analysis
          const structureAnalysis = await this.pageStructureAnalyzer.analyzeStructure(page.url);
          structureScores.push(structureAnalysis.structureScore);
          allRecommendations.push(...structureAnalysis.recommendations.map(r => `${page.url}: ${r}`));
        } catch (error) {
          console.warn(`Failed to analyze ${page.url}:`, error);
          // Continue with other pages
        }
      }

      // Calculate averages
      const schemaScore = schemaScores.length > 0
        ? Math.round(schemaScores.reduce((sum, s) => sum + s, 0) / schemaScores.length)
        : 0;

      const freshnessScore = freshnessScores.length > 0
        ? Math.round(freshnessScores.reduce((sum, s) => sum + s, 0) / freshnessScores.length)
        : 0;

      const structureScore = structureScores.length > 0
        ? Math.round(structureScores.reduce((sum, s) => sum + s, 0) / structureScores.length)
        : 0;

      // Weighted overall score (equal weights for now)
      const overall = Math.round(
        (schemaScore * 0.33) + (freshnessScore * 0.33) + (structureScore * 0.34)
      );

      // Deduplicate recommendations
      const uniqueRecommendations = Array.from(new Set(allRecommendations));

      const result: StructuralScore = {
        schemaScore,
        freshnessScore,
        structureScore,
        overall,
        recommendations: uniqueRecommendations,
      };

      // Cache result
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result));

      return result;
    } catch (error) {
      console.error(`Error calculating structural score for ${workspaceId}:`, error);
      return {
        schemaScore: 0,
        freshnessScore: 0,
        structureScore: 0,
        overall: 0,
        recommendations: ['Error calculating structural score'],
      };
    }
  }

  /**
   * Get key pages for workspace (homepage, about, services, etc.)
   */
  private async getKeyPages(workspaceId: string): Promise<Array<{ url: string; type: string }>> {
    // In production, this would query the database for workspace pages
    // For now, return a default set based on workspace profile
    try {
      // This would be a database query in production
      // For now, return empty array - actual implementation would query WorkspaceProfile
      return [];
    } catch (error) {
      console.warn(`Failed to get key pages for ${workspaceId}:`, error);
      return [];
    }
  }

  /**
   * Clear cache for workspace
   */
  async clearCache(workspaceId: string): Promise<void> {
    const cacheKey = `structural_score:${workspaceId}`;
    await this.redis.del(cacheKey);
  }
}



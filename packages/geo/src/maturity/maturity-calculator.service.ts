/**
 * GEO Maturity Calculator Service
 * Calculates 4-dimension GEO maturity score
 */

import { Injectable } from '@nestjs/common';
import { StructuralScoringService } from '../structural/structural-scoring.service';
import { EvidenceGraphBuilderService } from '../evidence/evidence-graph.builder';
import { Pool } from 'pg';

export interface GEOMaturityScore {
  entityStrength: number;      // 0-100
  citationDepth: number;       // 0-100
  structuralClarity: number;   // 0-100
  updateCadence: number;       // 0-100
  overallScore: number;        // Weighted composite
  maturityLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  recommendations: any[];      // Will be populated by PrescriptiveRecommendationEngine
}

@Injectable()
export class GEOMaturityCalculatorService {
  private dbPool: Pool;

  constructor(
    private structuralScoring: StructuralScoringService,
    private evidenceBuilder: EvidenceGraphBuilderService
  ) {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Calculate maturity score for workspace
   */
  async calculateMaturityScore(workspaceId: string): Promise<GEOMaturityScore> {
    try {
      // Calculate 4 dimensions in parallel
      const [entityStrength, citationDepth, structuralClarity, updateCadence] = await Promise.all([
        this.calculateEntityStrength(workspaceId),
        this.calculateCitationDepth(workspaceId),
        this.calculateStructuralClarity(workspaceId),
        this.calculateUpdateCadence(workspaceId),
      ]);

      // Calculate overall score with weights (per audit)
      const overallScore = Math.round(
        entityStrength * 0.30 +
        citationDepth * 0.35 +
        structuralClarity * 0.20 +
        updateCadence * 0.15
      );

      // Determine maturity level
      const maturityLevel = this.determineMaturityLevel(overallScore);

      // Store in database
      await this.storeMaturityScore(workspaceId, {
        entityStrength,
        citationDepth,
        structuralClarity,
        updateCadence,
        overallScore,
        maturityLevel,
        recommendations: [], // Will be populated by PrescriptiveRecommendationEngine
      });

      return {
        entityStrength,
        citationDepth,
        structuralClarity,
        updateCadence,
        overallScore,
        maturityLevel,
        recommendations: [],
      };
    } catch (error) {
      console.error(`Error calculating maturity score for ${workspaceId}:`, error);
      throw new Error(`Failed to calculate maturity score: ${error.message}`);
    }
  }

  /**
   * Calculate entity strength (KG completeness, verified presence)
   */
  private async calculateEntityStrength(workspaceId: string): Promise<number> {
    try {
      // Get workspace profile
      const profileResult = await this.dbPool.query(
        'SELECT * FROM "WorkspaceProfile" WHERE "workspaceId" = $1',
        [workspaceId]
      );
      
      const profile = profileResult.rows[0];
      if (!profile) {
        return 0;
      }

      // Build knowledge graph
      const knowledgeGraph = await this.evidenceBuilder.buildEvidenceGraph(workspaceId);

      // Calculate KG completeness (0-25)
      let kgCompleteness = 0;
      if (profile.businessName) kgCompleteness += 5;
      if (profile.description) kgCompleteness += 5;
      if (profile.address) kgCompleteness += 5;
      if (knowledgeGraph.evidenceNodes.length > 5) kgCompleteness += 5;
      if (knowledgeGraph.evidenceNodes.length > 10) kgCompleteness += 5;

      // Verified presence (0-25)
      let verifiedPresence = 0;
      if (profile.verified) verifiedPresence += 10;
      const verifiedEvidence = knowledgeGraph.evidenceNodes.filter(n => n.verified).length;
      if (verifiedEvidence > 0) verifiedPresence += 10;
      if (verifiedEvidence > 2) verifiedPresence += 5;

      // Evidence graph strength (0-25)
      let evidenceStrength = 0;
      if (knowledgeGraph.evidenceNodes.length > 10) evidenceStrength += 10;
      if (knowledgeGraph.consensusScore > 70) evidenceStrength += 10;
      const licensedCount = knowledgeGraph.metadata.licensedPublisherCount;
      if (licensedCount > 2) evidenceStrength += 5;

      // Industry recognition (0-25)
      let industryRecognition = 0;
      // In production, check for awards, press mentions, partnerships
      // For now, use evidence authority as proxy
      if (knowledgeGraph.metadata.averageAuthority > 0.7) industryRecognition += 25;

      return Math.min(100, kgCompleteness + verifiedPresence + evidenceStrength + industryRecognition);
    } catch (error) {
      console.error(`Error calculating entity strength:`, error);
      return 0;
    }
  }

  /**
   * Calculate citation depth (count + quality across source types)
   */
  private async calculateCitationDepth(workspaceId: string): Promise<number> {
    try {
      // Get evidence graph
      const evidenceGraph = await this.evidenceBuilder.buildEvidenceGraph(workspaceId);
      const metadata = evidenceGraph.metadata;

      // Calculate depth score (0-100)
      let depthScore = 0;

      // Total evidence count (0-30)
      if (metadata.totalEvidence > 0) depthScore += Math.min(30, metadata.totalEvidence * 2);
      
      // Source type diversity (0-25)
      const sourceTypes = new Set(evidenceGraph.evidenceNodes.map(n => n.sourceType));
      depthScore += sourceTypes.size * 5; // Max 25 for 5 source types

      // Licensed publisher presence (0-25)
      if (metadata.licensedPublisherCount > 0) depthScore += Math.min(25, metadata.licensedPublisherCount * 8);
      
      // Average authority (0-20)
      depthScore += Math.min(20, metadata.averageAuthority * 20);

      return Math.min(100, depthScore);
    } catch (error) {
      console.error(`Error calculating citation depth:`, error);
      return 0;
    }
  }

  /**
   * Calculate structural clarity (uses StructuralScoringService)
   */
  private async calculateStructuralClarity(workspaceId: string): Promise<number> {
    try {
      const structuralScore = await this.structuralScoring.calculateStructuralScore(workspaceId);
      return structuralScore.overall;
    } catch (error) {
      console.error(`Error calculating structural clarity:`, error);
      return 0;
    }
  }

  /**
   * Calculate update cadence (freshness analysis across key pages)
   */
  private async calculateUpdateCadence(workspaceId: string): Promise<number> {
    try {
      // Get structural score which includes freshness
      const structuralScore = await this.structuralScoring.calculateStructuralScore(workspaceId);
      
      // Use freshness score as update cadence indicator
      return structuralScore.freshnessScore;
    } catch (error) {
      console.error(`Error calculating update cadence:`, error);
      return 0;
    }
  }

  /**
   * Determine maturity level from overall score
   */
  private determineMaturityLevel(overallScore: number): GEOMaturityScore['maturityLevel'] {
    if (overallScore < 40) return 'beginner';
    if (overallScore < 60) return 'intermediate';
    if (overallScore < 80) return 'advanced';
    return 'expert';
  }

  /**
   * Store maturity score in database
   */
  private async storeMaturityScore(workspaceId: string, score: GEOMaturityScore): Promise<void> {
    try {
      await this.dbPool.query(`
        INSERT INTO "geo_maturity_scores" 
        ("workspaceId", "entityStrength", "citationDepth", "structuralClarity", "updateCadence", 
         "overallScore", "maturityLevel", "recommendations", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        ON CONFLICT ("workspaceId") 
        DO UPDATE SET 
          "entityStrength" = EXCLUDED."entityStrength",
          "citationDepth" = EXCLUDED."citationDepth",
          "structuralClarity" = EXCLUDED."structuralClarity",
          "updateCadence" = EXCLUDED."updateCadence",
          "overallScore" = EXCLUDED."overallScore",
          "maturityLevel" = EXCLUDED."maturityLevel",
          "recommendations" = EXCLUDED."recommendations",
          "updatedAt" = NOW()
      `, [
        workspaceId,
        score.entityStrength,
        score.citationDepth,
        score.structuralClarity,
        score.updateCadence,
        score.overallScore,
        score.maturityLevel,
        JSON.stringify(score.recommendations),
      ]);
    } catch (error) {
      console.error(`Error storing maturity score:`, error);
      throw error;
    }
  }
}



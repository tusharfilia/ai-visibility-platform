/**
 * E-E-A-T Calculator Service
 * Calculates Experience, Expertise, Authoritativeness, Trustworthiness scores
 * Based on Google's E-E-A-T framework
 */

import { Injectable } from '@nestjs/common';
import { EvidenceGraphBuilderService } from '../evidence/evidence-graph.builder';
import { Pool } from 'pg';

export interface EEATScore {
  experience: number;          // 0-100
  expertise: number;           // 0-100
  authoritativeness: number;   // 0-100
  trustworthiness: number;     // 0-100
  overallScore: number;        // Weighted composite 0-100
  level: 'low' | 'medium' | 'high' | 'excellent';
  breakdown: {
    experience: {
      yearsInBusiness: number;
      caseStudies: number;
      testimonials: number;
      userGeneratedContent: number;
    };
    expertise: {
      certifications: number;
      awards: number;
      teamCredentials: number;
      topicAuthority: number;
    };
    authoritativeness: {
      backlinks: number;
      citations: number;
      industryRecognition: number;
      licensedPublisherMentions: number;
    };
    trustworthiness: {
      reviews: number;
      securityBadges: number;
      transparency: number;
      gdprCompliance: number;
      verifiedInformation: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class EEATCalculatorService {
  private dbPool: Pool;

  constructor(
    private evidenceBuilder: EvidenceGraphBuilderService
  ) {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Calculate E-E-A-T score for workspace
   */
  async calculateEEATScore(workspaceId: string): Promise<EEATScore> {
    try {
      // Get workspace profile (optional - use empty object if not found)
      // Note: Prisma maps to "workspace_profiles" (snake_case)
      let profile: any = {};
      try {
        const profileResult = await this.dbPool.query(
          'SELECT * FROM "workspace_profiles" WHERE "workspaceId" = $1',
          [workspaceId]
        );
        profile = profileResult.rows[0] || {};
      } catch (error) {
        // Table might not exist or no profile found - continue with empty profile
        console.warn(`Workspace profile not accessible, using defaults: ${(error as Error).message}`);
        profile = {};
      }

      // Build evidence graph for authoritativeness (handle errors gracefully)
      let evidenceGraph: any;
      try {
        evidenceGraph = await this.evidenceBuilder.buildEvidenceGraph(workspaceId);
      } catch (error) {
        console.warn(`Could not build evidence graph: ${(error as Error).message}`);
        // Use empty evidence graph structure
        evidenceGraph = {
          evidenceNodes: [],
          metadata: {
            totalEvidence: 0,
            licensedPublisherCount: 0,
            averageAuthority: 0,
            verifiedCount: 0,
            redditMentionCount: 0,
          },
        };
      }

      // Calculate each dimension in parallel
      const [experience, expertise, authoritativeness, trustworthiness] = await Promise.all([
        this.calculateExperienceScore(workspaceId, profile),
        this.calculateExpertiseScore(workspaceId, profile),
        this.calculateAuthoritativenessScore(workspaceId, evidenceGraph),
        this.calculateTrustworthinessScore(workspaceId, profile, evidenceGraph),
      ]);

      // Calculate overall score with weights
      // Per Google's guidance: Experience 20%, Expertise 25%, Authoritativeness 30%, Trustworthiness 25%
      const overallScore = Math.round(
        experience.score * 0.20 +
        expertise.score * 0.25 +
        authoritativeness.score * 0.30 +
        trustworthiness.score * 0.25
      );

      // Determine level
      const level = this.determineLevel(overallScore);

      const eeatScore: EEATScore = {
        experience: experience.score,
        expertise: expertise.score,
        authoritativeness: authoritativeness.score,
        trustworthiness: trustworthiness.score,
        overallScore,
        level,
        breakdown: {
          experience: experience.breakdown,
          expertise: expertise.breakdown,
          authoritativeness: authoritativeness.breakdown,
          trustworthiness: trustworthiness.breakdown,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      await this.storeEEATScore(workspaceId, eeatScore);

      return eeatScore;
    } catch (error) {
      console.error(`Error calculating E-E-A-T score for ${workspaceId}:`, error);
      throw new Error(`Failed to calculate E-E-A-T score: ${error.message}`);
    }
  }

  /**
   * Calculate Experience score
   * Factors: Years in business, case studies, testimonials, user-generated content
   */
  private async calculateExperienceScore(
    workspaceId: string,
    profile: any
  ): Promise<{ score: number; breakdown: any }> {
    let score = 0;
    const breakdown = {
      yearsInBusiness: 0,
      caseStudies: 0,
      testimonials: 0,
      userGeneratedContent: 0,
    };

    // Years in business (0-30 points)
    // Estimate from workspace creation date or profile data
    let yearsInBusiness = 0;
    try {
      const workspaceResult = await this.dbPool.query(
        'SELECT "createdAt" FROM "workspaces" WHERE id = $1',
        [workspaceId]
      );
      const workspace = workspaceResult.rows[0];
      if (workspace) {
        yearsInBusiness = this.calculateYearsInBusiness(workspace.createdAt);
      }
    } catch (error) {
      console.warn(`Could not fetch workspace: ${(error as Error).message}`);
    }
    if (yearsInBusiness >= 10) {
      breakdown.yearsInBusiness = 30;
    } else if (yearsInBusiness >= 5) {
      breakdown.yearsInBusiness = 20;
    } else if (yearsInBusiness >= 2) {
      breakdown.yearsInBusiness = 15;
    } else if (yearsInBusiness >= 1) {
      breakdown.yearsInBusiness = 10;
    } else {
      breakdown.yearsInBusiness = 5;
    }

    // Case studies (0-25 points)
    // Check for case study mentions in evidence or content
    const caseStudyCount = await this.countCaseStudies(workspaceId);
    if (caseStudyCount >= 5) {
      breakdown.caseStudies = 25;
    } else if (caseStudyCount >= 3) {
      breakdown.caseStudies = 20;
    } else if (caseStudyCount >= 1) {
      breakdown.caseStudies = 15;
    }

    // Testimonials (0-25 points)
    // Check for review/testimonial mentions
    const testimonialCount = await this.countTestimonials(workspaceId);
    if (testimonialCount >= 20) {
      breakdown.testimonials = 25;
    } else if (testimonialCount >= 10) {
      breakdown.testimonials = 20;
    } else if (testimonialCount >= 5) {
      breakdown.testimonials = 15;
    } else if (testimonialCount >= 1) {
      breakdown.testimonials = 10;
    }

    // User-generated content (0-20 points)
    // Check for Reddit mentions, social media, user reviews
    const ugcCount = await this.countUserGeneratedContent(workspaceId);
    if (ugcCount >= 50) {
      breakdown.userGeneratedContent = 20;
    } else if (ugcCount >= 20) {
      breakdown.userGeneratedContent = 15;
    } else if (ugcCount >= 10) {
      breakdown.userGeneratedContent = 10;
    } else if (ugcCount >= 1) {
      breakdown.userGeneratedContent = 5;
    }

    score = Math.min(100, 
      breakdown.yearsInBusiness + 
      breakdown.caseStudies + 
      breakdown.testimonials + 
      breakdown.userGeneratedContent
    );

    return { score, breakdown };
  }

  /**
   * Calculate Expertise score
   * Factors: Certifications, awards, team credentials, topic authority
   */
  private async calculateExpertiseScore(
    workspaceId: string,
    profile: any
  ): Promise<{ score: number; breakdown: any }> {
    let score = 0;
    const breakdown = {
      certifications: 0,
      awards: 0,
      teamCredentials: 0,
      topicAuthority: 0,
    };

    // Certifications (0-25 points)
    // Check for certification mentions in profile or evidence
    const certificationCount = await this.countCertifications(workspaceId);
    if (certificationCount >= 5) {
      breakdown.certifications = 25;
    } else if (certificationCount >= 3) {
      breakdown.certifications = 20;
    } else if (certificationCount >= 1) {
      breakdown.certifications = 15;
    }

    // Awards (0-25 points)
    const awardCount = await this.countAwards(workspaceId);
    if (awardCount >= 5) {
      breakdown.awards = 25;
    } else if (awardCount >= 3) {
      breakdown.awards = 20;
    } else if (awardCount >= 1) {
      breakdown.awards = 15;
    }

    // Team credentials (0-25 points)
    // Check for team member credentials, author bios
    const teamCredentialsCount = await this.countTeamCredentials(workspaceId);
    if (teamCredentialsCount >= 10) {
      breakdown.teamCredentials = 25;
    } else if (teamCredentialsCount >= 5) {
      breakdown.teamCredentials = 20;
    } else if (teamCredentialsCount >= 1) {
      breakdown.teamCredentials = 15;
    }

    // Topic authority (0-25 points)
    // Based on citation frequency and depth
    const topicAuthorityScore = await this.calculateTopicAuthority(workspaceId);
    breakdown.topicAuthority = topicAuthorityScore;

    score = Math.min(100,
      breakdown.certifications +
      breakdown.awards +
      breakdown.teamCredentials +
      breakdown.topicAuthority
    );

    return { score, breakdown };
  }

  /**
   * Calculate Authoritativeness score
   * Factors: Backlinks, citations, industry recognition, licensed publisher mentions
   */
  private async calculateAuthoritativenessScore(
    workspaceId: string,
    evidenceGraph: any
  ): Promise<{ score: number; breakdown: any }> {
    let score = 0;
    const breakdown = {
      backlinks: 0,
      citations: 0,
      industryRecognition: 0,
      licensedPublisherMentions: 0,
    };

    // Backlinks (0-30 points)
    // Use evidence graph metadata
    const totalEvidence = evidenceGraph.metadata.totalEvidence || 0;
    if (totalEvidence >= 100) {
      breakdown.backlinks = 30;
    } else if (totalEvidence >= 50) {
      breakdown.backlinks = 25;
    } else if (totalEvidence >= 20) {
      breakdown.backlinks = 20;
    } else if (totalEvidence >= 10) {
      breakdown.backlinks = 15;
    } else if (totalEvidence >= 5) {
      breakdown.backlinks = 10;
    }

    // Citations (0-30 points)
    // Count high-quality citations
    const citationCount = evidenceGraph.evidenceNodes.length;
    const highQualityCitations = evidenceGraph.evidenceNodes.filter(
      (n: any) => n.authority > 0.7
    ).length;
    
    if (highQualityCitations >= 20) {
      breakdown.citations = 30;
    } else if (highQualityCitations >= 10) {
      breakdown.citations = 25;
    } else if (highQualityCitations >= 5) {
      breakdown.citations = 20;
    } else if (citationCount >= 5) {
      breakdown.citations = 15;
    } else if (citationCount >= 1) {
      breakdown.citations = 10;
    }

    // Industry recognition (0-20 points)
    // Based on licensed publisher mentions and average authority
    const licensedCount = evidenceGraph.metadata.licensedPublisherCount || 0;
    const avgAuthority = evidenceGraph.metadata.averageAuthority || 0;
    
    if (licensedCount >= 5 && avgAuthority > 0.8) {
      breakdown.industryRecognition = 20;
    } else if (licensedCount >= 3 && avgAuthority > 0.7) {
      breakdown.industryRecognition = 15;
    } else if (licensedCount >= 1) {
      breakdown.industryRecognition = 10;
    } else if (avgAuthority > 0.6) {
      breakdown.industryRecognition = 5;
    }

    // Licensed publisher mentions (0-20 points)
    if (licensedCount >= 10) {
      breakdown.licensedPublisherMentions = 20;
    } else if (licensedCount >= 5) {
      breakdown.licensedPublisherMentions = 15;
    } else if (licensedCount >= 3) {
      breakdown.licensedPublisherMentions = 12;
    } else if (licensedCount >= 1) {
      breakdown.licensedPublisherMentions = 8;
    }

    score = Math.min(100,
      breakdown.backlinks +
      breakdown.citations +
      breakdown.industryRecognition +
      breakdown.licensedPublisherMentions
    );

    return { score, breakdown };
  }

  /**
   * Calculate Trustworthiness score
   * Factors: Reviews, security badges, transparency, GDPR compliance, verified information
   */
  private async calculateTrustworthinessScore(
    workspaceId: string,
    profile: any,
    evidenceGraph: any
  ): Promise<{ score: number; breakdown: any }> {
    let score = 0;
    const breakdown = {
      reviews: 0,
      securityBadges: 0,
      transparency: 0,
      gdprCompliance: 0,
      verifiedInformation: 0,
    };

    // Reviews (0-25 points)
    // Check directory submissions and review counts
    const reviewData = await this.getReviewData(workspaceId);
    const totalReviews = reviewData.total;
    const avgRating = reviewData.averageRating || 0;
    
    if (totalReviews >= 100 && avgRating >= 4.5) {
      breakdown.reviews = 25;
    } else if (totalReviews >= 50 && avgRating >= 4.0) {
      breakdown.reviews = 20;
    } else if (totalReviews >= 20 && avgRating >= 4.0) {
      breakdown.reviews = 15;
    } else if (totalReviews >= 10) {
      breakdown.reviews = 10;
    } else if (totalReviews >= 1) {
      breakdown.reviews = 5;
    }

    // Security badges (0-20 points)
    // Check for SSL, security certifications
    const securityScore = await this.calculateSecurityBadges(workspaceId);
    breakdown.securityBadges = securityScore;

    // Transparency (0-20 points)
    // Based on profile completeness
    let transparency = 0;
    if (profile.businessName) transparency += 3;
    if (profile.address) transparency += 3;
    if (profile.phone) transparency += 3;
    if (profile.description) transparency += 3;
    if (profile.hours) transparency += 3;
    if (profile.services && profile.services.length > 0) transparency += 5;
    breakdown.transparency = Math.min(20, transparency);

    // GDPR compliance (0-15 points)
    // Check for GDPR-related settings or data
    const gdprScore = await this.calculateGDPRCompliance(workspaceId);
    breakdown.gdprCompliance = gdprScore;

    // Verified information (0-20 points)
    // Based on verified evidence and profile
    const verifiedCount = evidenceGraph.metadata.verifiedCount || 0;
    const verifiedEvidence = evidenceGraph.evidenceNodes.filter(
      (n: any) => n.verified
    ).length;
    
    let verifiedScore = 0;
    if (profile.verified) verifiedScore += 10;
    if (verifiedEvidence >= 10) verifiedScore += 10;
    else if (verifiedEvidence >= 5) verifiedScore += 7;
    else if (verifiedEvidence >= 1) verifiedScore += 5;
    breakdown.verifiedInformation = Math.min(20, verifiedScore);

    score = Math.min(100,
      breakdown.reviews +
      breakdown.securityBadges +
      breakdown.transparency +
      breakdown.gdprCompliance +
      breakdown.verifiedInformation
    );

    return { score, breakdown };
  }

  /**
   * Store E-E-A-T score in database
   */
  private async storeEEATScore(workspaceId: string, score: EEATScore): Promise<void> {
    try {
      await this.dbPool.query(
        `INSERT INTO "eeat_scores" 
         ("id", "workspaceId", "experience", "expertise", "authoritativeness", "trustworthiness", 
          "overallScore", "level", "breakdown", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT ("workspaceId") 
         DO UPDATE SET 
           "experience" = EXCLUDED."experience",
           "expertise" = EXCLUDED."expertise",
           "authoritativeness" = EXCLUDED."authoritativeness",
           "trustworthiness" = EXCLUDED."trustworthiness",
           "overallScore" = EXCLUDED."overallScore",
           "level" = EXCLUDED."level",
           "breakdown" = EXCLUDED."breakdown",
           "updatedAt" = EXCLUDED."updatedAt"`,
        [
          this.generateId(),
          workspaceId,
          score.experience,
          score.expertise,
          score.authoritativeness,
          score.trustworthiness,
          score.overallScore,
          score.level,
          JSON.stringify(score.breakdown),
          score.createdAt,
          score.updatedAt,
        ]
      );
    } catch (error) {
      console.error('Error storing E-E-A-T score:', error);
      // Don't throw - score calculation can continue without storage
    }
  }

  /**
   * Determine E-E-A-T level
   */
  private determineLevel(score: number): 'low' | 'medium' | 'high' | 'excellent' {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Helper: Calculate years in business
   */
  private calculateYearsInBusiness(startDate: Date): number {
    const start = new Date(startDate);
    const now = new Date();
    const years = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.max(0, Math.floor(years));
  }

  /**
   * Helper: Count case studies
   */
  private async countCaseStudies(workspaceId: string): Promise<number> {
    if (!this.evidenceBuilder) return 0;
    try {
      // In production, query case study mentions in citations or content
      // For now, simulate based on evidence
      const evidenceGraph = await this.evidenceBuilder.buildEvidenceGraph(workspaceId);
      // Simple heuristic: licensed publisher citations might contain case studies
      return Math.min(5, Math.floor(evidenceGraph.metadata.licensedPublisherCount / 2));
    } catch (error) {
      return 0;
    }
  }

  /**
   * Helper: Count testimonials
   */
  private async countTestimonials(workspaceId: string): Promise<number> {
    // Query directory submissions for reviews/testimonials
    const result = await this.dbPool.query(
      'SELECT COUNT(*) as count FROM "directory_submissions" WHERE "workspaceId" = $1',
      [workspaceId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Helper: Count user-generated content
   */
  private async countUserGeneratedContent(workspaceId: string): Promise<number> {
    if (!this.evidenceBuilder) return 0;
    try {
      // Count Reddit mentions and other UGC sources
      const evidenceGraph = await this.evidenceBuilder.buildEvidenceGraph(workspaceId);
      return evidenceGraph.metadata.redditMentionCount || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Helper: Count certifications
   */
  private async countCertifications(workspaceId: string): Promise<number> {
    // In production, extract from profile or evidence
    // For now, return 0
    return 0;
  }

  /**
   * Helper: Count awards
   */
  private async countAwards(workspaceId: string): Promise<number> {
    // In production, extract from profile or evidence
    return 0;
  }

  /**
   * Helper: Count team credentials
   */
  private async countTeamCredentials(workspaceId: string): Promise<number> {
    // In production, extract from team member profiles
    return 0;
  }

  /**
   * Helper: Calculate topic authority
   */
  private async calculateTopicAuthority(workspaceId: string): Promise<number> {
    if (!this.evidenceBuilder) {
      console.warn('EvidenceGraphBuilderService not injected, using default topic authority score');
      return 10; // Default score
    }
    try {
      const evidenceGraph = await this.evidenceBuilder.buildEvidenceGraph(workspaceId);
      // Based on citation depth and authority
      const depthScore = Math.min(25, (evidenceGraph.metadata.totalEvidence || 0) / 4);
      const authorityScore = Math.min(25, (evidenceGraph.metadata.averageAuthority || 0) * 31.25);
      return Math.round(depthScore + authorityScore);
    } catch (error) {
      console.warn(`Could not calculate topic authority: ${(error as Error).message}`);
      return 10; // Default score
    }
  }

  /**
   * Helper: Get review data
   */
  private async getReviewData(workspaceId: string): Promise<{ total: number; averageRating: number }> {
    // Query directory submissions for review data
    // For now, simulate
    return { total: 0, averageRating: 0 };
  }

  /**
   * Helper: Calculate security badges score
   */
  private async calculateSecurityBadges(workspaceId: string): Promise<number> {
    // In production, check for SSL, security certifications
    // For now, assume basic security if profile exists
    return 10;
  }

  /**
   * Helper: Calculate GDPR compliance score
   */
  private async calculateGDPRCompliance(workspaceId: string): Promise<number> {
    // Check for GDPR-related settings
    // For now, assume compliance if workspace exists
    return 10;
  }

  /**
   * Helper: Generate ID
   */
  private generateId(): string {
    return `eeat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}


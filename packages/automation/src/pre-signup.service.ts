import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { createRedisClient } from '@ai-visibility/shared';

export interface PreSignupRequest {
  id: string;
  brandName: string;
  website?: string;
  industry?: string;
  email: string;
  requestedAt: Date;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    stage: string;
    message: string;
  };
  results?: PreSignupResults;
  error?: string;
}

export interface PreSignupResults {
  visibilityScore: number;
  competitors: CompetitorAnalysis[];
  opportunities: Opportunity[];
  recommendations: string[];
  knowledgeGraph: {
    entities: number;
    relationships: number;
    confidence: number;
  };
  trustProfile: {
    overall: number;
    breakdown: Record<string, number>;
  };
  summary: string;
  estimatedImpact: number;
  nextSteps: string[];
}

export interface CompetitorAnalysis {
  name: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  gap: number;
}

export interface Opportunity {
  type: 'mention' | 'ranking' | 'citation' | 'sentiment' | 'authority';
  description: string;
  impact: number;
  effort: 'low' | 'medium' | 'high';
  timeframe: string;
}

@Injectable()
export class PreSignupService {
  private redis: Redis;
  private scanQueue: Queue;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.redis = createRedisClient('PreSignupService');
    this.scanQueue = new Queue('pre-signup-scan', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });
  }

  /**
   * Initiate pre-signup AI analysis
   */
  async initiatePreSignupAnalysis(request: {
    brandName: string;
    website?: string;
    industry?: string;
    email: string;
  }): Promise<PreSignupRequest> {
    const requestId = this.generateRequestId();
    
    const preSignupRequest: PreSignupRequest = {
      id: requestId,
      brandName: request.brandName,
      website: request.website,
      industry: request.industry,
      email: request.email,
      requestedAt: new Date(),
      status: 'pending',
      progress: {
        current: 0,
        total: 6,
        stage: 'initializing',
        message: 'Preparing AI analysis...',
      },
    };

    // Store request in Redis
    await this.redis.setex(
      `presignup:${requestId}`,
      3600, // 1 hour TTL
      JSON.stringify(preSignupRequest)
    );

    // Queue the analysis job
    await this.scanQueue.add('analyze-brand', {
      requestId,
      brandName: request.brandName,
      website: request.website,
      industry: request.industry,
      email: request.email,
    }, {
      jobId: requestId,
      priority: 10, // High priority for pre-signup
    });

    // Emit event for real-time updates
    this.eventEmitter.emit('presignup.initiated', {
      requestId,
      brandName: request.brandName,
      email: request.email,
    });

    return preSignupRequest;
  }

  /**
   * Get pre-signup analysis status
   */
  async getAnalysisStatus(requestId: string): Promise<PreSignupRequest | null> {
    const data = await this.redis.get(`presignup:${requestId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get pre-signup analysis results
   */
  async getAnalysisResults(requestId: string): Promise<PreSignupResults | null> {
    const request = await this.getAnalysisStatus(requestId);
    return request?.results || null;
  }

  /**
   * Process pre-signup analysis (called by worker)
   */
  async processPreSignupAnalysis(payload: {
    requestId: string;
    brandName: string;
    website?: string;
    industry?: string;
    email: string;
  }): Promise<void> {
    const { requestId, brandName, website, industry, email } = payload;

    try {
      // Update status to scanning
      await this.updateProgress(requestId, {
        current: 0,
        total: 6,
        stage: 'scanning',
        message: 'Starting AI analysis...',
        status: 'scanning',
      });

      // Stage 1: GEO Scoring Analysis
      await this.updateProgress(requestId, {
        current: 1,
        total: 6,
        stage: 'geo-scoring',
        message: 'Analyzing GEO visibility score...',
      });
      const visibilityScore = await this.performGEOScoring(brandName, industry);

      // Stage 2: Knowledge Graph Building
      await this.updateProgress(requestId, {
        current: 2,
        total: 6,
        stage: 'knowledge-graph',
        message: 'Building knowledge graph...',
      });
      const knowledgeGraph = await this.buildKnowledgeGraph(brandName);

      // Stage 3: Trust Signal Analysis
      await this.updateProgress(requestId, {
        current: 3,
        total: 6,
        stage: 'trust-analysis',
        message: 'Analyzing trust signals...',
      });
      const trustProfile = await this.analyzeTrustSignals(website || brandName);

      // Stage 4: Competitor Analysis
      await this.updateProgress(requestId, {
        current: 4,
        total: 6,
        stage: 'competitor-analysis',
        message: 'Analyzing competitive landscape...',
      });
      const competitors = await this.analyzeCompetitors(brandName, industry);

      // Stage 5: Opportunity Identification
      await this.updateProgress(requestId, {
        current: 5,
        total: 6,
        stage: 'opportunity-identification',
        message: 'Identifying optimization opportunities...',
      });
      const opportunities = await this.identifyOpportunities(
        visibilityScore,
        knowledgeGraph,
        trustProfile,
        competitors
      );

      // Stage 6: Generate Summary and Recommendations
      await this.updateProgress(requestId, {
        current: 6,
        total: 6,
        stage: 'finalizing',
        message: 'Generating AI summary and recommendations...',
      });
      const summary = await this.generateAISummary(
        brandName,
        visibilityScore,
        competitors,
        opportunities
      );

      const recommendations = this.generateRecommendations(opportunities);
      const estimatedImpact = this.calculateEstimatedImpact(opportunities);
      const nextSteps = this.generateNextSteps(recommendations);

      // Compile final results
      const results: PreSignupResults = {
        visibilityScore,
        competitors,
        opportunities,
        recommendations,
        knowledgeGraph,
        trustProfile,
        summary,
        estimatedImpact,
        nextSteps,
      };

      // Update request with results
      await this.updateProgress(requestId, {
        current: 6,
        total: 6,
        stage: 'completed',
        message: 'Analysis complete!',
        status: 'completed',
        results,
      });

      // Emit completion event
      this.eventEmitter.emit('presignup.completed', {
        requestId,
        brandName,
        email,
        results,
      });

    } catch (error) {
      console.error(`Pre-signup analysis failed for ${requestId}:`, error);
      
      await this.updateProgress(requestId, {
        current: 0,
        total: 6,
        stage: 'failed',
        message: 'Analysis failed. Please try again.',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });

      // Emit failure event
      this.eventEmitter.emit('presignup.failed', {
        requestId,
        brandName,
        email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update progress for a request
   */
  private async updateProgress(
    requestId: string,
    updates: Partial<PreSignupRequest> & { 
      current?: number;
      total?: number;
      stage?: string;
      message?: string;
      status?: 'pending' | 'scanning' | 'completed' | 'failed';
      results?: PreSignupResults;
      error?: string;
    }
  ): Promise<void> {
    const request = await this.getAnalysisStatus(requestId);
    if (!request) return;

    const updatedRequest: PreSignupRequest = {
      ...request,
      ...updates,
      progress: {
        ...request.progress,
        ...(updates.current !== undefined && { current: updates.current }),
        ...(updates.total !== undefined && { total: updates.total }),
        ...(updates.stage && { stage: updates.stage }),
        ...(updates.message && { message: updates.message }),
      }
    };
    
    await this.redis.setex(
      `presignup:${requestId}`,
      3600,
      JSON.stringify(updatedRequest)
    );

    // Emit progress event
    this.eventEmitter.emit('presignup.progress', {
      requestId,
      progress: updatedRequest.progress,
      status: updatedRequest.status,
    });
  }

  /**
   * Perform GEO scoring analysis
   */
  private async performGEOScoring(brandName: string, industry?: string): Promise<number> {
    // Simulate GEO scoring analysis
    await this.simulateDelay(2000);
    
    // Mock scoring based on brand name characteristics
    const baseScore = Math.random() * 40 + 30; // 30-70
    const industryMultiplier = this.getIndustryMultiplier(industry);
    
    return Math.round((baseScore * industryMultiplier) * 100) / 100;
  }

  /**
   * Build knowledge graph
   */
  private async buildKnowledgeGraph(brandName: string): Promise<any> {
    await this.simulateDelay(1500);
    
    return {
      entities: Math.floor(Math.random() * 10) + 5, // 5-15 entities
      relationships: Math.floor(Math.random() * 8) + 3, // 3-11 relationships
      confidence: Math.round((Math.random() * 0.3 + 0.7) * 100) / 100, // 0.7-1.0
    };
  }

  /**
   * Analyze trust signals
   */
  private async analyzeTrustSignals(domain: string): Promise<any> {
    await this.simulateDelay(1800);
    
    return {
      overall: Math.round((Math.random() * 40 + 40) * 100) / 100, // 40-80
      breakdown: {
        domainAuthority: Math.round((Math.random() * 30 + 50) * 100) / 100,
        backlinks: Math.round((Math.random() * 35 + 45) * 100) / 100,
        socialSignals: Math.round((Math.random() * 25 + 35) * 100) / 100,
        contentQuality: Math.round((Math.random() * 30 + 50) * 100) / 100,
        userEngagement: Math.round((Math.random() * 20 + 40) * 100) / 100,
        expertise: Math.round((Math.random() * 25 + 45) * 100) / 100,
        freshness: Math.round((Math.random() * 20 + 50) * 100) / 100,
      },
    };
  }

  /**
   * Analyze competitors
   */
  private async analyzeCompetitors(brandName: string, industry?: string): Promise<CompetitorAnalysis[]> {
    await this.simulateDelay(2500);
    
    const competitors = [
      'Competitor A', 'Competitor B', 'Competitor C', 'Competitor D'
    ];
    
    return competitors.map(name => ({
      name,
      score: Math.round((Math.random() * 40 + 30) * 100) / 100,
      strengths: this.generateRandomStrengths(),
      weaknesses: this.generateRandomWeaknesses(),
      gap: Math.round((Math.random() * 20 - 10) * 100) / 100, // -10 to +10
    }));
  }

  /**
   * Identify optimization opportunities
   */
  private async identifyOpportunities(
    visibilityScore: number,
    knowledgeGraph: any,
    trustProfile: any,
    competitors: CompetitorAnalysis[]
  ): Promise<Opportunity[]> {
    await this.simulateDelay(1000);
    
    const opportunities: Opportunity[] = [];
    
    // Generate opportunities based on analysis
    if (visibilityScore < 60) {
      opportunities.push({
        type: 'mention',
        description: 'Increase brand mention frequency in AI responses',
        impact: Math.round((Math.random() * 20 + 15) * 100) / 100,
        effort: 'medium',
        timeframe: '2-4 weeks',
      });
    }
    
    if (trustProfile.overall < 70) {
      opportunities.push({
        type: 'authority',
        description: 'Build domain authority through quality backlinks',
        impact: Math.round((Math.random() * 25 + 20) * 100) / 100,
        effort: 'high',
        timeframe: '3-6 months',
      });
    }
    
    if (knowledgeGraph.entities < 10) {
      opportunities.push({
        type: 'citation',
        description: 'Expand knowledge graph with more entity relationships',
        impact: Math.round((Math.random() * 15 + 10) * 100) / 100,
        effort: 'low',
        timeframe: '1-2 weeks',
      });
    }
    
    return opportunities.slice(0, 5); // Limit to top 5 opportunities
  }

  /**
   * Generate AI summary
   */
  private async generateAISummary(
    brandName: string,
    visibilityScore: number,
    competitors: CompetitorAnalysis[],
    opportunities: Opportunity[]
  ): Promise<string> {
    await this.simulateDelay(800);
    
    const topCompetitor = competitors[0] || { name: 'Unknown', score: 0 };
    const avgCompetitorScore = competitors.length > 0 
      ? competitors.reduce((sum, c) => sum + c.score, 0) / competitors.length 
      : 0;
    
    return `${brandName} currently has a GEO visibility score of ${visibilityScore}/100, positioning it ${visibilityScore > avgCompetitorScore ? 'above' : 'below'} the industry average. The main competitor is ${topCompetitor.name} with a score of ${topCompetitor.score}. Key opportunities include ${opportunities.slice(0, 2).map(o => o.description.toLowerCase()).join(' and ')}, which could improve visibility by an estimated ${this.calculateEstimatedImpact(opportunities)}% within the next quarter.`;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(opportunities: Opportunity[]): string[] {
    return opportunities.map(opp => {
      switch (opp.type) {
        case 'mention':
          return 'Optimize content for target keywords to increase AI mention frequency';
        case 'ranking':
          return 'Enhance content relevance and authority to improve search rankings';
        case 'citation':
          return 'Build authoritative citations through thought leadership';
        case 'sentiment':
          return 'Improve brand sentiment through better customer experience';
        case 'authority':
          return 'Strengthen domain authority through quality backlinks';
        default:
          return 'Focus on overall brand optimization';
      }
    });
  }

  /**
   * Calculate estimated impact
   */
  private calculateEstimatedImpact(opportunities: Opportunity[]): number {
    const totalImpact = opportunities.reduce((sum, opp) => sum + opp.impact, 0);
    return Math.round(totalImpact * 100) / 100;
  }

  /**
   * Generate next steps
   */
  private generateNextSteps(recommendations: string[]): string[] {
    return [
      'Sign up for a full account to access detailed analytics',
      'Set up automated monitoring for your brand',
      'Configure GEO Copilot for automated optimization',
      'Schedule a consultation with our experts',
      'Start with the highest-impact recommendations',
    ];
  }

  /**
   * Helper methods
   */
  private generateRequestId(): string {
    return `presignup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getIndustryMultiplier(industry?: string): number {
    const multipliers = {
      'technology': 1.2,
      'finance': 1.1,
      'healthcare': 1.0,
      'retail': 0.9,
      'education': 0.8,
    };
    return (multipliers as Record<string, number>)[industry || ''] || 1.0;
  }

  private generateRandomStrengths(): string[] {
    const strengths = [
      'Strong domain authority',
      'High-quality content',
      'Active social presence',
      'Good user engagement',
      'Fresh content updates',
    ];
    return strengths.slice(0, Math.floor(Math.random() * 3) + 1);
  }

  private generateRandomWeaknesses(): string[] {
    const weaknesses = [
      'Limited backlinks',
      'Low social signals',
      'Outdated content',
      'Poor user engagement',
      'Weak expertise signals',
    ];
    return weaknesses.slice(0, Math.floor(Math.random() * 2) + 1);
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


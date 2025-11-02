/**
 * Dashboard Controller (Test Mode - No Auth)
 * For local testing of GEO dashboard features
 */

import { Controller, Get, Query } from '@nestjs/common';
import {
  DashboardAggregatorService,
  DashboardOverview,
  EngineVisibilityComparison,
  MaturityProgressPoint,
  Recommendation,
  GEOMaturityScore,
  FactConsensusScore,
  EvidenceGraphBuilderService,
} from '@ai-visibility/geo';

@Controller('geo/dashboard')
export class DashboardControllerTest {
  constructor(
    private dashboardAggregator: DashboardAggregatorService,
    private evidenceBuilder: EvidenceGraphBuilderService
  ) {}

  @Get('overview')
  async getDashboardOverview(
    @Query('workspaceId') workspaceId?: string
  ): Promise<{ ok: boolean; data: DashboardOverview | null }> {
    const targetWorkspaceId = workspaceId || 'test-workspace-id';
    
    try {
      const overview = await this.dashboardAggregator.getDashboardOverview(targetWorkspaceId);
      
      return {
        ok: true,
        data: overview,
      };
    } catch (error) {
      console.error('Error fetching dashboard overview:', error);
      return {
        ok: false,
        data: null,
      };
    }
  }

  @Get('maturity')
  async getMaturity(
    @Query('workspaceId') workspaceId?: string
  ): Promise<{
    ok: boolean;
    data: {
      current: GEOMaturityScore;
      trends: {
        weekly: number;
        monthly: number;
        quarterly: number;
      };
    } | null;
  }> {
    const targetWorkspaceId = workspaceId || 'test-workspace-id';
    
    try {
      const maturityData = await this.dashboardAggregator.getMaturityScores(targetWorkspaceId);
      
      return {
        ok: true,
        data: maturityData,
      };
    } catch (error) {
      console.error('Error fetching maturity scores:', error);
      return {
        ok: false,
        data: null,
      };
    }
  }

  @Get('recommendations')
  async getRecommendations(
    @Query('workspaceId') workspaceId?: string,
    @Query('limit') limit?: string
  ): Promise<{ ok: boolean; data: Recommendation[] }> {
    const targetWorkspaceId = workspaceId || 'test-workspace-id';
    
    try {
      let recommendations = await this.dashboardAggregator.getRecommendations(targetWorkspaceId);
      
      if (limit) {
        const limitNum = parseInt(limit, 10);
        recommendations = recommendations.slice(0, limitNum);
      }
      
      return {
        ok: true,
        data: recommendations,
      };
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      return {
        ok: false,
        data: [],
      };
    }
  }

  @Get('fact-consensus')
  async getFactConsensusData(
    @Query('workspaceId') workspaceId?: string,
    @Query('factType') factType?: 'address' | 'hours' | 'phone' | 'services' | 'pricing' | 'features'
  ): Promise<{ ok: boolean; data: FactConsensusScore[] }> {
    const targetWorkspaceId = workspaceId || 'test-workspace-id';
    
    try {
      const consensus = await this.evidenceBuilder.calculateFactLevelConsensus(
        targetWorkspaceId,
        factType
      );
      return {
        ok: true,
        data: consensus,
      };
    } catch (error) {
      console.error('Error fetching fact consensus:', error);
      return {
        ok: false,
        data: [],
      };
    }
  }

  @Get('engines/comparison')
  async getEngineComparison(
    @Query('workspaceId') workspaceId?: string
  ): Promise<{ ok: boolean; data: EngineVisibilityComparison[] }> {
    const targetWorkspaceId = workspaceId || 'test-workspace-id';
    
    try {
      const comparison = await this.dashboardAggregator.getEngineComparison(targetWorkspaceId);
      
      return {
        ok: true,
        data: comparison,
      };
    } catch (error) {
      console.error('Error fetching engine comparison:', error);
      return {
        ok: false,
        data: [],
      };
    }
  }

  @Get('progress')
  async getProgress(
    @Query('workspaceId') workspaceId?: string,
    @Query('days') days?: string
  ): Promise<{ ok: boolean; data: MaturityProgressPoint[] }> {
    const targetWorkspaceId = workspaceId || 'test-workspace-id';
    const daysCount = days ? parseInt(days, 10) : 30;
    
    try {
      const progress = await this.dashboardAggregator.getProgressHistory(targetWorkspaceId, daysCount);
      
      return {
        ok: true,
        data: progress,
      };
    } catch (error) {
      console.error('Error fetching progress:', error);
      return {
        ok: false,
        data: [],
      };
    }
  }
}


/**
 * Recommendations Controller
 * Provides endpoints for prescriptive GEO recommendations
 */

import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { WorkspaceAccessGuard } from '../../guards/workspace-access.guard';
import { GetWorkspaceId } from '../../decorators/workspace-id.decorator';
import { PrescriptiveRecommendationEngine, Recommendation } from '@ai-visibility/geo';
import { EventEmitterService } from '../events/event-emitter.service';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@ApiTags('Recommendations')
@ApiBearerAuth()
@Controller('v1/recommendations')
@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
export class RecommendationsController {
  constructor(
    private recommendationEngine: PrescriptiveRecommendationEngine,
    private eventEmitter: EventEmitterService,
    @InjectQueue('recommendationRefresh') private recommendationQueue: Queue
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get prescriptive recommendations' })
  @ApiResponse({ status: 200, description: 'Recommendations retrieved successfully' })
  @ApiQuery({ name: 'workspaceId', required: false, description: 'Workspace ID' })
  async getRecommendations(
    @GetWorkspaceId() workspaceId: string,
    @Query('workspaceId') queryWorkspaceId?: string
  ): Promise<Recommendation[]> {
    const targetWorkspaceId = queryWorkspaceId || workspaceId;

    // Try to get from database first
    try {
      const Pool = require('pg').Pool;
      const dbPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });

      const result = await dbPool.query(
        'SELECT "recommendations" FROM "geo_maturity_scores" WHERE "workspaceId" = $1',
        [targetWorkspaceId]
      );

      if (result.rows.length > 0 && result.rows[0].recommendations) {
        return result.rows[0].recommendations;
      }
    } catch (error) {
      console.warn('Error fetching recommendations from DB:', error);
    }

    // Generate if not found
    return this.recommendationEngine.generateRecommendations(targetWorkspaceId);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh recommendations' })
  @ApiResponse({ status: 200, description: 'Recommendations refreshed successfully' })
  @ApiBody({ schema: { type: 'object', properties: { workspaceId: { type: 'string' } } } })
  async refreshRecommendations(
    @GetWorkspaceId() workspaceId: string,
    @Body() body?: { workspaceId?: string }
  ): Promise<{ jobId: string; status: string }> {
    const targetWorkspaceId = body?.workspaceId || workspaceId;

    // Enqueue job
    const job = await this.recommendationQueue.add('refresh', {
      workspaceId: targetWorkspaceId,
      timestamp: new Date().toISOString(),
    });

    // Emit SSE event
    await this.eventEmitter.emitToWorkspace(targetWorkspaceId, 'geo.recommendations.updated', {
      jobId: job.id,
      workspaceId: targetWorkspaceId,
    });

    return {
      jobId: job.id!,
      status: 'accepted',
    };
  }
}


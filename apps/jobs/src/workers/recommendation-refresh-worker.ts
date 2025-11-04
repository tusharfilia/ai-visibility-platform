/**
 * Recommendation Refresh Worker
 * Processes recommendation refresh jobs
 */

import { Worker, Job } from 'bullmq';
import { PrescriptiveRecommendationEngine } from '@ai-visibility/geo/maturity/prescriptive-recommendations.service';
import { EventEmitterService } from '@ai-visibility/shared/events';

export interface RecommendationRefreshPayload {
  workspaceId: string;
  timestamp: string;
}

export class RecommendationRefreshWorker {
  private worker: Worker;
  private recommendationEngine: PrescriptiveRecommendationEngine;
  private eventEmitter: any; // Would be EventEmitterService in production

  constructor(connection: any, eventEmitter?: any) {
    this.recommendationEngine = new PrescriptiveRecommendationEngine(
      null as any, // GEOMaturityCalculatorService
      null as any, // StructuralScoringService
      null as any  // EvidenceGraphBuilderService
    );
    this.eventEmitter = eventEmitter;

    this.worker = new Worker(
      'recommendationRefresh',
      this.processJob.bind(this),
      {
        connection,
        concurrency: 3,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      }
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Recommendation refresh job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Recommendation refresh job ${job.id} failed:`, err);
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }

  private async processJob(job: Job<RecommendationRefreshPayload>): Promise<any> {
    const { workspaceId } = job.data;

    try {
      // Generate recommendations
      const recommendations = await this.recommendationEngine.generateRecommendations(workspaceId);

      // Update database
      const Pool = require('pg').Pool;
      const dbPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });

      await dbPool.query(
        'UPDATE "geo_maturity_scores" SET "recommendations" = $1, "updatedAt" = NOW() WHERE "workspaceId" = $2',
        [JSON.stringify(recommendations), workspaceId]
      );

      // Emit SSE event
      if (this.eventEmitter) {
        await this.eventEmitter.emitToWorkspace(workspaceId, 'geo.recommendations.updated', {
          recommendationCount: recommendations.length,
          recommendations: recommendations.slice(0, 5), // Top 5 for preview
        });
      }

      return {
        success: true,
        recommendationCount: recommendations.length,
      };
    } catch (error) {
      console.error(`Error processing recommendation refresh job:`, error);
      throw error;
    }
  }
}


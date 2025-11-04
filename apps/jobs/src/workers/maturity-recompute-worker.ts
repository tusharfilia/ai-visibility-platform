/**
 * Maturity Recompute Worker
 * Processes maturity score recomputation jobs
 */

import { Worker, Job } from 'bullmq';
import { GEOMaturityCalculatorService } from '@ai-visibility/geo/maturity/maturity-calculator.service';
import { EventEmitterService } from '@ai-visibility/shared/events';

export interface MaturityRecomputePayload {
  workspaceId: string;
  timestamp: string;
}

export class MaturityRecomputeWorker {
  private worker: Worker;
  private maturityCalculator: GEOMaturityCalculatorService;
  private eventEmitter: any; // Would be EventEmitterService in production

  constructor(connection: any, eventEmitter?: any) {
    this.maturityCalculator = new GEOMaturityCalculatorService(
      null as any, // StructuralScoringService
      null as any  // EvidenceGraphBuilderService
    );
    this.eventEmitter = eventEmitter;

    this.worker = new Worker(
      'maturityRecompute',
      this.processJob.bind(this),
      {
        connection,
        concurrency: 2,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      }
    );

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Maturity recompute job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Maturity recompute job ${job.id} failed:`, err);
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }

  private async processJob(job: Job<MaturityRecomputePayload>): Promise<any> {
    const { workspaceId } = job.data;

    try {
      // Calculate maturity score
      const score = await this.maturityCalculator.calculateMaturityScore(workspaceId);

      // Emit SSE event
      if (this.eventEmitter) {
        await this.eventEmitter.emitToWorkspace(workspaceId, 'maturity.updated', {
          overallScore: score.overallScore,
          maturityLevel: score.maturityLevel,
          entityStrength: score.entityStrength,
          citationDepth: score.citationDepth,
          structuralClarity: score.structuralClarity,
          updateCadence: score.updateCadence,
        });
      }

      return {
        success: true,
        overallScore: score.overallScore,
        maturityLevel: score.maturityLevel,
      };
    } catch (error) {
      console.error(`Error processing maturity recompute job:`, error);
      throw error;
    }
  }
}


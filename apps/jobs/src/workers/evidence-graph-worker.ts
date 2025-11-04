/**
 * Evidence Graph Worker
 * Processes evidence graph building jobs
 */

import { Worker, Job } from 'bullmq';
import { EvidenceGraphBuilderService } from '@ai-visibility/geo/evidence/evidence-graph.builder';
import { EventEmitterService } from '@ai-visibility/shared/events';

export interface EvidenceGraphPayload {
  workspaceId: string;
  idempotencyKey: string;
}

export class EvidenceGraphWorker {
  private worker: Worker;
  private evidenceBuilder: EvidenceGraphBuilderService;
  private eventEmitter: any; // Would be EventEmitterService in production

  constructor(connection: any, eventEmitter?: any) {
    this.evidenceBuilder = new EvidenceGraphBuilderService();
    this.eventEmitter = eventEmitter;

    this.worker = new Worker(
      'evidenceGraph',
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
      console.log(`Evidence graph job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Evidence graph job ${job.id} failed:`, err);
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }

  private async processJob(job: Job<EvidenceGraphPayload>): Promise<any> {
    const { workspaceId } = job.data;

    try {
      // Emit progress event
      if (this.eventEmitter) {
        await this.eventEmitter.emitToWorkspace(workspaceId, 'evidence.progress', {
          stage: 'building',
          progress: 10,
        });
      }

      // Build evidence graph
      const graph = await this.evidenceBuilder.buildEvidenceGraph(workspaceId);

      // Store evidence nodes (would persist to DB in production)
      // For now, just return the graph

      // Emit completion event
      if (this.eventEmitter) {
        await this.eventEmitter.emitToWorkspace(workspaceId, 'evidence.complete', {
          evidenceCount: graph.evidenceNodes.length,
          consensusScore: graph.consensusScore,
        });
      }

      return {
        success: true,
        evidenceCount: graph.evidenceNodes.length,
        consensusScore: graph.consensusScore,
      };
    } catch (error) {
      console.error(`Error processing evidence graph job:`, error);
      throw error;
    }
  }
}


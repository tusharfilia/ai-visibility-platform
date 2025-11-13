import { Worker, Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PromptDiscoveryService } from '@ai-visibility/prompts/discovery.service';
import { EventEmitterService } from '../events/event-emitter.service';
import { createRedisClient } from '@ai-visibility/shared';

export interface PromptDiscoveryPayload {
  workspaceId: string;
  industry: string;
  maxPrompts?: number;
  algorithm?: 'dbscan' | 'kmeans' | 'hierarchical';
  minClusterSize?: number;
  maxClusters?: number;
}

export interface ClusterRefreshPayload {
  workspaceId: string;
  clusterIds?: string[];
}

@Injectable()
export class PromptDiscoveryWorker {
  private readonly logger = new Logger(PromptDiscoveryWorker.name);
  private worker: Worker;

  constructor(
    private discoveryService: PromptDiscoveryService,
    private eventEmitter: EventEmitterService
  ) {
    this.initializeWorker();
  }

  private initializeWorker() {
    const redis = createRedisClient('PromptDiscoveryWorker');
    this.worker = new Worker(
      'prompt-discovery',
      this.processJob.bind(this),
      {
        connection: redis,
        concurrency: 3,
        removeOnComplete: 10,
        removeOnFail: 5,
      }
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Prompt discovery job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Prompt discovery job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      this.logger.error('Prompt discovery worker error:', err);
    });
  }

  async processJob(job: Job<PromptDiscoveryPayload | ClusterRefreshPayload>): Promise<any> {
    const { name, data } = job;

    this.logger.log(`Processing ${name} job for workspace ${data.workspaceId}`);

    try {
      // Emit start event
      await this.eventEmitter.emitToWorkspace(data.workspaceId, {
        type: 'prompt.discovery.started',
        data: {
          jobId: job.id,
          workspaceId: data.workspaceId,
          timestamp: new Date().toISOString()
        }
      });

      let result;

      switch (name) {
        case 'discover-prompts':
          result = await this.processDiscoveryJob(data as PromptDiscoveryPayload);
          break;
        case 'refresh-clusters':
          result = await this.processRefreshJob(data as ClusterRefreshPayload);
          break;
        default:
          throw new Error(`Unknown job type: ${name}`);
      }

      // Emit completion event
      await this.eventEmitter.emitToWorkspace(data.workspaceId, {
        type: 'prompt.discovery.completed',
        data: {
          jobId: job.id,
          workspaceId: data.workspaceId,
          result,
          timestamp: new Date().toISOString()
        }
      });

      return result;
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);

      // Emit error event
      await this.eventEmitter.emitToWorkspace(data.workspaceId, {
        type: 'prompt.discovery.failed',
        data: {
          jobId: job.id,
          workspaceId: data.workspaceId,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });

      throw error;
    }
  }

  private async processDiscoveryJob(payload: PromptDiscoveryPayload): Promise<any> {
    const { workspaceId, industry, maxPrompts = 50 } = payload;

    this.logger.log(`Starting prompt discovery for workspace ${workspaceId}, industry: ${industry}`);

    // Emit progress event
    await this.eventEmitter.emitToWorkspace(workspaceId, {
      type: 'prompt.discovery.progress',
      data: {
        step: 'discovering',
        message: 'Discovering trending prompts...',
        progress: 10
      }
    });

    // 1. Discover prompts
    const discoveredPrompts = await this.discoveryService.discoverPrompts(
      workspaceId,
      industry,
      maxPrompts
    );

    await this.eventEmitter.emitToWorkspace(workspaceId, {
      type: 'prompt.discovery.progress',
      data: {
        step: 'clustering',
        message: `Found ${discoveredPrompts.length} prompts, clustering...`,
        progress: 50
      }
    });

    // 2. Cluster prompts
    const clusters = await this.discoveryService.clusterPrompts(workspaceId, discoveredPrompts);

    await this.eventEmitter.emitToWorkspace(workspaceId, {
      type: 'prompt.discovery.progress',
      data: {
        step: 'completed',
        message: `Created ${clusters.length} clusters`,
        progress: 100
      }
    });

    return {
      discoveredPrompts: discoveredPrompts.length,
      clusters: clusters.length,
      clusterDetails: clusters.map(c => ({
        id: c.id,
        name: c.name,
        size: c.size,
        description: c.description
      }))
    };
  }

  private async processRefreshJob(payload: ClusterRefreshPayload): Promise<any> {
    const { workspaceId, clusterIds } = payload;

    this.logger.log(`Refreshing clusters for workspace ${workspaceId}`);

    // Emit progress event
    await this.eventEmitter.emitToWorkspace(workspaceId, {
      type: 'prompt.discovery.progress',
      data: {
        step: 'refreshing',
        message: 'Refreshing clusters with new prompts...',
        progress: 25
      }
    });

    // Refresh clusters
    const refreshedClusters = await this.discoveryService.refreshClusters(workspaceId);

    await this.eventEmitter.emitToWorkspace(workspaceId, {
      type: 'prompt.discovery.progress',
      data: {
        step: 'completed',
        message: `Refreshed ${refreshedClusters.length} clusters`,
        progress: 100
      }
    });

    return {
      refreshedClusters: refreshedClusters.length,
      clusterDetails: refreshedClusters.map(c => ({
        id: c.id,
        name: c.name,
        size: c.size,
        updatedAt: c.updatedAt
      }))
    };
  }

  /**
   * Schedule daily prompt discovery
   */
  async scheduleDailyDiscovery(workspaceId: string, industry: string): Promise<void> {
    // This would typically be called by a scheduler service
    // For now, we'll just log the intent
    this.logger.log(`Scheduling daily discovery for workspace ${workspaceId}, industry: ${industry}`);
  }

  /**
   * Schedule weekly cluster refresh
   */
  async scheduleWeeklyRefresh(workspaceId: string): Promise<void> {
    // This would typically be called by a scheduler service
    this.logger.log(`Scheduling weekly refresh for workspace ${workspaceId}`);
  }

  /**
   * Get worker status
   */
  getStatus(): { isRunning: boolean; concurrency: number; activeJobs: number } {
    return {
      isRunning: this.worker.isRunning(),
      concurrency: this.worker.concurrency,
      activeJobs: this.worker.activeJobs.size
    };
  }

  /**
   * Gracefully shutdown worker
   */
  async shutdown(): Promise<void> {
    this.logger.log('Shutting down prompt discovery worker...');
    await this.worker.close();
  }
}


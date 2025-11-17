import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DirectorySyncService } from '@ai-visibility/automation';

@Processor('directory-sync')
export class DirectorySyncWorker extends WorkerHost {
  constructor(private directorySyncService: DirectorySyncService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { syncJobId, workspaceId, platformIds, businessInfo, priority } = job.data;

    console.log(`Processing directory sync job ${syncJobId} for ${platformIds.length} platforms`);

    try {
      await this.directorySyncService.processSyncJob({
        syncJobId,
        workspaceId,
        platformIds,
        businessInfo,
        priority,
      });

      console.log(`Directory sync job completed for ${syncJobId}`);
      return { success: true, syncJobId };

    } catch (error) {
      console.error(`Directory sync job failed for ${syncJobId}:`, error);
      throw error;
    }
  }
}


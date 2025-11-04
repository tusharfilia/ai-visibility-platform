import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PreSignupService } from '@ai-visibility/automation/pre-signup.service';

@Processor('pre-signup-scan')
export class PreSignupWorker extends WorkerHost {
  constructor(private preSignupService: PreSignupService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { requestId, brandName, website, industry, email } = job.data;

    console.log(`Processing pre-signup analysis for ${brandName} (${requestId})`);

    try {
      await this.preSignupService.processPreSignupAnalysis({
        requestId,
        brandName,
        website,
        industry,
        email,
      });

      console.log(`Pre-signup analysis completed for ${requestId}`);
      return { success: true, requestId };

    } catch (error) {
      console.error(`Pre-signup analysis failed for ${requestId}:`, error);
      throw error;
    }
  }
}


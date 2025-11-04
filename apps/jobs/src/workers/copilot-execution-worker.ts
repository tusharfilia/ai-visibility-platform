import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EnhancedCopilotService } from '@ai-visibility/automation/enhanced-copilot.service';

@Processor('copilot-execution')
export class CopilotExecutionWorker extends WorkerHost {
  constructor(private copilotService: EnhancedCopilotService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { executionId, actions, context } = job.data;

    console.log(`Processing Copilot execution ${executionId} with ${actions.length} actions`);

    try {
      const results = [];

      for (const action of actions) {
        console.log(`Executing action: ${action.type}`);
        
        const result = await this.copilotService.executeAction(
          executionId,
          action,
          context
        );

        results.push(result);
      }

      console.log(`Copilot execution completed for ${executionId}`);
      return { success: true, executionId, results };

    } catch (error) {
      console.error(`Copilot execution failed for ${executionId}:`, error);
      throw error;
    }
  }
}


/**
 * Copilot planner worker
 * Plans and executes copilot actions
 */

import { Worker, Job } from 'bullmq';
import { prisma } from '@ai-visibility/db';
import { CopilotPlannerPayload } from '../queues';
import { getEffectivePolicy } from '@ai-visibility/copilot';
import { planActions } from '@ai-visibility/copilot';
import { createExecutor } from '@ai-visibility/copilot';

export class CopilotPlannerWorker {
  private worker: Worker;
  private executor: any;

  constructor(connection: any) {
    this.worker = new Worker(
      'copilotPlanner',
      this.processJob.bind(this),
      {
        connection,
        concurrency: 1,
        removeOnComplete: 20,
        removeOnFail: 10,
      }
    );

    this.executor = createExecutor();
    this.setupEventHandlers();
  }

  private async processJob(job: Job<CopilotPlannerPayload>): Promise<void> {
    const { workspaceId, userId } = job.data;
    
    console.log(`Processing copilot planning for workspace ${workspaceId}`);
    
    try {
      // Get workspace copilot rule
      const rule = await prisma.copilotRule.findFirst({
        where: { workspaceId },
      });

      if (!rule) {
        console.log(`No copilot rule found for workspace ${workspaceId}`);
        return;
      }

      // Get effective policy
      const policy = getEffectivePolicy(rule, {
        workspaceId,
        userId,
        currentPageCount: 0, // This would be calculated from recent actions
        lastActionDate: new Date(),
      });

      if (policy.globalKillSwitch) {
        console.log(`Copilot disabled for workspace ${workspaceId}`);
        return;
      }

      // Get planning context
      const context = await this.getPlanningContext(workspaceId);

      // Plan actions
      const planningResult = planActions(context, policy);

      if (planningResult.proposedActions.length === 0) {
        console.log(`No actions proposed for workspace ${workspaceId}`);
        return;
      }

      console.log(`Planned ${planningResult.proposedActions.length} actions for workspace ${workspaceId}`);

      // Execute actions based on policy
      if (policy.fullAuto && !policy.requireApproval) {
        await this.executeActions(planningResult.proposedActions, workspaceId, userId);
      } else {
        await this.createPendingActions(planningResult.proposedActions, workspaceId, userId);
      }

      console.log(`Copilot planning completed for workspace ${workspaceId}`);
      
    } catch (error) {
      console.error(`Copilot planning failed: ${error.message}`);
      throw error;
    }
  }

  private async getPlanningContext(workspaceId: string): Promise<any> {
    // Get recent metrics
    const metrics = await prisma.metricDaily.findMany({
      where: { workspaceId },
      orderBy: { date: 'desc' },
      take: 7, // Last 7 days
    });

    // Get active alerts
    const alerts = await prisma.alert.findMany({
      where: { 
        workspaceId,
        resolvedAt: null,
      },
    });

    // Get recent actions
    const recentActions = await prisma.copilotAction.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get target URLs (this would come from workspace configuration)
    const targetUrls = ['https://example.com']; // Placeholder

    // Get brand facts (this would come from workspace configuration)
    const brandFacts = {
      companyName: 'Example Company',
      description: 'An example company',
      products: ['Product A', 'Product B'],
      services: ['Service A', 'Service B'],
    };

    return {
      workspaceId,
      metrics,
      alerts,
      recentActions,
      targetUrls,
      brandFacts,
    };
  }

  private async executeActions(actions: any[], workspaceId: string, userId?: string): Promise<void> {
    for (const action of actions) {
      try {
        const context = {
          workspaceId,
          userId,
          targetUrl: action.targetUrl,
          actionType: action.actionType,
          diff: `Generated ${action.actionType} for ${action.targetUrl}`,
          metadata: {
            priority: action.priority,
            confidence: action.confidence,
            reasoning: action.reasoning,
          },
        };

        const result = await this.executor.executeAction(action, context);

        if (result.success) {
          console.log(`Action executed successfully: ${action.actionType}`);
        } else {
          console.error(`Action execution failed: ${result.error}`);
        }
      } catch (error) {
        console.error(`Failed to execute action ${action.actionType}:`, error);
      }
    }
  }

  private async createPendingActions(actions: any[], workspaceId: string, userId?: string): Promise<void> {
    for (const action of actions) {
      await prisma.copilotAction.create({
        data: {
          workspaceId,
          actionType: action.actionType,
          targetUrl: action.targetUrl,
          diff: `Generated ${action.actionType} for ${action.targetUrl}`,
          status: 'PENDING',
        },
      });
    }

    console.log(`Created ${actions.length} pending actions for workspace ${workspaceId}`);
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Copilot planner job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Copilot planner job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Copilot planner worker error:', err);
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

/**
 * Cron schedulers for background jobs
 */

import { CronJob } from 'cron';
import { runBatchQueue, dailyAggregationsQueue, copilotPlannerQueue } from '../queues';

export class JobScheduler {
  private cronJobs: CronJob[] = [];

  constructor() {
    this.setupSchedulers();
  }

  private setupSchedulers(): void {
    // Weekly batch runs - every Monday at 9 AM
    const weeklyBatchJob = new CronJob(
      '0 9 * * 1', // Monday at 9 AM
      async () => {
        console.log('Starting weekly batch run...');
        await this.scheduleWeeklyBatch();
      },
      null,
      true,
      'UTC'
    );

    // Daily aggregations - every day at 2 AM
    const dailyAggregationsJob = new CronJob(
      '0 2 * * *', // Every day at 2 AM
      async () => {
        console.log('Starting daily aggregations...');
        await this.scheduleDailyAggregations();
      },
      null,
      true,
      'UTC'
    );

    // Weekly copilot planning - every Sunday at 10 PM
    const copilotPlanningJob = new CronJob(
      '0 22 * * 0', // Sunday at 10 PM
      async () => {
        console.log('Starting copilot planning...');
        await this.scheduleCopilotPlanning();
      },
      null,
      true,
      'UTC'
    );

    this.cronJobs = [weeklyBatchJob, dailyAggregationsJob, copilotPlanningJob];
  }

  private async scheduleWeeklyBatch(): Promise<void> {
    try {
      // Get all active workspaces
      const workspaces = await this.getActiveWorkspaces();
      
      for (const workspace of workspaces) {
        // Get active prompts and engines
        const prompts = await this.getActivePrompts(workspace.id);
        const engines = await this.getActiveEngines(workspace.id);
        
        if (prompts.length === 0 || engines.length === 0) {
          console.log(`Skipping workspace ${workspace.id} - no active prompts or engines`);
          continue;
        }

        // Calculate budget (this would come from workspace configuration)
        const budgetCents = workspace.dailyBudgetCents * 7; // Weekly budget
        
        // Add batch job
        await runBatchQueue.add('weeklyBatch', {
          workspaceId: workspace.id,
          promptIds: prompts.map(p => p.id),
          engineKeys: engines.map(e => e.key),
          budgetCents,
        });

        console.log(`Scheduled weekly batch for workspace ${workspace.id}`);
      }
    } catch (error) {
      console.error('Failed to schedule weekly batch:', error);
    }
  }

  private async scheduleDailyAggregations(): Promise<void> {
    try {
      // Get all workspaces
      const workspaces = await this.getActiveWorkspaces();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      for (const workspace of workspaces) {
        await dailyAggregationsQueue.add('dailyAggregations', {
          workspaceId: workspace.id,
          date: yesterday.toISOString().split('T')[0],
        });
      }
      
      console.log(`Scheduled daily aggregations for ${workspaces.length} workspaces`);
    } catch (error) {
      console.error('Failed to schedule daily aggregations:', error);
    }
  }

  private async scheduleCopilotPlanning(): Promise<void> {
    try {
      // Get workspaces with copilot enabled
      const workspaces = await this.getCopilotEnabledWorkspaces();
      
      for (const workspace of workspaces) {
        await copilotPlannerQueue.add('copilotPlanning', {
          workspaceId: workspace.id,
        });
      }
      
      console.log(`Scheduled copilot planning for ${workspaces.length} workspaces`);
    } catch (error) {
      console.error('Failed to schedule copilot planning:', error);
    }
  }

  private async getActiveWorkspaces(): Promise<any[]> {
    // This would query the database for active workspaces
    // For now, return mock data
    return [
      { id: 'workspace-1', dailyBudgetCents: 1000 },
      { id: 'workspace-2', dailyBudgetCents: 2000 },
    ];
  }

  private async getActivePrompts(workspaceId: string): Promise<any[]> {
    // This would query the database for active prompts
    // For now, return mock data
    return [
      { id: 'prompt-1' },
      { id: 'prompt-2' },
    ];
  }

  private async getActiveEngines(workspaceId: string): Promise<any[]> {
    // This would query the database for active engines
    // For now, return mock data
    return [
      { id: 'engine-1', key: 'PERPLEXITY' },
      { id: 'engine-2', key: 'AIO' },
    ];
  }

  private async getCopilotEnabledWorkspaces(): Promise<any[]> {
    // This would query the database for workspaces with copilot enabled
    // For now, return mock data
    return [
      { id: 'workspace-1' },
      { id: 'workspace-2' },
    ];
  }

  start(): void {
    console.log('Starting job schedulers...');
    this.cronJobs.forEach(job => job.start());
    console.log('Job schedulers started');
  }

  stop(): void {
    console.log('Stopping job schedulers...');
    this.cronJobs.forEach(job => job.stop());
    console.log('Job schedulers stopped');
  }
}

// Create and export scheduler instance
export const jobScheduler = new JobScheduler();

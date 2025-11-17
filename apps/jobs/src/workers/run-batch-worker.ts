/**
 * RunBatch worker
 * Executes batch prompt runs with budget management
 */

import { Worker, Job } from 'bullmq';
// @ts-ignore - Workspace package resolution
import { prisma } from '@ai-visibility/db';
import { EngineKey } from '@ai-visibility/shared';
import { RunBatchPayload } from '../queues';
import { runPromptQueue } from '../queues';

export class RunBatchWorker {
  private worker: Worker;

  constructor(connection: any) {
    this.worker = new Worker(
      'runBatch',
      this.processJob.bind(this),
      {
        connection,
        concurrency: 2,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 25 },
      }
    );

    this.setupEventHandlers();
  }

  private async processJob(job: Job<RunBatchPayload>): Promise<void> {
    const { workspaceId, promptIds, engineKeys, budgetCents, userId } = job.data;
    
    console.log(`Processing batch run: ${promptIds.length} prompts, ${engineKeys.length} engines`);
    
    try {
      // Get workspace engines
      const engines = await prisma.engine.findMany({
        where: {
          workspaceId,
          key: { in: engineKeys as EngineKey[] },
          enabled: true,
        },
      });

      if (engines.length === 0) {
        throw new Error('No enabled engines found');
      }

      // Calculate budget per engine
      const budgetPerEngine = Math.floor(budgetCents / engines.length);
      
      // Get active prompts
      const prompts = await prisma.prompt.findMany({
        where: {
          id: { in: promptIds },
          workspaceId,
          active: true,
        },
      });

      if (prompts.length === 0) {
        throw new Error('No active prompts found');
      }

      // Create jobs for each prompt-engine combination
      const jobs = [];
      let totalJobs = 0;
      let totalBudget = 0;

      for (const prompt of prompts) {
        for (const engine of engines) {
          // Check if we've exceeded budget
          if (totalBudget >= budgetCents) {
            console.log(`Budget limit reached: ${totalBudget}/${budgetCents} cents`);
            break;
          }

          // Generate idempotency key
          const idempotencyKey = this.generateIdempotencyKey(
            workspaceId,
            prompt.id,
            engine.key,
            new Date()
          );

          // Check if job already exists
          const existingRun = await prisma.promptRun.findUnique({
            where: { idempotencyKey },
          });

          if (existingRun) {
            console.log(`Job already exists: ${idempotencyKey}`);
            continue;
          }

          // Create job
          const jobData = {
            workspaceId,
            promptId: prompt.id,
            engineKey: engine.key,
            idempotencyKey,
            userId,
          };

          jobs.push({
            name: 'runPrompt',
            data: jobData,
            opts: {
              priority: this.calculatePriority(prompt, engine),
              delay: this.calculateDelay(totalJobs),
            },
          });

          totalJobs++;
          totalBudget += Math.min(budgetPerEngine, 100); // Estimate 100 cents per job
        }
      }

      // Add jobs to queue
      if (jobs.length > 0) {
        await runPromptQueue.addBulk(jobs);
        console.log(`Added ${jobs.length} jobs to runPrompt queue`);
      } else {
        console.log('No new jobs to add');
      }

      // Update job progress
      await job.updateProgress(100);
      
    } catch (error) {
      console.error(`Batch run failed: ${error.message}`);
      throw error;
    }
  }

  private generateIdempotencyKey(
    workspaceId: string,
    promptId: string,
    engineKey: string,
    date: Date
  ): string {
    const week = this.getWeekNumber(date);
    const input = `${workspaceId}-${promptId}-${engineKey}-${week}`;
    return `batch_${require('crypto').createHash('md5').update(input).digest('hex')}`;
  }

  private getWeekNumber(date: Date): string {
    const start = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + start.getDay() + 1) / 7).toString();
  }

  private calculatePriority(prompt: any, engine: any): number {
    // Higher priority for more important prompts and engines
    let priority = 0;
    
    if (prompt.intent === 'BEST') priority += 10;
    if (prompt.intent === 'ALTERNATIVES') priority += 8;
    if (prompt.intent === 'HOWTO') priority += 6;
    
    if (engine.key === 'PERPLEXITY') priority += 5;
    if (engine.key === 'AIO') priority += 3;
    if (engine.key === 'BRAVE') priority += 1;
    
    return priority;
  }

  private calculateDelay(jobIndex: number): number {
    // Stagger jobs to avoid overwhelming providers
    return jobIndex * 1000; // 1 second delay between jobs
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Batch job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Batch job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Batch worker error:', err);
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

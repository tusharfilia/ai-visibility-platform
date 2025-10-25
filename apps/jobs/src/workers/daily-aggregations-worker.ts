/**
 * Daily aggregations worker
 * Computes daily metrics and SOV calculations
 */

import { Worker, Job } from 'bullmq';
import { prisma } from '@ai-visibility-platform/db';
import { EngineKey } from '@ai-visibility/shared';
import { DailyAggregationsPayload } from '../queues';

export class DailyAggregationsWorker {
  private worker: Worker;

  constructor(connection: any) {
    this.worker = new Worker(
      'dailyAggregations',
      this.processJob.bind(this),
      {
        connection,
        concurrency: 1,
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 15 },
      }
    );

    this.setupEventHandlers();
  }

  private async processJob(job: Job<DailyAggregationsPayload>): Promise<void> {
    const { workspaceId, date } = job.data;
    
    console.log(`Processing daily aggregations for workspace ${workspaceId} on ${date}`);
    
    try {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all engines for workspace
      const engines = await prisma.engine.findMany({
        where: { workspaceId, enabled: true },
      });

      for (const engine of engines) {
        await this.calculateEngineMetrics(workspaceId, engine.key, startOfDay, endOfDay);
      }

      console.log(`Daily aggregations completed for workspace ${workspaceId}`);
      
    } catch (error) {
      console.error(`Daily aggregations failed: ${error.message}`);
      throw error;
    }
  }

  private async calculateEngineMetrics(
    workspaceId: string,
    engineKey: EngineKey,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    // Get prompt runs for the day
    const runs = await prisma.promptRun.findMany({
      where: {
        workspaceId,
        engineId: { in: await this.getEngineIds(workspaceId, engineKey) },
        startedAt: { gte: startDate, lte: endDate },
        status: 'SUCCESS',
      },
      include: {
        answer: {
          include: {
            mentions: true,
            citations: true,
          },
        },
      },
    });

    if (runs.length === 0) {
      console.log(`No successful runs found for ${engineKey} on ${startDate.toISOString()}`);
      return;
    }

    // Calculate metrics
    const totalRuns = runs.length;
    const runsWithMentions = runs.filter(run => run.answer?.mentions.length > 0);
    const totalMentions = runs.reduce((sum, run) => sum + (run.answer?.mentions.length || 0), 0);
    const totalCitations = runs.reduce((sum, run) => sum + (run.answer?.citations.length || 0), 0);
    
    // Calculate SOV (Share of Voice)
    const promptSOV = (runsWithMentions.length / totalRuns) * 100;
    
    // Calculate coverage (percentage of engines with mentions)
    const enginesWithMentions = new Set(runsWithMentions.map(run => run.engineId));
    const totalEngines = await this.getEngineIds(workspaceId, engineKey);
    const coverage = (enginesWithMentions.size / totalEngines.length) * 100;
    
    // Calculate AIO impressions (proxy for AI Overview visibility)
    const aioImpressions = runs.filter(run => 
      run.answer?.citations.some(citation => citation.domain.includes('google.com'))
    ).length;

    // Create or update daily metrics
    await prisma.metricDaily.upsert({
      where: {
        workspaceId_engineKey_date: {
          workspaceId,
          engineKey,
          date: startDate,
        },
      },
      update: {
        promptSOV,
        coverage,
        citationCount: totalCitations,
        aioImpressions,
      },
      create: {
        workspaceId,
        engineKey,
        date: startDate,
        promptSOV,
        coverage,
        citationCount: totalCitations,
        aioImpressions,
      },
    });

    console.log(`Metrics calculated for ${engineKey}: SOV=${promptSOV.toFixed(1)}%, Coverage=${coverage.toFixed(1)}%, Citations=${totalCitations}`);
  }

  private async getEngineIds(workspaceId: string, engineKey: EngineKey): Promise<string[]> {
    const engines = await prisma.engine.findMany({
      where: { workspaceId, key: engineKey },
      select: { id: true },
    });
    
    return engines.map(engine => engine.id);
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Daily aggregations job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Daily aggregations job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Daily aggregations worker error:', err);
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

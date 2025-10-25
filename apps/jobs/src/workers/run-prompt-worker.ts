/**
 * RunPrompt worker
 * Executes individual prompt runs with providers
 */

import { Worker, Job } from 'bullmq';
import { Pool } from 'pg';
import { createProvider } from '@ai-visibility/providers';
import { EngineKey } from '@ai-visibility/shared';
import { extractMentions, extractCitations, classifySentiment } from '@ai-visibility/parser';
import { RunPromptPayload } from '../queues';
import { createHash } from 'crypto';

export class RunPromptWorker {
  private worker: Worker;
  private dbPool: Pool;

  constructor(connection: any) {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    this.worker = new Worker(
      'runPrompt',
      this.processJob.bind(this),
      {
        connection,
        concurrency: 5,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      }
    );

    this.setupEventHandlers();
  }

  private async processJob(job: Job<RunPromptPayload>): Promise<void> {
    const { workspaceId, promptId, engineKey, idempotencyKey, userId } = job.data;
    
    console.log(`Processing prompt run: ${promptId} with ${engineKey}`);
    
    try {
      // Check idempotency
      const existingRunResult = await this.dbPool.query(
        'SELECT id FROM "PromptRun" WHERE "idempotencyKey" = $1',
        [idempotencyKey]
      );
      
      if (existingRunResult.rows.length > 0) {
        console.log(`Prompt run already exists: ${idempotencyKey}`);
        return;
      }

      // Get prompt and engine
      const promptResult = await this.dbPool.query(
        'SELECT * FROM "Prompt" WHERE id = $1',
        [promptId]
      );
      const prompt = promptResult.rows[0];
      
      if (!prompt) {
        throw new Error(`Prompt not found: ${promptId}`);
      }

      const engineResult = await this.dbPool.query(
        'SELECT * FROM "Engine" WHERE "workspaceId" = $1 AND key = $2 AND enabled = true',
        [workspaceId, engineKey]
      );
      const engine = engineResult.rows[0];
      
      if (!engine) {
        throw new Error(`Engine not found or disabled: ${engineKey}`);
      }

      // Check budget
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayRuns = await prisma.promptRun.findMany({
        where: {
          workspaceId,
          engineId: engine.id,
          startedAt: { gte: today },
        },
      });
      
      const todayCost = todayRuns.reduce((sum, run) => sum + run.costCents, 0);
      
      if (todayCost >= engine.dailyBudgetCents) {
        throw new Error(`Daily budget exceeded for engine ${engineKey}`);
      }

      // Create prompt run
      const promptRun = await prisma.promptRun.create({
        data: {
          workspaceId,
          promptId,
          engineId: engine.id,
          idempotencyKey,
          status: 'PENDING',
          startedAt: new Date(),
        },
      });

      // Get provider
      const provider = createProvider(engineKey as EngineKey, {
        apiKey: process.env[`${engineKey}_API_KEY`],
      });

      // Execute prompt
      const startTime = Date.now();
      const result = await provider.ask(prompt.text);
      const executionTime = Date.now() - startTime;

      // Parse results
      const mentions = extractMentions(result.answerText, [], {});
      const citations = extractCitations(result.answerText, {});
      const sentiment = classifySentiment(result.answerText);

      // Create answer
      const answer = await prisma.answer.create({
        data: {
          promptRunId: promptRun.id,
          rawText: result.answerText,
          jsonPayload: result.meta,
        },
      });

      // Create mentions
      for (const mention of mentions) {
        await prisma.mention.create({
          data: {
            answerId: answer.id,
            brand: mention.brand,
            position: mention.position,
            sentiment: mention.sentiment,
            snippet: mention.snippet,
          },
        });
      }

      // Create citations
      for (const citation of citations) {
        await prisma.citation.create({
          data: {
            answerId: answer.id,
            url: citation.url,
            domain: citation.domain,
            rank: citation.rank,
            confidence: citation.confidence,
          },
        });
      }

      // Update prompt run
      await prisma.promptRun.update({
        where: { id: promptRun.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          costCents: result.costCents || 0,
          avgLatencyMs: executionTime,
        },
      });

      // Update engine
      await prisma.engine.update({
        where: { id: engine.id },
        data: {
          lastRunAt: new Date(),
          avgLatencyMs: executionTime,
        },
      });

      console.log(`Prompt run completed: ${promptRun.id}`);
      
    } catch (error) {
      console.error(`Prompt run failed: ${error.message}`);
      
      // Update prompt run with error
      await prisma.promptRun.update({
        where: { idempotencyKey },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorMsg: error.message,
        },
      });
      
      throw error;
    }
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    this.worker.on('error', (err) => {
      console.error('Worker error:', err);
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

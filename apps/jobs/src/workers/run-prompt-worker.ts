/**
 * RunPrompt worker
 * Executes individual prompt runs with providers
 */

import { Worker, Job } from 'bullmq';
import { Pool } from 'pg';
import { createProvider } from '@ai-visibility/providers';
import { EngineKey } from '@ai-visibility/shared';
import { extractMentions, extractCitations, classifySentiment } from '@ai-visibility/parser';
import { HallucinationDetectorService } from '@ai-visibility/geo/validation/hallucination-detector.service';
import { RunPromptPayload } from '../queues';
import { createHash } from 'crypto';

export interface ClusterScanPayload {
  workspaceId: string;
  clusterId: string;
  engineKeys: EngineKey[];
  idempotencyKey: string;
  userId: string;
  maxPromptsPerCluster?: number;
}

export class RunPromptWorker {
  private worker: Worker;
  private dbPool: Pool;
  private hallucinationDetector: HallucinationDetectorService;

  constructor(connection: any) {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    
    // Initialize hallucination detector
    this.hallucinationDetector = new HallucinationDetectorService();
    
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

  private async processJob(job: Job<RunPromptPayload | ClusterScanPayload>): Promise<void> {
    // Check if this is a cluster scan or individual prompt
    if ('clusterId' in job.data) {
      return this.processClusterScan(job as Job<ClusterScanPayload>);
    } else {
      return this.processIndividualPrompt(job as Job<RunPromptPayload>);
    }
  }

  /**
   * Process cluster-based scanning
   */
  private async processClusterScan(job: Job<ClusterScanPayload>): Promise<void> {
    const { workspaceId, clusterId, engineKeys, idempotencyKey, userId, maxPromptsPerCluster = 10 } = job.data;
    
    console.log(`Processing cluster scan: ${clusterId} with engines: ${engineKeys.join(', ')}`);
    
    try {
      // Get cluster prompts
      const clusterResult = await this.dbPool.query(
        'SELECT * FROM "PromptCluster" WHERE id = $1 AND "workspaceId" = $2',
        [clusterId, workspaceId]
      );
      const cluster = clusterResult.rows[0];
      
      if (!cluster) {
        throw new Error(`Cluster not found: ${clusterId}`);
      }

      // Select top prompts from cluster
      const prompts = cluster.prompts.slice(0, maxPromptsPerCluster);
      
      // Create individual prompt runs for each prompt-engine combination
      const promptRuns = [];
      
      for (const promptText of prompts) {
        for (const engineKey of engineKeys) {
          const promptRunIdempotencyKey = `${idempotencyKey}:${promptText}:${engineKey}`;
          
          // Check if prompt run already exists
          const existingRun = await this.dbPool.query(
            'SELECT id FROM "PromptRun" WHERE "idempotencyKey" = $1',
            [promptRunIdempotencyKey]
          );
          
          if (existingRun.rows.length > 0) {
            console.log(`Prompt run already exists: ${promptRunIdempotencyKey}`);
            continue;
          }

          // Create or get prompt
          const promptId = await this.getOrCreatePrompt(workspaceId, promptText, cluster.intent);
          
          // Create prompt run
          const promptRun = await this.dbPool.query(
            `INSERT INTO "PromptRun" 
             ("workspaceId", "promptId", "engineId", "idempotencyKey", "status", "startedAt")
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [workspaceId, promptId, clusterId, promptRunIdempotencyKey, 'PENDING', new Date()]
          );

          promptRuns.push(promptRun.rows[0]);
        }
      }

      console.log(`Created ${promptRuns.length} prompt runs for cluster ${clusterId}`);
      
    } catch (error) {
      console.error(`Cluster scan failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process individual prompt
   */
  private async processIndividualPrompt(job: Job<RunPromptPayload>): Promise<void> {
    const { workspaceId, promptId, engineKey, idempotencyKey, userId, demoRunId } = job.data;
    
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

      // Detect hallucinations
      try {
        await this.detectHallucinations(workspaceId, result.answerText, engineKey, promptId);
      } catch (hallucinationError) {
        console.warn(`Hallucination detection failed: ${hallucinationError.message}`);
        // Don't fail the job if hallucination detection fails
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

      if (demoRunId) {
        await this.markDemoRunJobSuccess(demoRunId);
      }
      
    } catch (error) {
      console.error(`Prompt run failed: ${error.message}`);
      
      // Update prompt run with error
      try {
        await prisma.promptRun.update({
          where: { idempotencyKey },
          data: {
            status: 'FAILED',
            finishedAt: new Date(),
            errorMsg: error.message,
          },
        });
      } catch (updateError) {
        const message = updateError instanceof Error ? updateError.message : String(updateError);
        console.warn(`Unable to persist prompt run failure for ${idempotencyKey}: ${message}`);
      }

      if (demoRunId) {
        await this.markDemoRunJobFailure(demoRunId);
      }

      throw error;
    }
  }

  private async markDemoRunJobSuccess(demoRunId: string): Promise<void> {
    try {
      await this.dbPool.query(
        `UPDATE "demo_runs"
         SET "analysisJobsCompleted" = COALESCE("analysisJobsCompleted", 0) + 1,
             "progress" = LEAST(
               100,
               CASE
                 WHEN COALESCE("analysisJobsTotal", 0) = 0 THEN GREATEST("progress", 95)
                 ELSE GREATEST(
                   "progress",
                   80 + COALESCE(ROUND(((COALESCE("analysisJobsCompleted", 0) + 1)::numeric / NULLIF("analysisJobsTotal", 0)) * 20)::int, 0)
                 )
               END
             ),
             "status" = CASE
               WHEN COALESCE("analysisJobsTotal", 0) > 0
                    AND (COALESCE("analysisJobsCompleted", 0) + 1 + COALESCE("analysisJobsFailed", 0)) >= "analysisJobsTotal"
                 THEN 'analysis_complete'
               ELSE "status"
             END,
             "updatedAt" = NOW()
         WHERE "id" = $1`,
        [demoRunId]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Failed to update demo run success metrics for ${demoRunId}: ${message}`);
    }
  }

  private async markDemoRunJobFailure(demoRunId: string): Promise<void> {
    try {
      await this.dbPool.query(
        `UPDATE "demo_runs"
         SET "analysisJobsFailed" = COALESCE("analysisJobsFailed", 0) + 1,
             "progress" = LEAST(
               100,
               CASE
                 WHEN COALESCE("analysisJobsTotal", 0) = 0 THEN GREATEST("progress", 95)
                 ELSE GREATEST(
                   "progress",
                   80 + COALESCE(ROUND(((COALESCE("analysisJobsCompleted", 0) + COALESCE("analysisJobsFailed", 0) + 1)::numeric / NULLIF("analysisJobsTotal", 0)) * 20)::int, 0)
                 )
               END
             ),
             "status" = CASE
               WHEN COALESCE("analysisJobsTotal", 0) > 0
                    AND (COALESCE("analysisJobsCompleted", 0) + COALESCE("analysisJobsFailed", 0) + 1) >= "analysisJobsTotal"
                 THEN CASE
                   WHEN COALESCE("analysisJobsCompleted", 0) = 0 THEN 'analysis_failed'
                   ELSE 'analysis_complete'
                 END
               ELSE "status"
             END,
             "updatedAt" = NOW()
         WHERE "id" = $1`,
        [demoRunId]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Failed to update demo run failure metrics for ${demoRunId}: ${message}`);
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

  /**
   * Detect hallucinations in AI response
   */
  private async detectHallucinations(
    workspaceId: string,
    aiResponse: string,
    engineKey: string,
    promptId: string
  ): Promise<void> {
    try {
      // Get workspace profile
      const profileResult = await this.dbPool.query(
        'SELECT * FROM "WorkspaceProfile" WHERE "workspaceId" = $1',
        [workspaceId]
      );
      
      if (profileResult.rows.length === 0) {
        console.log(`No workspace profile found for ${workspaceId}, skipping hallucination detection`);
        return;
      }
      
      const profile = profileResult.rows[0];
      
      // Detect hallucinations
      const alerts = await this.hallucinationDetector.detectHallucinations(
        workspaceId,
        aiResponse,
        engineKey,
        promptId,
        profile,
        {
          minConfidence: 0.7,
          severityThreshold: 'medium'
        }
      );
      
      // Store alerts in database
      for (const alert of alerts) {
        await this.dbPool.query(
          `INSERT INTO "HallucinationAlert" 
           ("workspaceId", "engineKey", "promptId", "factType", "aiStatement", 
            "correctFact", "severity", "status", "confidence", "context", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            alert.workspaceId,
            alert.engineKey,
            alert.promptId,
            alert.factType,
            alert.aiStatement,
            alert.correctFact,
            alert.severity,
            alert.status,
            alert.confidence,
            alert.context,
            alert.createdAt,
            alert.updatedAt
          ]
        );
      }
      
      if (alerts.length > 0) {
        console.log(`Detected ${alerts.length} hallucinations for prompt ${promptId}`);
      }
      
    } catch (error) {
      console.error(`Hallucination detection failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get or create prompt
   */
  private async getOrCreatePrompt(workspaceId: string, text: string, intent: string): Promise<string> {
    // Check if prompt already exists
    const existingPrompt = await this.dbPool.query(
      'SELECT id FROM "Prompt" WHERE "workspaceId" = $1 AND text = $2',
      [workspaceId, text]
    );
    
    if (existingPrompt.rows.length > 0) {
      return existingPrompt.rows[0].id;
    }
    
    // Create new prompt
    const newPrompt = await this.dbPool.query(
      `INSERT INTO "Prompt" ("workspaceId", text, intent, active, tags)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [workspaceId, text, intent, true, []]
    );
    
    return newPrompt.rows[0].id;
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}

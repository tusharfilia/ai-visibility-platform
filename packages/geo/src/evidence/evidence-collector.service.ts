import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';

export interface PromptEvidence {
  prompt: string;
  engine: string;
  rawOutput: string;
  rawOutputExcerpt: string; // First 500 chars
  brandsFound: string[];
  order: string[];
  confidence: number;
  timestamp: Date;
  promptRunId: string;
  answerId: string;
}

export interface CitationEvidence {
  citationId: string;
  domain: string;
  url: string;
  snippet: string; // Quote where business appears
  context: string; // Why it counts as citation
  category: 'news' | 'blog' | 'review' | 'directory' | 'social' | 'other';
  domainAuthority?: number;
  foundInPrompt: string;
  foundInEngine: string;
  timestamp: Date;
}

export interface ShareOfVoiceEvidence {
  entity: string;
  prompt: string;
  engine: string;
  appeared: boolean;
  position?: number; // 1-based ranking
  rawExcerpt: string;
  confidence: number;
  commercialIntent: number; // 0-1, how commercial is this prompt
  industryRelevance: number; // 0-1, how relevant to industry
}

@Injectable()
export class EvidenceCollectorService {
  private readonly logger = new Logger(EvidenceCollectorService.name);

  private dbPool: Pool;

  constructor() {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Collect evidence for a specific prompt across all engines
   */
  async collectPromptEvidence(
    workspaceId: string,
    promptText: string
  ): Promise<PromptEvidence[]> {
    const evidence: PromptEvidence[] = [];

    try {
      const promptRunsResult = await this.dbPool.query<{
        promptRunId: string;
        answerId: string;
        engine: string;
        answerText: string;
        createdAt: Date;
      }>(
        `SELECT
           pr.id AS "promptRunId",
           a.id AS "answerId",
           e."key" AS "engine",
           a."answerText",
           pr."createdAt"
         FROM "prompt_runs" pr
         JOIN "prompts" p ON p.id = pr."promptId"
         JOIN "engines" e ON e.id = pr."engineId"
         JOIN "answers" a ON a."promptRunId" = pr.id
         WHERE pr."workspaceId" = $1
           AND p."text" = $2
           AND pr."status" = 'SUCCESS'
           AND 'demo' = ANY(p."tags")`,
        [workspaceId, promptText]
      );

      const promptRuns = promptRunsResult.rows;
      for (const run of promptRuns) {
        // Extract brands from answer
        const brands = await this.extractBrandsFromAnswer(run.answerId);
        
        // Determine order (first mention = first position)
        const order = this.determineBrandOrder(run.answerText, brands);
        
        // Calculate confidence based on answer quality
        const confidence = this.calculateConfidence(run.answerText, brands.length);

        evidence.push({
          prompt: promptText,
          engine: run.engine,
          rawOutput: run.answerText,
          rawOutputExcerpt: run.answerText.substring(0, 500),
          brandsFound: brands,
          order,
          confidence,
          timestamp: run.createdAt,
          promptRunId: run.promptRunId,
          answerId: run.answerId,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to collect prompt evidence: ${error instanceof Error ? error.message : String(error)}`);
    }

    return evidence;
  }

  /**
   * Collect citation evidence with context
   */
  async collectCitationEvidence(
    workspaceId: string,
    domain?: string
  ): Promise<CitationEvidence[]> {
    const evidence: CitationEvidence[] = [];

    try {
      const citationsResult = await this.dbPool.query<{
        citationId: string;
        domain: string;
        url: string;
        promptText: string;
        engine: string;
        answerText: string;
        createdAt: Date;
      }>(
        `SELECT
           c.id AS "citationId",
           c."domain",
           c."url",
           p."text" AS "promptText",
           e."key" AS "engine",
           a."answerText",
           c."createdAt"
         FROM "citations" c
         JOIN "answers" a ON a.id = c."answerId"
         JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
         JOIN "prompts" p ON p.id = pr."promptId"
         JOIN "engines" e ON e.id = pr."engineId"
         WHERE pr."workspaceId" = $1
           ${domain ? `AND c."domain" LIKE $2` : ''}
           AND 'demo' = ANY(p."tags")
         ORDER BY c."createdAt" DESC
         LIMIT 100`,
        domain ? [workspaceId, `%${domain}%`] : [workspaceId]
      );

      for (const citation of citations) {
        // Extract snippet where domain appears
        const snippet = this.extractSnippet(citation.answerText, citation.domain);
        
        // Determine category
        const category = this.categorizeCitation(citation.domain, citation.url);
        
        // Explain why it counts
        const context = this.explainCitation(citation.domain, category, snippet);

        evidence.push({
          citationId: citation.citationId,
          domain: citation.domain,
          url: citation.url,
          snippet,
          context,
          category,
          foundInPrompt: citation.promptText,
          foundInEngine: citation.engine,
          timestamp: citation.createdAt,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to collect citation evidence: ${error instanceof Error ? error.message : String(error)}`);
    }

    return evidence;
  }

  /**
   * Collect Share of Voice evidence per prompt × engine
   */
  async collectShareOfVoiceEvidence(
    workspaceId: string,
    entityName: string
  ): Promise<ShareOfVoiceEvidence[]> {
    const evidence: ShareOfVoiceEvidence[] = [];

    try {
      const mentions = await this.prisma.$queryRaw<{
        promptText: string;
        engine: string;
        answerText: string;
        position: number;
        sentiment: string;
      }>(
        `SELECT
           p."text" AS "promptText",
           e."key" AS "engine",
           a."answerText",
           ROW_NUMBER() OVER (PARTITION BY pr.id ORDER BY m."createdAt") AS "position",
           m."sentiment"
         FROM "mentions" m
         JOIN "answers" a ON a.id = m."answerId"
         JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
         JOIN "prompts" p ON p.id = pr."promptId"
         JOIN "engines" e ON e.id = pr."engineId"
         WHERE pr."workspaceId" = $1
           AND LOWER(m."brand") = LOWER($2)
           AND pr."status" = 'SUCCESS'
           AND 'demo' = ANY(p."tags")`,
        [workspaceId, entityName]
      );

      for (const mention of mentions) {
        const appeared = true; // If we found a mention, it appeared
        const rawExcerpt = this.extractContext(mention.answerText, entityName);
        const commercialIntent = this.assessCommercialIntent(mention.promptText);
        const industryRelevance = 1.0; // Would need industry context to calculate

        evidence.push({
          entity: entityName,
          prompt: mention.promptText,
          engine: mention.engine,
          appeared,
          position: mention.position,
          rawExcerpt,
          confidence: 0.9, // High confidence if mention found
          commercialIntent,
          industryRelevance,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to collect SoV evidence: ${error instanceof Error ? error.message : String(error)}`);
    }

    return evidence;
  }

  /**
   * Extract brands from answer text using mentions table
   */
  private async extractBrandsFromAnswer(answerId: string): Promise<string[]> {
    try {
      const mentionsResult = await this.dbPool.query<{ brand: string }>(
        `SELECT DISTINCT m."brand"
         FROM "mentions" m
         WHERE m."answerId" = $1`,
        [answerId]
      );

      return mentionsResult.rows.map(m => m.brand);
    } catch (error) {
      return [];
    }
  }

  /**
   * Determine brand order based on first mention in text
   */
  private determineBrandOrder(answerText: string, brands: string[]): string[] {
    const order: string[] = [];
    const textLower = answerText.toLowerCase();
    const positions: Array<{ brand: string; position: number }> = [];

    for (const brand of brands) {
      const position = textLower.indexOf(brand.toLowerCase());
      if (position >= 0) {
        positions.push({ brand, position });
      }
    }

    positions.sort((a, b) => a.position - b.position);
    return positions.map(p => p.brand);
  }

  /**
   * Calculate confidence based on answer quality
   */
  private calculateConfidence(answerText: string, brandCount: number): number {
    let confidence = 0.5;

    // Longer answers are more reliable
    if (answerText.length > 500) confidence += 0.2;
    if (answerText.length > 1000) confidence += 0.1;

    // Multiple brands mentioned suggests comprehensive answer
    if (brandCount > 1) confidence += 0.1;
    if (brandCount > 3) confidence += 0.1;

    return Math.min(1.0, confidence);
  }

  /**
   * Extract snippet where domain appears
   */
  private extractSnippet(answerText: string, domain: string): string {
    const domainLower = domain.toLowerCase();
    const textLower = answerText.toLowerCase();
    const index = textLower.indexOf(domainLower);

    if (index >= 0) {
      const start = Math.max(0, index - 100);
      const end = Math.min(answerText.length, index + domain.length + 100);
      return answerText.substring(start, end);
    }

    return answerText.substring(0, 200); // Fallback
  }

  /**
   * Categorize citation
   */
  private categorizeCitation(domain: string, url: string): 'news' | 'blog' | 'review' | 'directory' | 'social' | 'other' {
    const domainLower = domain.toLowerCase();
    const urlLower = url.toLowerCase();

    if (domainLower.includes('reddit.com')) return 'social';
    if (domainLower.includes('yelp.com') || domainLower.includes('tripadvisor.com')) return 'review';
    if (domainLower.includes('google.com') || domainLower.includes('bing.com')) return 'directory';
    if (domainLower.includes('nytimes.com') || domainLower.includes('wsj.com') || 
        domainLower.includes('reuters.com') || domainLower.includes('bbc.com')) return 'news';
    if (urlLower.includes('/blog/') || urlLower.includes('/article/')) return 'blog';

    return 'other';
  }

  /**
   * Explain why citation counts
   */
  private explainCitation(domain: string, category: string, snippet: string): string {
    const explanations: Record<string, string> = {
      news: `Cited in news article from ${domain}, indicating media coverage and public awareness`,
      blog: `Mentioned in blog post from ${domain}, showing content marketing reach`,
      review: `Appears in review platform ${domain}, indicating customer feedback presence`,
      directory: `Listed in directory ${domain}, showing business directory presence`,
      social: `Discussed on ${domain}, indicating social media/community engagement`,
      other: `Referenced on ${domain}, showing web presence`,
    };

    return explanations[category] || explanations.other;
  }

  /**
   * Extract context around entity mention
   */
  private extractContext(answerText: string, entityName: string): string {
    const entityLower = entityName.toLowerCase();
    const textLower = answerText.toLowerCase();
    const index = textLower.indexOf(entityLower);

    if (index >= 0) {
      const start = Math.max(0, index - 150);
      const end = Math.min(answerText.length, index + entityName.length + 150);
      return answerText.substring(start, end);
    }

    return answerText.substring(0, 300);
  }

  /**
   * Assess commercial intent of prompt
   */
  private assessCommercialIntent(promptText: string): number {
    const text = promptText.toLowerCase();
    let score = 0.5; // Base score

    // High commercial intent
    if (text.includes('buy') || text.includes('purchase') || text.includes('price') || 
        text.includes('cost') || text.includes('best') || text.includes('top')) {
      score = 0.9;
    }

    // Medium commercial intent
    if (text.includes('compare') || text.includes('alternative') || text.includes('vs')) {
      score = 0.7;
    }

    // Lower commercial intent
    if (text.includes('how to') || text.includes('what is') || text.includes('guide')) {
      score = 0.3;
    }

    return score;
  }
}


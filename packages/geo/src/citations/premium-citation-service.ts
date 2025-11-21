import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { CitationClassifierService } from './citation-classifier.service';
import { PremiumCitation } from '../types/premium-response.types';

@Injectable()
export class PremiumCitationService {
  private readonly logger = new Logger(PremiumCitationService.name);
  private dbPool: Pool;

  constructor(
    private readonly citationClassifier: CitationClassifierService,
  ) {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Get premium citations with full context and evidence
   */
  async getPremiumCitations(
    workspaceId: string,
    domain?: string,
    limit: number = 50
  ): Promise<PremiumCitation[]> {
    const citations: PremiumCitation[] = [];

    try {
      const citationData = await this.dbPool.query<{
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
           AND pr."status" = 'SUCCESS'
           AND 'demo' = ANY(p."tags")
         ORDER BY c."createdAt" DESC
         LIMIT $3`,
        domain ? [workspaceId, `%${domain}%`, limit] : [workspaceId, limit]
      );
      
      const rows = citationData.rows;

      for (const citation of rows) {
        // Extract snippet
        const snippet = this.extractSnippet(citation.answerText, citation.domain);
        
        // Classify citation
        const classification = await this.citationClassifier.classifyCitation({
          domain: citation.domain,
          url: citation.url,
        });

        // Determine category
        const category = this.determineCategory(citation.domain, citation.url, classification);

        // Explain why it counts
        const context = this.explainCitation(citation.domain, category, classification, snippet);

        // Extract raw output excerpt
        const rawOutputExcerpt = citation.answerText.substring(0, 500);

        // Determine why it counts
        const whyItCounts = this.explainWhyItCounts(citation.domain, category, classification, snippet);

        // Calculate confidence
        const confidence = this.calculateConfidence(classification, category);

        citations.push({
          id: citation.citationId,
          domain: citation.domain,
          url: citation.url,
          snippet,
          context,
          category,
          sourcePage: citation.url,
          foundInPrompt: citation.promptText,
          foundInEngine: citation.engine,
          timestamp: citation.createdAt,
          classification: {
            sourceType: classification.sourceType,
            isLicensed: classification.isLicensed,
            publisherName: classification.publisherName,
            directoryType: classification.directoryType,
          },
          evidence: {
            rawOutputExcerpt,
            whyItCounts,
            confidence,
          },
        });
      }
    } catch (error) {
      this.logger.error(`Failed to get premium citations: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Sort by confidence and category importance
    return citations.sort((a, b) => {
      const scoreA = a.evidence.confidence * 100 + (a.classification.isLicensed ? 50 : 0);
      const scoreB = b.evidence.confidence * 100 + (b.classification.isLicensed ? 50 : 0);
      return scoreB - scoreA;
    });
  }

  /**
   * Extract snippet where domain appears
   */
  private extractSnippet(answerText: string, domain: string): string {
    const domainLower = domain.toLowerCase();
    const textLower = answerText.toLowerCase();
    const index = textLower.indexOf(domainLower);

    if (index >= 0) {
      const start = Math.max(0, index - 150);
      const end = Math.min(answerText.length, index + domain.length + 150);
      return answerText.substring(start, end).trim();
    }

    // Fallback: return first 300 chars
    return answerText.substring(0, 300).trim();
  }

  /**
   * Determine citation category
   */
  private determineCategory(
    domain: string,
    url: string,
    classification: any
  ): 'news' | 'blog' | 'review' | 'directory' | 'social' | 'other' {
    if (classification.sourceType === 'licensed_publisher') {
      return 'news';
    }
    if (classification.sourceType === 'reddit') {
      return 'social';
    }
    if (classification.sourceType === 'directory') {
      return 'directory';
    }

    const domainLower = domain.toLowerCase();
    const urlLower = url.toLowerCase();

    if (domainLower.includes('yelp.com') || domainLower.includes('tripadvisor.com') || 
        domainLower.includes('trustpilot.com') || domainLower.includes('g2.com')) {
      return 'review';
    }
    if (urlLower.includes('/blog/') || urlLower.includes('/article/') || 
        urlLower.includes('/post/') || domainLower.includes('medium.com')) {
      return 'blog';
    }
    if (domainLower.includes('google.com') || domainLower.includes('bing.com') ||
        domainLower.includes('yelp.com') || domainLower.includes('yellowpages.com')) {
      return 'directory';
    }

    return 'other';
  }

  /**
   * Explain why citation counts
   */
  private explainCitation(
    domain: string,
    category: string,
    classification: any,
    snippet: string
  ): string {
    if (classification.isLicensed && classification.publisherName) {
      return `Cited in ${classification.publisherName} (${domain}), a licensed publisher highly trusted by AI engines. This citation significantly boosts authoritativeness.`;
    }

    const explanations: Record<string, string> = {
      news: `Cited in news article from ${domain}, indicating media coverage and public awareness. News citations are highly valued by AI engines.`,
      blog: `Mentioned in blog post from ${domain}, showing content marketing reach and industry discussion.`,
      review: `Appears in review platform ${domain}, indicating customer feedback presence and social proof.`,
      directory: `Listed in directory ${domain}, showing business directory presence and local SEO signals.`,
      social: `Discussed on ${domain}, indicating social media/community engagement and user-generated content.`,
      other: `Referenced on ${domain}, showing web presence and potential backlink value.`,
    };

    return explanations[category] || explanations.other;
  }

  /**
   * Explain why citation counts (detailed)
   */
  private explainWhyItCounts(
    domain: string,
    category: string,
    classification: any,
    snippet: string
  ): string {
    let explanation = `This citation from ${domain} counts because: `;

    if (classification.isLicensed) {
      explanation += `It's from a licensed publisher (${classification.publisherName}), which AI engines trust highly. `;
    }

    if (category === 'news') {
      explanation += `News citations demonstrate media coverage and public awareness. `;
    } else if (category === 'review') {
      explanation += `Review platform citations show customer feedback and social proof. `;
    } else if (category === 'directory') {
      explanation += `Directory listings improve local SEO and business discoverability. `;
    } else if (category === 'blog') {
      explanation += `Blog mentions indicate content marketing reach and industry discussion. `;
    } else if (category === 'social') {
      explanation += `Social mentions show community engagement and user-generated content. `;
    }

    if (snippet.length > 50) {
      explanation += `The citation appears in context: "${snippet.substring(0, 100)}..."`;
    }

    return explanation;
  }

  /**
   * Calculate confidence for citation
   */
  private calculateConfidence(classification: any, category: string): number {
    let confidence = 0.5; // Base confidence

    if (classification.isLicensed) {
      confidence = 0.95; // Licensed publishers are highly reliable
    } else if (category === 'news') {
      confidence = 0.85;
    } else if (category === 'review') {
      confidence = 0.75;
    } else if (category === 'directory') {
      confidence = 0.70;
    } else if (category === 'blog') {
      confidence = 0.65;
    } else if (category === 'social') {
      confidence = 0.60;
    }

    return confidence;
  }
}


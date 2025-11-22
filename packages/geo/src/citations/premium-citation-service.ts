import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { CitationClassifierService } from './citation-classifier.service';
import { PremiumCitation } from '../types/premium-response.types';
import { DiagnosticIntelligenceService } from '../diagnostics/diagnostic-intelligence.service';
import {
  DiagnosticInsight,
  DiagnosticRecommendation,
} from '../types/diagnostic.types';

@Injectable()
export class PremiumCitationService {
  private readonly logger = new Logger(PremiumCitationService.name);
  private dbPool: Pool;

  constructor(
    private readonly citationClassifier: CitationClassifierService,
    private readonly diagnosticIntelligence: DiagnosticIntelligenceService,
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
      const query = domain
        ? `SELECT
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
             AND c."domain" LIKE $2
             AND pr."status" = 'SUCCESS'
             AND 'demo' = ANY(p."tags")
           ORDER BY c."createdAt" DESC
           LIMIT $3`
        : `SELECT
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
             AND pr."status" = 'SUCCESS'
             AND 'demo' = ANY(p."tags")
           ORDER BY c."createdAt" DESC
           LIMIT $2`;

      const citationData = await this.dbPool.query<{
        citationId: string;
        domain: string;
        url: string;
        promptText: string;
        engine: string;
        answerText: string;
        createdAt: Date;
      }>(
        query,
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

  /**
   * Generate diagnostic intelligence for citations
   */
  async generateCitationDiagnostics(
    workspaceId: string,
    citations: PremiumCitation[]
  ): Promise<{
    insights: DiagnosticInsight[];
    recommendations: DiagnosticRecommendation[];
  }> {
    const insights: DiagnosticInsight[] = [];

    // Analyze citation count
    if (citations.length < 10) {
      insights.push({
        type: 'weakness',
        category: 'trust',
        title: 'Low Citation Count',
        description: `Only ${citations.length} citations found, below optimal threshold`,
        reasoning: 'Low citation count reduces trust signals and EEAT scores, limiting AI engine confidence',
        impact: 'high',
        confidence: 0.9,
        evidence: [`Total citations: ${citations.length}`, 'Recommended: 20+ citations'],
      });
    } else if (citations.length >= 30) {
      insights.push({
        type: 'strength',
        category: 'trust',
        title: 'Strong Citation Profile',
        description: `${citations.length} citations found, indicating strong web presence`,
        reasoning: 'High citation count improves trust signals and EEAT scores, boosting AI engine confidence',
        impact: 'high',
        confidence: 0.9,
        evidence: [`Total citations: ${citations.length}`],
      });
    }

    // Analyze licensed publisher citations
    const licensedCitations = citations.filter(c => c.classification.isLicensed);
    const licensedRatio = citations.length > 0 ? licensedCitations.length / citations.length : 0;
    
    if (licensedRatio < 0.2 && citations.length > 0) {
      insights.push({
        type: 'weakness',
        category: 'trust',
        title: 'Low Licensed Publisher Citations',
        description: `Only ${(licensedRatio * 100).toFixed(0)}% of citations are from licensed publishers`,
        reasoning: 'Licensed publisher citations are highly valued by AI engines for authoritativeness',
        impact: 'high',
        confidence: 0.9,
        evidence: [
          `Licensed: ${licensedCitations.length}`,
          `Total: ${citations.length}`,
          'Recommended: 30%+ licensed publisher citations',
        ],
      });
    } else if (licensedRatio >= 0.3) {
      insights.push({
        type: 'strength',
        category: 'trust',
        title: 'Strong Licensed Publisher Presence',
        description: `${(licensedRatio * 100).toFixed(0)}% of citations are from licensed publishers`,
        reasoning: 'High licensed publisher ratio significantly boosts authoritativeness and trust signals',
        impact: 'high',
        confidence: 0.9,
        evidence: [`Licensed: ${licensedCitations.length}/${citations.length}`],
      });
    }

    // Analyze citation categories
    const categoryCounts = citations.reduce((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const hasNews = categoryCounts['news'] > 0;
    const hasReviews = categoryCounts['review'] > 0;
    const hasDirectories = categoryCounts['directory'] > 0;

    if (!hasNews && citations.length > 0) {
      insights.push({
        type: 'weakness',
        category: 'trust',
        title: 'Missing News Citations',
        description: 'No news citations found',
        reasoning: 'News citations demonstrate media coverage and significantly boost authoritativeness',
        impact: 'high',
        confidence: 0.8,
        evidence: ['No news citations detected'],
      });
    }

    if (!hasReviews && citations.length > 0) {
      insights.push({
        type: 'weakness',
        category: 'trust',
        title: 'Missing Review Platform Citations',
        description: 'No review platform citations found',
        reasoning: 'Review citations show customer feedback and social proof, important for trust signals',
        impact: 'medium',
        confidence: 0.7,
        evidence: ['No review citations detected'],
      });
    }

    // Analyze citation authority
    const avgConfidence = citations.length > 0
      ? citations.reduce((sum, c) => sum + c.evidence.confidence, 0) / citations.length
      : 0;

    if (avgConfidence < 0.7 && citations.length > 0) {
      insights.push({
        type: 'weakness',
        category: 'trust',
        title: 'Low Average Citation Authority',
        description: `Average citation confidence is ${(avgConfidence * 100).toFixed(0)}%`,
        reasoning: 'Low citation authority reduces trust signals and EEAT scores',
        impact: 'medium',
        confidence: 0.8,
        evidence: [`Average confidence: ${(avgConfidence * 100).toFixed(0)}%`],
      });
    }

    // Analyze engine distribution
    const engineCounts = citations.reduce((acc, c) => {
      acc[c.foundInEngine] = (acc[c.foundInEngine] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const engines = Object.keys(engineCounts);
    if (engines.length < 3 && citations.length > 0) {
      insights.push({
        type: 'weakness',
        category: 'visibility',
        title: 'Limited Engine Citation Coverage',
        description: `Citations only found on ${engines.length} engine(s)`,
        reasoning: 'Limited engine coverage reduces overall visibility and trust signal distribution',
        impact: 'medium',
        confidence: 0.7,
        evidence: [`Engines: ${engines.join(', ')}`, 'Recommended: Citations on all 3 engines'],
        affectedEngines: engines,
      });
    }

    // Generate recommendations
    const recommendations = await this.diagnosticIntelligence.generateRecommendations(workspaceId, insights, {
      category: 'citations',
    });

    // Add citation-specific recommendations
    if (citations.length < 10) {
      recommendations.push({
        id: `citation-count-${Date.now()}`,
        title: 'Build More Citations',
        description: `Increase citation count from ${citations.length} to target 20+`,
        category: 'citations',
        priority: 'high',
        difficulty: 'medium',
        expectedImpact: {
          trustGain: Math.min(30, (20 - citations.length) * 3),
          description: `Expected ${Math.min(30, (20 - citations.length) * 3)}% trust signal improvement`,
        },
        steps: [
          'Build relationships with licensed publishers',
          'Create shareable, newsworthy content',
          'Improve directory listings',
          'Engage with industry publications',
        ],
        relatedInsights: insights.filter(i => i.type === 'weakness').map((_, idx) => `insight-${idx}`),
        estimatedTime: '4-12 weeks',
        evidence: [`Current: ${citations.length} citations`, 'Target: 20+ citations'],
      });
    }

    if (licensedRatio < 0.2 && citations.length > 0) {
      recommendations.push({
        id: `licensed-citations-${Date.now()}`,
        title: 'Increase Licensed Publisher Citations',
        description: `Increase licensed publisher citations from ${(licensedRatio * 100).toFixed(0)}% to 30%+`,
        category: 'citations',
        priority: 'high',
        difficulty: 'hard',
        expectedImpact: {
          trustGain: 25,
          description: 'Expected 25% improvement in authoritativeness score',
        },
        steps: [
          'Identify licensed publishers in your industry',
          'Create newsworthy content for press releases',
          'Build media relationships',
          'Pitch story angles to journalists',
        ],
        relatedInsights: insights.filter(i => i.title.includes('Licensed')).map((_, idx) => `insight-${idx}`),
        estimatedTime: '8-16 weeks',
        evidence: [`Current: ${(licensedRatio * 100).toFixed(0)}% licensed`, 'Target: 30%+ licensed'],
      });
    }

    return { insights, recommendations };
  }
}


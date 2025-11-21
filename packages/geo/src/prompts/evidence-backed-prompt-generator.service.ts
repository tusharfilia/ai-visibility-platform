import { Injectable, Logger } from '@nestjs/common';
import { LLMRouterService } from '@ai-visibility/shared';
import { IndustryDetectorService, IndustryContext } from '../industry/industry-detector.service';
import { EvidenceCollectorService, PromptEvidence } from '../evidence/evidence-collector.service';

export interface EvidenceBackedPrompt {
  text: string;
  intent: 'BEST' | 'ALTERNATIVES' | 'HOWTO' | 'PRICING' | 'COMPARISON' | 'LOCAL' | 'REVIEWS';
  industryRelevance: number; // 0-1
  commercialIntent: number; // 0-1
  evidence?: {
    hasBeenTested: boolean;
    visibilityScore?: number; // 0-100, if tested
    competitorsFound?: string[];
    confidence: number;
  };
  reasoning: string;
}

export interface PromptGenerationContext {
  industry: string;
  category: string;
  vertical: string;
  brandName: string;
  services: string[];
  geography?: {
    primary: string;
    serviceAreas?: string[];
  };
  marketType: 'B2B' | 'B2C' | 'B2B2C' | 'Marketplace';
  serviceType: 'Product' | 'Service' | 'Platform' | 'Hybrid';
}

@Injectable()
export class EvidenceBackedPromptGeneratorService {
  private readonly logger = new Logger(EvidenceBackedPromptGeneratorService.name);

  constructor(
    private readonly llmRouter: LLMRouterService,
    private readonly industryDetector: IndustryDetectorService,
    private readonly evidenceCollector: EvidenceCollectorService,
  ) {}

  /**
   * Generate industry-specific, evidence-backed buyer prompts
   */
  async generateEvidenceBackedPrompts(
    workspaceId: string,
    context: PromptGenerationContext,
    testPrompts: boolean = false // If true, test prompts and collect evidence
  ): Promise<EvidenceBackedPrompt[]> {
    const prompts: EvidenceBackedPrompt[] = [];

    // Generate prompts for each intent category
    const intents: Array<'BEST' | 'ALTERNATIVES' | 'HOWTO' | 'PRICING' | 'COMPARISON' | 'LOCAL' | 'REVIEWS'> = [
      'BEST',
      'ALTERNATIVES',
      'COMPARISON',
      'PRICING',
      'HOWTO',
      'LOCAL',
      'REVIEWS',
    ];

    for (const intent of intents) {
      const intentPrompts = await this.generatePromptsForIntent(workspaceId, intent, context);
      prompts.push(...intentPrompts);
    }

    // If testing is enabled, collect evidence for each prompt
    if (testPrompts) {
      for (const prompt of prompts) {
        try {
          const evidence = await this.evidenceCollector.collectPromptEvidence(workspaceId, prompt.text);
          if (evidence.length > 0) {
            // Calculate visibility score based on evidence
            const enginesTested = new Set(evidence.map(e => e.engine));
            const visibilityScore = (enginesTested.size / 3) * 100; // 3 engines: Perplexity, AIO, Brave

            prompt.evidence = {
              hasBeenTested: true,
              visibilityScore,
              competitorsFound: [...new Set(evidence.flatMap(e => e.brandsFound))],
              confidence: evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length,
            };
          }
        } catch (error) {
          this.logger.warn(`Failed to collect evidence for prompt "${prompt.text}": ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return prompts;
  }

  /**
   * Generate prompts for a specific intent
   */
  private async generatePromptsForIntent(
    workspaceId: string,
    intent: 'BEST' | 'ALTERNATIVES' | 'HOWTO' | 'PRICING' | 'COMPARISON' | 'LOCAL' | 'REVIEWS',
    context: PromptGenerationContext
  ): Promise<EvidenceBackedPrompt[]> {
    const promptTemplates = this.getIntentTemplates(intent, context);
    const generatedPrompts: EvidenceBackedPrompt[] = [];

    // Use LLM to generate industry-specific variations
    const generationPrompt = `You are an expert at understanding buyer search intent in the ${context.industry} industry.

Context:
- Industry: ${context.industry}
- Category: ${context.category}
- Vertical: ${context.vertical}
- Market Type: ${context.marketType}
- Service Type: ${context.serviceType}
- Brand: ${context.brandName} (for reference only - focus on industry)
- Services: ${context.services.join(', ')}
${context.geography ? `- Geography: ${context.geography.primary}` : ''}

Intent Category: ${this.getIntentDescription(intent)}

Generate 2-3 REAL buyer search queries that:
1. Are specific to the ${context.industry} industry
2. Reflect actual buyer intent for this intent category
3. Would trigger comprehensive AI search results
4. Enable competitive benchmarking
5. Are natural and how real users would search

${intent === 'LOCAL' && context.geography ? `Include location: ${context.geography.primary}` : ''}
${intent === 'PRICING' ? 'Focus on pricing, costs, value comparison' : ''}
${intent === 'COMPARISON' ? 'Focus on comparing multiple options' : ''}
${intent === 'ALTERNATIVES' ? 'Focus on finding alternatives' : ''}
${intent === 'BEST' ? 'Focus on finding the best options' : ''}
${intent === 'HOWTO' ? 'Focus on how-to guides and tutorials' : ''}
${intent === 'REVIEWS' ? 'Focus on reviews and ratings' : ''}

Return JSON array:
[
  {
    "text": "query text",
    "reasoning": "why this query is relevant for this industry and intent",
    "commercialIntent": 0.0-1.0,
    "industryRelevance": 0.0-1.0
  }
]`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, generationPrompt, {
        temperature: 0.4,
        maxTokens: 600,
      });

      const text = (response.content || response.text || '').trim();
      const cleaned = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned) as Array<{
        text: string;
        reasoning: string;
        commercialIntent: number;
        industryRelevance: number;
      }>;

      for (const item of parsed) {
        generatedPrompts.push({
          text: item.text,
          intent,
          industryRelevance: item.industryRelevance || 0.8,
          commercialIntent: item.commercialIntent || 0.7,
          reasoning: item.reasoning || `Generated for ${intent} intent in ${context.industry} industry`,
        });
      }
    } catch (error) {
      this.logger.warn(`LLM prompt generation failed for ${intent}, using templates: ${error instanceof Error ? error.message : String(error)}`);
      
      // Fallback to templates
      for (const template of promptTemplates) {
        generatedPrompts.push({
          text: template,
          intent,
          industryRelevance: 0.7,
          commercialIntent: 0.6,
          reasoning: `Template-based prompt for ${intent} intent`,
        });
      }
    }

    return generatedPrompts;
  }

  /**
   * Get intent description
   */
  private getIntentDescription(intent: string): string {
    const descriptions: Record<string, string> = {
      BEST: 'Queries seeking the best options or recommendations',
      ALTERNATIVES: 'Queries looking for alternatives or substitutes',
      HOWTO: 'Queries asking how to do something or use a product',
      PRICING: 'Queries about pricing, costs, or value',
      COMPARISON: 'Queries comparing multiple options (X vs Y)',
      LOCAL: 'Location-based queries (near me, in [city])',
      REVIEWS: 'Queries about reviews, ratings, or opinions',
    };
    return descriptions[intent] || 'General queries';
  }

  /**
   * Get intent templates (fallback)
   */
  private getIntentTemplates(
    intent: 'BEST' | 'ALTERNATIVES' | 'HOWTO' | 'PRICING' | 'COMPARISON' | 'LOCAL' | 'REVIEWS',
    context: PromptGenerationContext
  ): string[] {
    const industry = context.industry;
    const category = context.category;
    const location = context.geography?.primary;

    const templates: Record<string, string[]> = {
      BEST: [
        `Best ${industry} solutions`,
        `Top ${category} platforms`,
        `Best ${industry} options`,
      ],
      ALTERNATIVES: [
        `Best ${industry} alternatives`,
        `Top ${category} alternatives`,
        `Similar ${industry} platforms`,
      ],
      HOWTO: [
        `How to choose ${industry} platform`,
        `How does ${category} work`,
        `${industry} selection guide`,
      ],
      PRICING: [
        `${industry} pricing comparison`,
        `How much do ${category} services cost`,
        `${industry} platform costs`,
      ],
      COMPARISON: [
        `Compare ${industry} platforms`,
        `${category} services comparison`,
        `Best ${industry} vs alternatives`,
      ],
      LOCAL: location ? [
        `Best ${industry} in ${location}`,
        `Top ${category} services ${location}`,
        `${industry} platforms near me`,
      ] : [
        `Best ${industry} near me`,
        `Top ${category} local services`,
      ],
      REVIEWS: [
        `Best ${industry} reviews`,
        `${category} platform ratings`,
        `Top rated ${industry} solutions`,
      ],
    };

    return templates[intent] || templates.BEST;
  }
}


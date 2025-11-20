import { Injectable } from '@nestjs/common';
import { LLMRouterService } from '@ai-visibility/shared';

export type PromptIntent = 'BEST' | 'ALTERNATIVES' | 'HOWTO' | 'PRICING' | 'COMPARISON' | 'LOCAL' | 'REVIEWS';

export interface ClusteredPrompt {
  text: string;
  intent: PromptIntent;
  industry?: string;
  competitorMentions?: string[];
  topicalRelevance: number;
  engineOptimization?: {
    engine: string;
    optimizedText?: string;
    reasoning?: string;
  }[];
}

export interface IntentPromptCluster {
  intent: PromptIntent;
  prompts: ClusteredPrompt[];
  description: string;
  enginePreferences: string[]; // Which engines this intent works best with
}

export interface IntentClusteringResult {
  clusters: IntentPromptCluster[];
  allPrompts: ClusteredPrompt[];
  coverage: {
    intent: PromptIntent;
    count: number;
    percentage: number;
  }[];
}

@Injectable()
export class IntentClustererService {
  constructor(private readonly llmRouter: LLMRouterService) {}

  /**
   * Cluster prompts by intent
   */
  async clusterPromptsByIntent(
    workspaceId: string,
    prompts: string[],
    context?: {
      brandName?: string;
      category?: string;
      industry?: string;
    }
  ): Promise<IntentClusteringResult> {
    // Detect intent for each prompt
    const clusteredPrompts: ClusteredPrompt[] = prompts.map(prompt => ({
      text: prompt,
      intent: this.detectIntent(prompt),
      industry: context?.industry,
      topicalRelevance: 1.0,
    }));

    // Group by intent
    const intentMap = new Map<PromptIntent, ClusteredPrompt[]>();
    for (const prompt of clusteredPrompts) {
      const existing = intentMap.get(prompt.intent) || [];
      existing.push(prompt);
      intentMap.set(prompt.intent, existing);
    }

    // Create clusters
    const clusters: IntentPromptCluster[] = [];
    for (const [intent, promptList] of intentMap.entries()) {
      clusters.push({
        intent,
        prompts: promptList,
        description: this.getIntentDescription(intent),
        enginePreferences: this.getEnginePreferences(intent),
      });
    }

    // Calculate coverage
    const total = clusteredPrompts.length;
    const coverage = Array.from(intentMap.entries()).map(([intent, prompts]) => ({
      intent,
      count: prompts.length,
      percentage: total > 0 ? (prompts.length / total) * 100 : 0,
    }));

    return {
      clusters,
      allPrompts: clusteredPrompts,
      coverage,
    };
  }

  /**
   * Generate intent-based prompts
   */
  async generateIntentBasedPrompts(
    workspaceId: string,
    context: {
      brandName: string;
      category: string;
      vertical?: string;
      summary?: string;
      services?: string[];
      geography?: { primary: string; serviceAreas?: string[] };
    },
    targetIntents: PromptIntent[] = ['BEST', 'ALTERNATIVES', 'HOWTO', 'PRICING', 'COMPARISON']
  ): Promise<ClusteredPrompt[]> {
    const allPrompts: ClusteredPrompt[] = [];

    // Generate prompts for each intent
    for (const intent of targetIntents) {
      const prompts = await this.generatePromptsForIntent(workspaceId, intent, context);
      allPrompts.push(...prompts);
    }

    return allPrompts;
  }

  /**
   * Generate prompts for a specific intent
   */
  private async generatePromptsForIntent(
    workspaceId: string,
    intent: PromptIntent,
    context: {
      brandName: string;
      category: string;
      vertical?: string;
      summary?: string;
      services?: string[];
      geography?: { primary: string; serviceAreas?: string[] };
    }
  ): Promise<ClusteredPrompt[]> {
    const intentTemplates = this.getIntentTemplates(intent, context);
    
    // Determine if we should focus on industry or brand based on intent
    const focusOnIndustry = intent === 'BEST' || intent === 'COMPARISON' || intent === 'ALTERNATIVES';
    const industryFocus = context.vertical || context.category;
    
    const prompt = `Generate 2-3 high-quality search queries for the "${intent}" intent category.

Business Context:
- Brand: ${context.brandName} (for reference only - ${focusOnIndustry ? 'focus on industry, not brand' : 'can be included naturally'})
- Category: ${context.category}
- Industry/Vertical: ${industryFocus}
- Summary: ${context.summary || 'Not available'}
- Services: ${context.services?.join(', ') || 'Not specified'}
- Geography: ${context.geography?.primary || 'Not specified'}

Intent Category: ${this.getIntentDescription(intent)}

${focusOnIndustry ? `
IMPORTANT: For this intent, generate INDUSTRY-FOCUSED queries that enable competitive benchmarking.
- Focus on the ${industryFocus} industry/category, NOT the specific brand
- These queries should surface multiple competitors in the space
- Examples: "best ${industryFocus} platforms", "top ${industryFocus} solutions", "${industryFocus} comparison"
- Avoid brand-specific queries like "${context.brandName} alternatives" - instead use industry terms
` : `
For this intent, queries can naturally include the brand or focus on industry.
- Make queries specific and actionable
- Include brand name only if it's natural for the intent (e.g., HOWTO, PRICING)
`}

Template Examples:
${intentTemplates.join('\n')}

Requirements:
- Each query should be natural and how real users would search
- Focus on queries that would trigger AI-powered search results with competitive data
- ${focusOnIndustry ? `Use industry/category terms (${industryFocus}) rather than brand name` : 'Include brand or category naturally'}
- Make queries specific and actionable
- For LOCAL intent, include location if geography is available
- Queries should enable competitive benchmarking and industry analysis

Return a JSON array of query strings:
["query 1", "query 2", "query 3"]`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt, {
        temperature: 0.4,
        maxTokens: 400,
      });

      const text = (response.content || response.text || '').trim();
      const cleaned = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned) as string[];

      return parsed.map(query => ({
        text: query,
        intent,
        industry: context.vertical,
        topicalRelevance: 1.0,
      }));
    } catch (error) {
      console.warn(`Failed to generate prompts for intent ${intent}:`, error);
      // Return fallback prompts
      return this.getFallbackPromptsForIntent(intent, context);
    }
  }

  /**
   * Optimize prompts for specific engines
   */
  async optimizeForEngine(
    workspaceId: string,
    prompts: ClusteredPrompt[],
    engine: string
  ): Promise<ClusteredPrompt[]> {
    const engineBias = this.getEngineBias(engine);
    
    return prompts.map(prompt => {
      // For now, return prompts as-is with engine optimization metadata
      // In a full implementation, we could rewrite prompts to match engine preferences
      return {
        ...prompt,
        engineOptimization: [
          {
            engine,
            reasoning: `Optimized for ${engine}: ${engineBias.description}`,
          },
        ],
      };
    });
  }

  /**
   * Detect intent from prompt text
   */
  detectIntent(prompt: string): PromptIntent {
    const text = prompt.toLowerCase();
    
    // Comparison queries
    if (text.includes('vs ') || text.includes(' versus ') || text.includes('compare ') || text.includes('comparison')) {
      return 'COMPARISON';
    }
    
    // Alternative queries
    if (text.includes('alternative') || text.includes('instead of') || text.includes('similar to')) {
      return 'ALTERNATIVES';
    }
    
    // Pricing queries
    if (text.includes('price') || text.includes('pricing') || text.includes('cost') || text.includes('how much')) {
      return 'PRICING';
    }
    
    // How-to queries
    if (text.startsWith('how to') || text.startsWith('how do') || text.includes('guide') || text.includes('tutorial')) {
      return 'HOWTO';
    }
    
    // Local queries
    if (text.includes('near me') || text.includes('in ') || text.includes('local') || text.includes('nearby')) {
      return 'LOCAL';
    }
    
    // Review queries
    if (text.includes('review') || text.includes('rating') || text.includes('opinion') || text.includes('feedback')) {
      return 'REVIEWS';
    }
    
    // Best queries (default)
    return 'BEST';
  }

  /**
   * Get intent description
   */
  private getIntentDescription(intent: PromptIntent): string {
    const descriptions: Record<PromptIntent, string> = {
      BEST: 'Queries seeking the best options or recommendations',
      ALTERNATIVES: 'Queries looking for alternatives or substitutes',
      HOWTO: 'Queries asking how to do something or use a product',
      PRICING: 'Queries about pricing, costs, or value',
      COMPARISON: 'Queries comparing multiple options (X vs Y)',
      LOCAL: 'Location-based queries (near me, in [city])',
      REVIEWS: 'Queries about reviews, ratings, or opinions',
    };
    return descriptions[intent];
  }

  /**
   * Get engine preferences for intent
   */
  private getEnginePreferences(intent: PromptIntent): string[] {
    const preferences: Record<PromptIntent, string[]> = {
      BEST: ['PERPLEXITY', 'AIO', 'BRAVE'], // Best for discovery
      ALTERNATIVES: ['PERPLEXITY', 'BRAVE'], // Good for alternatives
      HOWTO: ['PERPLEXITY', 'AIO'], // How-to guides
      PRICING: ['BRAVE', 'AIO'], // Pricing info
      COMPARISON: ['PERPLEXITY', 'AIO'], // Comparisons
      LOCAL: ['BRAVE', 'AIO'], // Local search
      REVIEWS: ['BRAVE', 'PERPLEXITY'], // Reviews
    };
    return preferences[intent] || ['PERPLEXITY', 'BRAVE', 'AIO'];
  }

  /**
   * Get intent templates
   */
  private getIntentTemplates(
    intent: PromptIntent,
    context: { brandName: string; category: string; vertical?: string; geography?: { primary: string } }
  ): string[] {
    const brand = context.brandName;
    const category = context.category;
    const industry = context.vertical || category;
    const location = context.geography?.primary;

    const templates: Record<PromptIntent, string[]> = {
      BEST: [
        `Best ${industry} solutions`,
        `Top ${industry} platforms`,
        `Best ${category} options`,
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

  /**
   * Get fallback prompts for intent
   */
  private getFallbackPromptsForIntent(
    intent: PromptIntent,
    context: { brandName: string; category: string }
  ): ClusteredPrompt[] {
    const templates = this.getIntentTemplates(intent, context);
    return templates.map(template => ({
      text: template,
      intent,
      topicalRelevance: 0.8,
    }));
  }

  /**
   * Get engine bias information
   */
  private getEngineBias(engine: string): { description: string; preferences: string[] } {
    const biases: Record<string, { description: string; preferences: string[] }> = {
      PERPLEXITY: {
        description: 'Prefers Reddit, blogs, real-world experience, citation-heavy content',
        preferences: ['Reddit', 'blogs', 'user-generated content'],
      },
      CHATGPT: {
        description: 'Prefers licensed publishers, high-authority sites, structured data',
        preferences: ['licensed publishers', 'high-authority sites', 'structured data'],
      },
      GEMINI: {
        description: 'Prefers structured facts, Google Knowledge Graph, schema data',
        preferences: ['structured facts', 'knowledge graph', 'schema'],
      },
      BRAVE: {
        description: 'Prefers diverse sources, citations, reviews',
        preferences: ['diverse sources', 'citations', 'reviews'],
      },
      AIO: {
        description: 'Prefers Google-curated sources, featured snippets',
        preferences: ['curated sources', 'featured snippets'],
      },
    };

    return biases[engine.toUpperCase()] || {
      description: 'General search preferences',
      preferences: [],
    };
  }
}


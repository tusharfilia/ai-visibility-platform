/**
 * Brave Search provider implementation with mock responses
 */

import { EngineKey, EngineAnswer, Sentiment } from '@ai-visibility/shared';
import { BaseProvider } from './base-provider';
import { ProviderRequestOptions, ProviderHealth, CostEstimate } from './types';
import { loadFixture } from './fixture-loader';
import { MOCK_PROVIDERS } from './env';

export class BraveProvider extends BaseProvider {
  readonly engineType: 'search' | 'llm' = 'search';

  constructor(config: any = {}) {
    super(EngineKey.BRAVE, 'Brave Search', '1.0.0', config);
  }

  async ask(prompt: string, options?: ProviderRequestOptions): Promise<EngineAnswer> {
    if (MOCK_PROVIDERS) {
      return this.executeWithRetry(async () => {
        // Simulate latency
        await this.simulateLatency(150, 600);

        // Check for simulated errors
        if (this.shouldSimulateError()) {
          throw new Error('Simulated Brave API error');
        }

        // Load fixture response
        const fixture = await loadFixture('brave', prompt);
        if (fixture) {
          return fixture.response;
        }

        // Fallback mock response
        return this.createMockResponse(prompt);
      }, 'Brave ask');
    }
    
    // Real Brave Search API call
    const apiKey = process.env.BRAVE_API_KEY || this.config?.apiKey;
    if (!apiKey) {
      throw new Error('BRAVE_API_KEY is required');
    }

    const startTime = Date.now();
    
    try {
      const searchResponse = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(prompt)}&count=10`,
        {
          method: 'GET',
          headers: {
            'X-Subscription-Token': apiKey,
            'Accept': 'application/json',
          },
        }
      );

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        throw new Error(`Brave API error: ${searchResponse.status} ${errorText}`);
      }

      const data = await searchResponse.json() as any;
      
      // Extract results and build answer
      const webResults = (data.web?.results || []) as any[];
      const answerText = this.buildAnswerFromResults(prompt, webResults);
      
      // Extract citations
      const citations: Array<{ url: string; domain: string; confidence?: number }> = webResults
        .slice(0, 10)
        .map((result: any, index: number) => ({
          url: result.url || '',
          domain: result.url ? new URL(result.url).hostname.replace('www.', '') : '',
          confidence: 0.95 - (index * 0.05), // Decrease confidence for lower-ranked results
        }))
        .filter((c: any) => c.url);

      // Extract mentions
      const mentions = this.extractMentions(answerText, options?.brandName || '');

      const latency = Date.now() - startTime;

      return this.createEngineAnswer(
        prompt,
        answerText,
        mentions,
        citations,
        {
          model: 'brave-search',
          tokens: answerText.length / 4, // Rough token estimate
          latency,
          cost: 0.001, // Brave Search pricing
        }
      );
    } catch (error) {
      console.error('Brave API error:', error);
      throw new Error(`Brave API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildAnswerFromResults(prompt: string, results: any[]): string {
    if (results.length === 0) {
      return `I found no results for "${prompt}".`;
    }

    let answer = `Here's what I found about "${prompt}":\n\n`;
    
    results.slice(0, 5).forEach((result, index) => {
      answer += `${index + 1}. ${result.title || 'Untitled'}\n`;
      if (result.description) {
        answer += `   ${result.description}\n`;
      }
      answer += `   Source: ${result.url}\n\n`;
    });

    return answer.trim();
  }

  private extractMentions(content: string, brandName?: string): Array<{ brand: string; position: number; sentiment: Sentiment; snippet: string }> {
    const mentions: Array<{ brand: string; position: number; sentiment: Sentiment; snippet: string }> = [];
    
    if (brandName) {
      const brandRegex = new RegExp(brandName, 'gi');
      const matches = [...content.matchAll(brandRegex)];
      
      matches.forEach((match, index) => {
        const position = match.index || 0;
        const contextStart = Math.max(0, position - 50);
        const contextEnd = Math.min(content.length, position + 50);
        const snippet = content.substring(contextStart, contextEnd);
        
        const positiveWords = ['great', 'excellent', 'best', 'amazing', 'good', 'top'];
        const negativeWords = ['bad', 'worst', 'poor', 'terrible', 'awful'];
        const context = snippet.toLowerCase();
        
        let sentiment = Sentiment.NEU;
        if (positiveWords.some(word => context.includes(word))) {
          sentiment = Sentiment.POS;
        } else if (negativeWords.some(word => context.includes(word))) {
          sentiment = Sentiment.NEG;
        }
        
        mentions.push({
          brand: brandName,
          position: index + 1,
          sentiment,
          snippet,
        });
      });
    }
    
    return mentions;
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      // Simulate health check
      await this.simulateLatency(80, 250);
      
      return {
        status: 'healthy',
        latency: Math.random() * 150 + 50,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getCostEstimate(prompt: string, options?: ProviderRequestOptions): Promise<CostEstimate> {
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = 400; // Brave responses are moderate length
    
    return {
      inputTokens,
      outputTokens,
      costCents: Math.ceil((inputTokens * 0.00003 + outputTokens * 0.00008) * 100),
      currency: 'USD',
    };
  }

  private createMockResponse(prompt: string): EngineAnswer {
    const responses = [
      {
        answer: "Brave Search results show these top project management tools: **Asana** leads with 4.5/5 stars for team collaboration, **Trello** scores 4.3/5 for simplicity, **Monday.com** rates 4.4/5 for customization, and **Notion** gets 4.6/5 for all-in-one functionality. User reviews highlight Asana's task management, Trello's visual boards, Monday's automation, and Notion's flexibility.",
        mentions: [
          { brand: "Asana", position: 1, sentiment: Sentiment.POS, snippet: "leads with 4.5/5 stars for team collaboration" },
          { brand: "Trello", position: 2, sentiment: Sentiment.POS, snippet: "scores 4.3/5 for simplicity" },
          { brand: "Monday.com", position: 3, sentiment: Sentiment.POS, snippet: "rates 4.4/5 for customization" },
          { brand: "Notion", position: 4, sentiment: Sentiment.POS, snippet: "gets 4.6/5 for all-in-one functionality" }
        ],
        citations: [
          { url: "https://www.g2.com/products/asana/reviews", domain: "g2.com", confidence: 0.89 },
          { url: "https://www.capterra.com/trello-reviews/", domain: "capterra.com", confidence: 0.87 },
          { url: "https://www.trustradius.com/monday-com", domain: "trustradius.com", confidence: 0.85 },
          { url: "https://www.producthunt.com/posts/notion", domain: "producthunt.com", confidence: 0.83 }
        ]
      },
      {
        answer: "Brave Search reveals these Asana alternatives: **ClickUp** (4.7/5) offers more features than Asana, **Wrike** (4.2/5) focuses on enterprise needs, **Smartsheet** (4.1/5) provides spreadsheet-like project management, and **Airtable** (4.5/5) combines database functionality with project tracking. Reviews suggest ClickUp for feature-rich teams, Wrike for large organizations, Smartsheet for data-driven projects, and Airtable for creative workflows.",
        mentions: [
          { brand: "ClickUp", position: 1, sentiment: Sentiment.POS, snippet: "offers more features than Asana" },
          { brand: "Wrike", position: 2, sentiment: Sentiment.POS, snippet: "focuses on enterprise needs" },
          { brand: "Smartsheet", position: 3, sentiment: Sentiment.POS, snippet: "provides spreadsheet-like project management" },
          { brand: "Airtable", position: 4, sentiment: Sentiment.POS, snippet: "combines database functionality with project tracking" }
        ],
        citations: [
          { url: "https://www.g2.com/products/clickup/reviews", domain: "g2.com", confidence: 0.92 },
          { url: "https://www.capterra.com/wrike-reviews/", domain: "capterra.com", confidence: 0.88 },
          { url: "https://www.trustradius.com/smartsheet", domain: "trustradius.com", confidence: 0.86 },
          { url: "https://www.producthunt.com/posts/airtable", domain: "producthunt.com", confidence: 0.84 }
        ]
      }
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];
    
    return this.createEngineAnswer(
      prompt,
      response.answer,
      response.mentions,
      response.citations,
      {
        model: 'brave-search',
        tokens: Math.floor(Math.random() * 800) + 300,
        latency: Math.random() * 400 + 150,
        searchType: 'web',
      }
    );
  }
}

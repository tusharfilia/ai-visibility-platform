/**
 * Brave Search provider implementation with mock responses
 */

import { EngineKey, EngineAnswer, Sentiment } from '@ai-visibility/shared';
import { BaseProvider } from './base-provider';
import { ProviderRequestOptions, ProviderHealth, CostEstimate } from './types';
import { loadFixture } from './fixture-loader';
import { MOCK_PROVIDERS } from './env';

export class BraveProvider extends BaseProvider {
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
    
    // TODO: Implement real API call using BRAVE_API_KEY
    throw new Error('Real API calls not implemented yet');
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

/**
 * Google AI Overview (AIO) provider implementation with mock responses
 */

import { EngineKey, EngineAnswer, Sentiment } from '@ai-visibility/shared';
import { BaseProvider } from './base-provider';
import { ProviderRequestOptions, ProviderHealth, CostEstimate } from './types';
import { loadFixture } from './fixture-loader';
import { MOCK_PROVIDERS } from './env';

export class AioProvider extends BaseProvider {
  constructor(config: any = {}) {
    super(EngineKey.AIO, 'Google AI Overview', '1.0.0', config);
  }

  async ask(prompt: string, options?: ProviderRequestOptions): Promise<EngineAnswer> {
    if (MOCK_PROVIDERS) {
      return this.executeWithRetry(async () => {
        // Simulate latency
        await this.simulateLatency(300, 1200);

        // Check for simulated errors
        if (this.shouldSimulateError()) {
          throw new Error('Simulated AIO API error');
        }

        // Load fixture response
        const fixture = await loadFixture('aio', prompt);
        if (fixture) {
          return fixture.response;
        }

        // Fallback mock response
        return this.createMockResponse(prompt);
      }, 'AIO ask');
    }
    
    // TODO: Implement real API call using SERPAPI_KEY
    throw new Error('Real API calls not implemented yet');
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      // Simulate health check
      await this.simulateLatency(100, 300);
      
      return {
        status: 'healthy',
        latency: Math.random() * 200 + 100,
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
    const outputTokens = 300; // AIO responses are typically shorter
    
    return {
      inputTokens,
      outputTokens,
      costCents: Math.ceil((inputTokens * 0.00005 + outputTokens * 0.0001) * 100),
      currency: 'USD',
    };
  }

  private createMockResponse(prompt: string): EngineAnswer {
    const responses = [
      {
        answer: "Google AI Overview provides these top project management tools: **Asana** for team collaboration, **Trello** for visual task management, **Monday.com** for workflow automation, and **Notion** for all-in-one workspace solutions. Each offers unique features for different team sizes and project complexities.",
        mentions: [
          { brand: "Asana", position: 1, sentiment: Sentiment.POS, snippet: "for team collaboration" },
          { brand: "Trello", position: 2, sentiment: Sentiment.POS, snippet: "for visual task management" },
          { brand: "Monday.com", position: 3, sentiment: Sentiment.POS, snippet: "for workflow automation" },
          { brand: "Notion", position: 4, sentiment: Sentiment.POS, snippet: "for all-in-one workspace solutions" }
        ],
        citations: [
          { url: "https://asana.com/features", domain: "asana.com", confidence: 0.98 },
          { url: "https://trello.com/features", domain: "trello.com", confidence: 0.96 },
          { url: "https://monday.com/features", domain: "monday.com", confidence: 0.94 },
          { url: "https://notion.so/features", domain: "notion.so", confidence: 0.92 }
        ]
      },
      {
        answer: "For Asana alternatives, consider **ClickUp** (more features), **Wrike** (enterprise focus), **Smartsheet** (spreadsheet-like), or **Airtable** (database approach). Each offers different strengths: ClickUp has time tracking, Wrike excels at complex projects, Smartsheet provides automation, and Airtable offers flexible data organization.",
        mentions: [
          { brand: "ClickUp", position: 1, sentiment: Sentiment.POS, snippet: "more features" },
          { brand: "Wrike", position: 2, sentiment: Sentiment.POS, snippet: "enterprise focus" },
          { brand: "Smartsheet", position: 3, sentiment: Sentiment.POS, snippet: "spreadsheet-like" },
          { brand: "Airtable", position: 4, sentiment: Sentiment.POS, snippet: "database approach" }
        ],
        citations: [
          { url: "https://clickup.com/alternatives", domain: "clickup.com", confidence: 0.97 },
          { url: "https://wrike.com/enterprise", domain: "wrike.com", confidence: 0.95 },
          { url: "https://smartsheet.com/automation", domain: "smartsheet.com", confidence: 0.93 },
          { url: "https://airtable.com/organization", domain: "airtable.com", confidence: 0.91 }
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
        model: 'gemini-pro',
        tokens: Math.floor(Math.random() * 500) + 200,
        latency: Math.random() * 800 + 300,
        region: 'us-east-1',
      }
    );
  }
}

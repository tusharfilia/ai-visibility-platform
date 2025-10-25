/**
 * Perplexity AI provider implementation with mock responses
 */

import { EngineKey, EngineAnswer, Sentiment } from '@ai-visibility/shared';
import { BaseProvider } from './base-provider';
import { ProviderRequestOptions, ProviderHealth, CostEstimate } from './types';
import { loadFixture } from './fixture-loader';
import { MOCK_PROVIDERS } from './env';

export class PerplexityProvider extends BaseProvider {
  constructor(config: any = {}) {
    super(EngineKey.PERPLEXITY, 'Perplexity AI', '1.0.0', config);
  }

  async ask(prompt: string, options?: ProviderRequestOptions): Promise<EngineAnswer> {
    if (MOCK_PROVIDERS) {
      return this.executeWithRetry(async () => {
        // Simulate latency
        await this.simulateLatency(200, 800);

        // Check for simulated errors
        if (this.shouldSimulateError()) {
          throw new Error('Simulated Perplexity API error');
        }

        // Load fixture response
        const fixture = await loadFixture('perplexity', prompt);
        if (fixture) {
          return fixture.response;
        }

        // Fallback mock response
        return this.createMockResponse(prompt);
      }, 'Perplexity ask');
    }
    
    // TODO: Implement real API call using PERPLEXITY_API_KEY
    throw new Error('Real API calls not implemented yet');
  }

  async healthCheck(): Promise<ProviderHealth> {
    try {
      // Simulate health check
      await this.simulateLatency(50, 200);
      
      return {
        status: 'healthy',
        latency: Math.random() * 100 + 50,
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
    const inputTokens = Math.ceil(prompt.length / 4); // Rough token estimation
    const outputTokens = 500; // Estimated response length
    
    return {
      inputTokens,
      outputTokens,
      costCents: Math.ceil((inputTokens * 0.0001 + outputTokens * 0.0002) * 100),
      currency: 'USD',
    };
  }

  private createMockResponse(prompt: string): EngineAnswer {
    const responses = [
      {
        answer: "Based on the latest information, here are the top project management tools for small teams: 1. **Asana** - Excellent for task management and team collaboration. 2. **Trello** - Simple kanban boards perfect for small teams. 3. **Monday.com** - Highly customizable with great automation features. 4. **Notion** - All-in-one workspace with project management capabilities. 5. **ClickUp** - Feature-rich with time tracking and reporting.",
        mentions: [
          { brand: "Asana", position: 1, sentiment: Sentiment.POS, snippet: "Excellent for task management and team collaboration" },
          { brand: "Trello", position: 2, sentiment: Sentiment.POS, snippet: "Simple kanban boards perfect for small teams" },
          { brand: "Monday.com", position: 3, sentiment: Sentiment.POS, snippet: "Highly customizable with great automation features" },
          { brand: "Notion", position: 4, sentiment: Sentiment.POS, snippet: "All-in-one workspace with project management capabilities" },
          { brand: "ClickUp", position: 5, sentiment: Sentiment.POS, snippet: "Feature-rich with time tracking and reporting" }
        ],
        citations: [
          { url: "https://asana.com", domain: "asana.com", confidence: 0.95 },
          { url: "https://trello.com", domain: "trello.com", confidence: 0.92 },
          { url: "https://monday.com", domain: "monday.com", confidence: 0.88 },
          { url: "https://notion.so", domain: "notion.so", confidence: 0.90 },
          { url: "https://clickup.com", domain: "clickup.com", confidence: 0.85 }
        ]
      },
      {
        answer: "Here are the best alternatives to Asana for task management: 1. **Monday.com** - More visual and customizable than Asana. 2. **ClickUp** - Offers more features including time tracking and Gantt charts. 3. **Wrike** - Better for complex project management with advanced reporting. 4. **Smartsheet** - Spreadsheet-like interface with powerful automation. 5. **Airtable** - Database-like approach with flexible views and integrations.",
        mentions: [
          { brand: "Monday.com", position: 1, sentiment: Sentiment.POS, snippet: "More visual and customizable than Asana" },
          { brand: "ClickUp", position: 2, sentiment: Sentiment.POS, snippet: "Offers more features including time tracking and Gantt charts" },
          { brand: "Wrike", position: 3, sentiment: Sentiment.POS, snippet: "Better for complex project management with advanced reporting" },
          { brand: "Smartsheet", position: 4, sentiment: Sentiment.POS, snippet: "Spreadsheet-like interface with powerful automation" },
          { brand: "Airtable", position: 5, sentiment: Sentiment.POS, snippet: "Database-like approach with flexible views and integrations" }
        ],
        citations: [
          { url: "https://monday.com", domain: "monday.com", confidence: 0.93 },
          { url: "https://clickup.com", domain: "clickup.com", confidence: 0.91 },
          { url: "https://wrike.com", domain: "wrike.com", confidence: 0.89 },
          { url: "https://smartsheet.com", domain: "smartsheet.com", confidence: 0.87 },
          { url: "https://airtable.com", domain: "airtable.com", confidence: 0.85 }
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
        model: 'llama-3.1-sonar-large-128k-online',
        tokens: Math.floor(Math.random() * 1000) + 500,
        latency: Math.random() * 500 + 200,
      }
    );
  }
}

/**
 * Google AI Overview (AIO) provider implementation with mock responses
 */

import { EngineKey, EngineAnswer, Sentiment } from '@ai-visibility/shared';
import { BaseProvider } from './base-provider';
import { ProviderRequestOptions, ProviderHealth, CostEstimate } from './types';
import { loadFixture } from './fixture-loader';
import { MOCK_PROVIDERS } from './env';

export class AioProvider extends BaseProvider {
  readonly engineType: 'search' | 'llm' = 'search';

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
    
    // Real Google AI Overviews via SerpAPI
    const apiKey = process.env.SERPAPI_KEY || this.config?.apiKey;
    if (!apiKey) {
      throw new Error('SERPAPI_KEY is required for Google AI Overviews');
    }

    const startTime = Date.now();
    
    try {
      // Use SerpAPI to get Google search results with AI Overviews
      const searchResponse = await fetch(
        `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(prompt)}&api_key=${apiKey}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        throw new Error(`SerpAPI error: ${searchResponse.status} ${errorText}`);
      }

      const data = await searchResponse.json() as any;
      
      // Extract AI Overview (Google's AI-generated summary)
      let answerText = '';
      const citations: Array<{ url: string; domain: string; confidence?: number }> = [];
      
      if (data.answer_box) {
        answerText = data.answer_box.answer || data.answer_box.snippet || '';
      } else if (data.organic_results && Array.isArray(data.organic_results) && data.organic_results.length > 0) {
        // Build answer from top organic results
        answerText = this.buildAnswerFromResults(prompt, data.organic_results);
      }

      // Extract citations from organic results
      if (data.organic_results && Array.isArray(data.organic_results)) {
        data.organic_results.slice(0, 10).forEach((result: any, index: number) => {
          if (result.link) {
            try {
              const domain = new URL(result.link).hostname.replace('www.', '');
              citations.push({
                url: result.link,
                domain,
                confidence: 0.95 - (index * 0.05),
              });
            } catch (e) {
              // Invalid URL, skip
            }
          }
        });
      }

      // Extract knowledge graph citations
      if (data.knowledge_graph?.source?.link) {
        try {
          const domain = new URL(data.knowledge_graph.source.link).hostname.replace('www.', '');
          citations.push({
            url: data.knowledge_graph.source.link,
            domain,
            confidence: 0.98,
          });
        } catch (e) {
          // Invalid URL, skip
        }
      }

      // Extract mentions
      const mentions = this.extractMentions(answerText, options?.brandName || '');

      const latency = Date.now() - startTime;

      return this.createEngineAnswer(
        prompt,
        answerText || `No AI Overview available for "${prompt}".`,
        mentions,
        citations,
        {
          model: 'google-ai-overviews',
          tokens: answerText.length / 4, // Rough token estimate
          latency,
          cost: 0.005, // SerpAPI pricing per request
        }
      );
    } catch (error) {
      console.error('Google AI Overviews API error:', error);
      throw new Error(`Google AI Overviews API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildAnswerFromResults(prompt: string, results: any[]): string {
    if (results.length === 0) {
      return `I found no results for "${prompt}".`;
    }

    let answer = `Based on Google search results for "${prompt}":\n\n`;
    
    results.slice(0, 5).forEach((result, index) => {
      answer += `${index + 1}. ${result.title || 'Untitled'}\n`;
      if (result.snippet) {
        answer += `   ${result.snippet}\n`;
      }
      if (result.link) {
        answer += `   Source: ${result.link}\n\n`;
      }
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

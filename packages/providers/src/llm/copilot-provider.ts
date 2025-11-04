// Azure OpenAI SDK v2.0.0 - using dynamic require to handle API changes
import { BaseLLMProvider, LLMResponse, EngineAnswer } from './base-llm-provider';
import { ProviderConfig } from '../types';

export class CopilotProvider extends BaseLLMProvider {
  private client: any;

  constructor(config: ProviderConfig) {
    super(config);
    if (!config.apiKey || !config.endpoint) {
      throw new Error('Azure OpenAI API key and endpoint are required');
    }
    // Dynamic require to handle @azure/openai v2.0.0 API changes
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AzureOpenAI = require('@azure/openai');
    // Try different possible export names
    const AzureClient = AzureOpenAI.AzureOpenAI || AzureOpenAI.OpenAI || AzureOpenAI.default || AzureOpenAI;
    this.client = new AzureClient({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      apiVersion: '2024-02-15-preview',
    });
  }

  async query(prompt: string, options: any = {}): Promise<LLMResponse> {
    try {
      const deploymentName = options.deployment || 'gpt-4';
      
      const response = await this.client.chat.completions.create({
        model: deploymentName,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
      });

      const content = response.choices[0]?.message?.content || '';
      const usage = response.usage;

      return {
        content,
        citations: this.extractCitations(content),
        mentions: this.extractMentions(content, options.brandName),
        sentiment: this.analyzeSentiment(content),
        cost: this.calculateCost({
          content,
          tokens: {
            prompt: usage?.promptTokens || 0,
            completion: usage?.completionTokens || 0,
            total: usage?.totalTokens || 0,
          },
        } as LLMResponse),
        tokens: {
          prompt: usage?.promptTokens || 0,
          completion: usage?.completionTokens || 0,
          total: usage?.totalTokens || 0,
        },
      };
    } catch (error) {
      throw new Error(`Azure Copilot API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  normalizeResponse(response: LLMResponse, originalPrompt: string): EngineAnswer {
    return {
      engine: 'copilot',
      answer: response.content,
      citations: response.citations || [],
      mentions: response.mentions || [],
      sentiment: response.sentiment || 'neutral',
      confidence: this.calculateConfidence(response),
      timestamp: new Date(),
      cost: response.cost,
    };
  }

  calculateCost(response: LLMResponse): number {
    if (response.tokens) {
      // Azure OpenAI pricing (similar to OpenAI)
      const promptCostPer1K = 0.03;
      const completionCostPer1K = 0.06;
      
      const promptCost = (response.tokens.prompt / 1000) * promptCostPer1K;
      const completionCost = (response.tokens.completion / 1000) * completionCostPer1K;
      
      return promptCost + completionCost;
    }
    
    // Fallback: estimate based on content length
    const estimatedTokens = response.content.length / 4; // Rough estimate
    return (estimatedTokens / 1000) * 0.06; // Use completion rate as average
  }

  getProviderName(): string {
    return 'copilot';
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test with a simple request
      await this.client.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10,
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
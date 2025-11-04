import OpenAI from 'openai';
import { BaseLLMProvider, LLMResponse, EngineAnswer } from './base-llm-provider';
import { ProviderConfig } from '../types';

export class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  async query(prompt: string, options: any = {}): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: options.model || 'gpt-4',
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
            prompt: usage?.prompt_tokens || 0,
            completion: usage?.completion_tokens || 0,
            total: usage?.total_tokens || 0,
          },
        } as LLMResponse),
        tokens: {
          prompt: usage?.prompt_tokens || 0,
          completion: usage?.completion_tokens || 0,
          total: usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  normalizeResponse(response: LLMResponse, originalPrompt: string): EngineAnswer {
    return {
      engine: 'openai',
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
      // GPT-4 pricing (as of 2024)
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
    return 'openai';
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      return false;
    }
  }
}
import OpenAI from 'openai';
import { BaseLLMProvider, LLMResponse, EngineAnswer } from './base-llm-provider';
import { ProviderConfig } from '../types';

interface RateLimitedKey {
  key: string;
  rateLimitedUntil: number; // Timestamp when rate limit expires
}

export class OpenAIProvider extends BaseLLMProvider {
  private clients: Map<string, OpenAI> = new Map();
  private apiKeys: string[] = [];
  private currentKeyIndex: number = 0;
  private rateLimitedKeys: Map<string, RateLimitedKey> = new Map();
  private readonly RATE_LIMIT_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown for rate-limited keys

  constructor(config: ProviderConfig) {
    super(config);
    
    // Support both single key and multiple keys (comma-separated or array)
    if (config.apiKey) {
      // Check if it's a comma-separated string of keys
      if (config.apiKey.includes(',')) {
        this.apiKeys = config.apiKey.split(',').map(k => k.trim()).filter(k => k.length > 0);
      } else {
        this.apiKeys = [config.apiKey];
      }
    } else if (config.apiKeys && Array.isArray(config.apiKeys)) {
      this.apiKeys = config.apiKeys.filter(k => k && k.length > 0);
    }
    
    if (this.apiKeys.length === 0) {
      throw new Error('At least one OpenAI API key is required');
    }

    // Initialize clients for all keys
    this.apiKeys.forEach(key => {
      this.clients.set(key, new OpenAI({ apiKey: key }));
    });
  }

  /**
   * Get the next available API key (round-robin, skipping rate-limited keys)
   */
  private getNextAvailableKey(): string | null {
    const now = Date.now();
    
    // Clean up expired rate limits
    for (const [key, rateLimit] of this.rateLimitedKeys.entries()) {
      if (now >= rateLimit.rateLimitedUntil) {
        this.rateLimitedKeys.delete(key);
      }
    }

    // Try to find an available key starting from current index
    const startIndex = this.currentKeyIndex;
    let attempts = 0;
    
    while (attempts < this.apiKeys.length) {
      const key = this.apiKeys[this.currentKeyIndex];
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      
      // Skip if this key is rate-limited
      if (!this.rateLimitedKeys.has(key)) {
        return key;
      }
      
      attempts++;
    }

    // All keys are rate-limited, return the first one anyway (will retry)
    return this.apiKeys[0];
  }

  /**
   * Mark a key as rate-limited
   */
  private markKeyAsRateLimited(key: string): void {
    this.rateLimitedKeys.set(key, {
      key,
      rateLimitedUntil: Date.now() + this.RATE_LIMIT_COOLDOWN_MS,
    });
  }

  async query(prompt: string, options: any = {}): Promise<LLMResponse> {
    const maxRetries = this.apiKeys.length;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const apiKey = this.getNextAvailableKey();
      if (!apiKey) {
        throw new Error('No available OpenAI API keys');
      }

      const client = this.clients.get(apiKey);
      if (!client) {
        continue;
      }

      try {
        const response = await client.chat.completions.create({
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
        const errorMessage = error instanceof Error ? error.message : String(error);
        lastError = error instanceof Error ? error : new Error(errorMessage);

        // Check if it's a rate limit error (429)
        if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
          this.markKeyAsRateLimited(apiKey);
          console.warn(`OpenAI API key rate-limited, rotating to next key. Attempt ${attempt + 1}/${maxRetries}`);
          continue; // Try next key
        }

        // For other errors, throw immediately
        throw new Error(`OpenAI API error: ${errorMessage}`);
      }
    }

    // All keys failed
    throw new Error(`All OpenAI API keys failed. Last error: ${lastError?.message || 'Unknown error'}`);
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
    // Try any available key to check availability
    const apiKey = this.getNextAvailableKey();
    if (!apiKey) {
      return false;
    }

    const client = this.clients.get(apiKey);
    if (!client) {
      return false;
    }

    try {
      await client.models.list();
      return true;
    } catch (error) {
      return false;
    }
  }
}
/**
 * Base provider implementation with common functionality
 */

import { 
  EngineKey, 
  EngineAnswer, 
  Sentiment,
  ProviderError,
  RateLimitError 
} from '@ai-visibility/shared';
import { 
  Provider, 
  ProviderConfig, 
  ProviderRequestOptions, 
  ProviderHealth, 
  CostEstimate,
  RateLimitInfo,
  ProviderError as ProviderErrorType 
} from './types';

export abstract class BaseProvider implements Provider {
  protected config: ProviderConfig;
  protected rateLimitInfo: RateLimitInfo | null = null;
  protected lastRequestTime: Date | null = null;

  constructor(
    public readonly key: EngineKey,
    public readonly name: string,
    public readonly version: string,
    config: ProviderConfig = {}
  ) {
    this.config = {
      timeout: 30000,
      retries: 3,
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
      },
      ...config,
    };
  }

  abstract ask(prompt: string, options?: ProviderRequestOptions): Promise<EngineAnswer>;
  
  abstract healthCheck(): Promise<ProviderHealth>;
  
  abstract getCostEstimate(prompt: string, options?: ProviderRequestOptions): Promise<CostEstimate>;

  configure(config: ProviderConfig): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  async getRateLimitInfo(): Promise<RateLimitInfo> {
    if (!this.rateLimitInfo) {
      return {
        remaining: this.config.rateLimit?.requestsPerMinute || 60,
        resetTime: new Date(Date.now() + 60000),
        limit: this.config.rateLimit?.requestsPerMinute || 60,
      };
    }
    return this.rateLimitInfo;
  }

  async isRateLimited(): Promise<boolean> {
    const rateLimitInfo = await this.getRateLimitInfo();
    return rateLimitInfo.remaining <= 0 && rateLimitInfo.resetTime > new Date();
  }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;
    const maxRetries = this.config.retries || 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Check rate limiting
        if (await this.isRateLimited()) {
          throw new RateLimitError('Rate limit exceeded', 60);
        }

        const result = await operation();
        
        // Update rate limit info on success
        if (this.rateLimitInfo) {
          this.rateLimitInfo.remaining = Math.max(0, this.rateLimitInfo.remaining - 1);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (error instanceof RateLimitError || 
            (error as any)?.code === 'AUTHENTICATION_ERROR' ||
            (error as any)?.code === 'VALIDATION_ERROR') {
          throw error;
        }

        // Exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.warn(`${context} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`${context} failed after ${maxRetries + 1} attempts`);
  }

  protected createEngineAnswer(
    prompt: string,
    answerText: string,
    mentions: Array<{ brand: string; position?: number; sentiment?: Sentiment; snippet: string }> = [],
    citations: Array<{ url: string; domain: string; confidence?: number }> = [],
    metadata: Record<string, any> = {}
  ): EngineAnswer {
    return {
      engine: this.key,
      promptId: this.generatePromptId(prompt),
      answerText,
      mentions,
      citations,
      meta: {
        provider: this.name,
        version: this.version,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
      timestamp: new Date().toISOString(),
    };
  }

  protected generatePromptId(prompt: string): string {
    // Simple hash-based ID generation
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `prompt_${Math.abs(hash).toString(36)}`;
  }

  protected async simulateLatency(minMs: number = 100, maxMs: number = 1000): Promise<void> {
    if (this.config.simulateLatency !== false) {
      const delay = Math.random() * (maxMs - minMs) + minMs;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  protected shouldSimulateError(): boolean {
    if (this.config.simulateErrors && this.config.errorRate) {
      return Math.random() < this.config.errorRate;
    }
    return false;
  }

  protected createProviderError(
    code: string,
    message: string,
    retryable: boolean = true,
    retryAfter?: number
  ): ProviderErrorType {
    return {
      code,
      message,
      retryable,
      retryAfter,
    };
  }
}

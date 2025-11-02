import { Injectable } from '@nestjs/common';
import { LLMConfigService, LLMConfig } from './llm-config.service';
import { BaseLLMProvider } from '@ai-visibility/providers';

export interface LLMResponse {
  text: string;
  usage?: { promptTokens: number; completionTokens: number };
  metadata?: Record<string, any>;
}

@Injectable()
export class LLMRouterService {
  constructor(private llmConfigService: LLMConfigService) {}

  /**
   * Route LLM request to configured provider for workspace
   */
  async routeLLMRequest(
    workspaceId: string,
    prompt: string,
    options: any = {}
  ): Promise<LLMResponse> {
    const config = await this.llmConfigService.getWorkspaceLLMConfig(workspaceId);
    
    try {
      const provider = await this.createProvider(config);
      return await provider.query(prompt, { ...options, model: config.model });
    } catch (error) {
      // If primary provider fails, try fallback providers
      console.warn(`Primary LLM provider failed for workspace ${workspaceId}:`, error instanceof Error ? error.message : String(error));
      
      const fallbackProviders = this.getFallbackProviders(config.provider);
      
      for (const fallbackProvider of fallbackProviders) {
        try {
          const fallbackConfig = await this.getProviderConfig(fallbackProvider);
          const provider = await this.createProvider(fallbackConfig);
          return await provider.query(prompt, { ...options, model: fallbackConfig.model });
        } catch (fallbackError) {
          console.warn(`Fallback provider ${fallbackProvider} also failed:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          continue;
        }
      }
      
      throw new Error(`All LLM providers failed for workspace ${workspaceId}`);
    }
  }

  /**
   * Create provider instance from config
   */
  private async createProvider(config: LLMConfig): Promise<BaseLLMProvider> {
    switch (config.provider) {
      case 'openai':
        const { OpenAIProvider } = await import('@ai-visibility/providers');
        return new OpenAIProvider({ apiKey: config.apiKey });
      
      case 'anthropic':
        const { AnthropicProvider } = await import('@ai-visibility/providers');
        return new AnthropicProvider({ apiKey: config.apiKey });
      
      case 'gemini':
        const { GeminiProvider } = await import('@ai-visibility/providers');
        return new GeminiProvider({ apiKey: config.apiKey });
      
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }

  /**
   * Get fallback providers for a given provider
   */
  private getFallbackProviders(primaryProvider: string): string[] {
    const fallbackMap = {
      'openai': ['anthropic', 'gemini'],
      'anthropic': ['openai', 'gemini'],
      'gemini': ['openai', 'anthropic'],
    };
    
    const fallbackMap: Record<string, string[]> = {
      'openai': ['anthropic', 'gemini'],
      'anthropic': ['openai', 'gemini'],
      'gemini': ['openai', 'anthropic'],
    };
    return fallbackMap[primaryProvider] || ['openai'];
  }

  /**
   * Get provider configuration for fallback providers
   */
  private async getProviderConfig(provider: string): Promise<LLMConfig> {
    switch (provider) {
      case 'openai':
        return {
          provider: 'openai',
          model: 'gpt-4',
          apiKey: process.env.OPENAI_API_KEY!,
        };
      
      case 'anthropic':
        return {
          provider: 'anthropic',
          model: 'claude-3-opus-20240229',
          apiKey: process.env.ANTHROPIC_API_KEY!,
        };
      
      case 'gemini':
        return {
          provider: 'gemini',
          model: 'gemini-pro',
          apiKey: process.env.GOOGLE_AI_API_KEY!,
        };
      
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Track usage and cost for LLM requests
   */
  async trackUsage(
    workspaceId: string,
    provider: string,
    model: string,
    promptTokens: number,
    completionTokens: number,
    cost: number
  ): Promise<void> {
    // TODO: Implement cost tracking in database
    // This would create entries in CostLedger and WorkspaceDailyCost tables
    
    console.log(`Tracking LLM usage for workspace ${workspaceId}:`, {
      provider,
      model,
      promptTokens,
      completionTokens,
      cost,
    });
  }

  /**
   * Get usage statistics for a workspace
   */
  async getUsageStats(workspaceId: string): Promise<{
    totalRequests: number;
    totalCost: number;
    providerBreakdown: Record<string, { requests: number; cost: number }>;
    dailyUsage: Array<{ date: string; cost: number; requests: number }>;
  }> {
    // TODO: Implement usage statistics from database
    return {
      totalRequests: 0,
      totalCost: 0,
      providerBreakdown: {},
      dailyUsage: [],
    };
  }

  /**
   * Check if workspace has exceeded budget
   */
  async checkBudgetLimit(workspaceId: string): Promise<{
    exceeded: boolean;
    currentCost: number;
    budgetLimit: number;
    remainingBudget: number;
  }> {
    // TODO: Implement budget checking from database
    const budgetLimit = 100.0; // Default budget
    const currentCost = 0; // TODO: Get from database
    
    return {
      exceeded: currentCost >= budgetLimit,
      currentCost,
      budgetLimit,
      remainingBudget: Math.max(0, budgetLimit - currentCost),
    };
  }
}


import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'gemini';
  model: string;
  apiKey: string;
  endpoint?: string;
}

@Injectable()
export class LLMConfigService {
  constructor(private configService: ConfigService) {}

  /**
   * Get LLM configuration for a workspace
   * Defaults to OpenAI GPT-4 if no workspace-specific config
   */
  async getWorkspaceLLMConfig(workspaceId: string): Promise<LLMConfig> {
    // TODO: Implement database lookup for workspace-specific LLM settings
    // For now, return default OpenAI configuration
    
    const defaultProvider = this.configService.get<string>('DEFAULT_LLM_PROVIDER', 'openai');
    const defaultModel = this.configService.get<string>('DEFAULT_LLM_MODEL', 'gpt-4');
    
    switch (defaultProvider) {
      case 'anthropic':
        return {
          provider: 'anthropic',
          model: defaultModel || 'claude-3-opus-20240229',
          apiKey: this.configService.get<string>('ANTHROPIC_API_KEY')!,
        };
      
      case 'gemini':
        return {
          provider: 'gemini',
          model: defaultModel || 'gemini-pro',
          apiKey: this.configService.get<string>('GOOGLE_AI_API_KEY')!,
        };
      
      case 'openai':
      default:
        return {
          provider: 'openai',
          model: defaultModel || 'gpt-4',
          apiKey: this.configService.get<string>('OPENAI_API_KEY')!,
        };
    }
  }

  /**
   * Update LLM configuration for a workspace
   */
  async updateWorkspaceLLMConfig(
    workspaceId: string, 
    config: Partial<LLMConfig>
  ): Promise<void> {
    // TODO: Implement database update for workspace LLM settings
    // This would update the WorkspaceSettings table
    console.log(`Updating LLM config for workspace ${workspaceId}:`, config);
  }

  /**
   * Test LLM provider connection
   */
  async testLLMProvider(config: LLMConfig): Promise<boolean> {
    try {
      // Import the appropriate provider based on config
      let provider;
      
      // Dynamic imports to avoid build-time dependencies
      switch (config.provider) {
        case 'openai':
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { OpenAIProvider } = require('@ai-visibility/providers');
          provider = new OpenAIProvider({ apiKey: config.apiKey });
          break;
        
        case 'anthropic':
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { AnthropicProvider } = require('@ai-visibility/providers');
          provider = new AnthropicProvider({ apiKey: config.apiKey });
          break;
        
        case 'gemini':
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { GeminiProvider } = require('@ai-visibility/providers');
          provider = new GeminiProvider({ apiKey: config.apiKey });
          break;
        
        default:
          return false;
      }

      // Test the connection
      return await provider.isAvailable();
    } catch (error) {
      console.error('LLM provider test failed:', error);
      return false;
    }
  }

  /**
   * Get available LLM providers and their models
   */
  getAvailableProviders(): Array<{
    provider: string;
    models: string[];
    description: string;
  }> {
    return [
      {
        provider: 'openai',
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        description: 'OpenAI GPT models - most reliable and widely used',
      },
      {
        provider: 'anthropic',
        models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
        description: 'Anthropic Claude models - excellent for long-form content',
      },
      {
        provider: 'gemini',
        models: ['gemini-pro', 'gemini-pro-vision'],
        description: 'Google Gemini models - cost-effective with good performance',
      },
    ];
  }

  /**
   * Calculate estimated cost for a request
   */
  estimateCost(
    provider: string,
    model: string,
    promptTokens: number,
    completionTokens: number
  ): number {
    const pricing = {
      openai: {
        'gpt-4': { prompt: 0.03, completion: 0.06 },
        'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
        'gpt-3.5-turbo': { prompt: 0.001, completion: 0.002 },
      },
      anthropic: {
        'claude-3-opus-20240229': { prompt: 0.015, completion: 0.075 },
        'claude-3-sonnet-20240229': { prompt: 0.003, completion: 0.015 },
        'claude-3-haiku-20240307': { prompt: 0.00025, completion: 0.00125 },
      },
      gemini: {
        'gemini-pro': { prompt: 0.0005, completion: 0.0015 },
        'gemini-pro-vision': { prompt: 0.0005, completion: 0.0015 },
      },
    };

    const providerPricing = pricing[provider as keyof typeof pricing];
    if (!providerPricing) return 0;

    const modelPricing = (providerPricing as Record<string, { prompt: number; completion: number }>)[model];
    if (!modelPricing) return 0;

    const promptCost = (promptTokens / 1000) * modelPricing.prompt;
    const completionCost = (completionTokens / 1000) * modelPricing.completion;

    return promptCost + completionCost;
  }
}


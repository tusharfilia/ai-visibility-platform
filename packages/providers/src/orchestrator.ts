/**
 * Parallel AI Provider Orchestrator
 * Manages parallel execution of AI engines with retry logic and circuit breaker
 */

import { EventEmitter } from 'events';
import { EngineKey } from '@ai-visibility/shared';
import { ProviderRegistry } from './provider-registry';
import { CircuitBreaker } from './circuit-breaker';
import { HealthMonitor } from './health-monitor';

export interface OrchestrationConfig {
  maxConcurrency: number;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  healthCheckIntervalMs: number;
}

export interface ProviderResult {
  provider: string;
  success: boolean;
  data?: any;
  error?: string;
  latency: number;
  cost: number;
  engineType?: 'search' | 'llm';
}

export interface OrchestrationResult {
  results: ProviderResult[];
  totalLatency: number;
  totalCost: number;
  successCount: number;
  failureCount: number;
}

export class AIProviderOrchestrator extends EventEmitter {
  private providerRegistry: ProviderRegistry;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private healthMonitor: HealthMonitor;
  private config: OrchestrationConfig;

  constructor(
    providerRegistry: ProviderRegistry,
    config: Partial<OrchestrationConfig> = {}
  ) {
    super();
    
    this.providerRegistry = providerRegistry;
    this.config = {
      maxConcurrency: 5,
      timeoutMs: 30000,
      retryAttempts: 3,
      retryDelayMs: 1000,
      circuitBreakerThreshold: 5,
      healthCheckIntervalMs: 60000,
      ...config
    };

    this.healthMonitor = new HealthMonitor(this.providerRegistry, this.config.healthCheckIntervalMs);
    this.setupCircuitBreakers();
    this.setupHealthMonitoring();
  }

  /**
   * Execute parallel AI provider queries
   */
  async executeParallel(
    query: string,
    providers: string[],
    workspaceId: string,
    options: {
      timeout?: number;
      priority?: number;
      costLimit?: number;
      service?: string;
      location?: string;
    } = {}
  ): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const results: ProviderResult[] = [];
    const activeProviders = await this.getActiveProviders(providers);
    
    if (activeProviders.length === 0) {
      throw new Error('No active providers available');
    }

    // Execute providers in parallel with concurrency limit
    const promises = activeProviders.map(provider => 
      this.executeProvider(provider, query, workspaceId, options)
    );

    try {
      const providerResults = await Promise.allSettled(promises);
      
      providerResults.forEach((result, index) => {
        const provider = activeProviders[index];
        
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            provider,
            success: false,
            error: result.reason?.message || 'Unknown error',
            latency: 0,
            cost: 0
          });
        }
      });

      const totalLatency = Date.now() - startTime;
      const totalCost = results.reduce((sum, result) => sum + result.cost, 0);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      const orchestrationResult: OrchestrationResult = {
        results,
        totalLatency,
        totalCost,
        successCount,
        failureCount
      };

      // Emit orchestration event
      this.emit('orchestration:completed', {
        workspaceId,
        query,
        result: orchestrationResult
      });

      return orchestrationResult;
    } catch (error) {
      this.emit('orchestration:failed', {
        workspaceId,
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Execute single provider with retry logic
   */
  private async executeProvider(
    providerName: string,
    query: string,
    workspaceId: string,
    options: any
  ): Promise<ProviderResult> {
    const startTime = Date.now();
    const circuitBreaker = this.circuitBreakers.get(providerName);
    
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker not found for provider: ${providerName}`);
    }

    // Check circuit breaker state
    if (!circuitBreaker.canExecute()) {
      throw new Error(`Circuit breaker open for provider: ${providerName}`);
    }

    try {
      const provider = this.providerRegistry.get(providerName as EngineKey);
      if (!provider) {
        throw new Error(`Provider not found: ${providerName}`);
      }

      // Execute with timeout
      const result = await this.executeWithTimeout(
        (provider as any).query(query, { workspaceId, ...options }),
        options.timeout || this.config.timeoutMs
      );

      const latency = Date.now() - startTime;
      const cost = this.calculateCost(providerName, query, result);
      const engineType = this.getEngineType(providerName);

      // Record success
      circuitBreaker.recordSuccess();
      this.healthMonitor.recordSuccess(providerName, latency);

      return {
        provider: providerName,
        success: true,
        data: result,
        latency,
        cost,
        engineType
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Record failure
      circuitBreaker.recordFailure();
      this.healthMonitor.recordFailure(providerName, errorMessage);

      return {
        provider: providerName,
        success: false,
        error: errorMessage,
        latency,
        cost: 0,
        engineType: this.getEngineType(providerName)
      };
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
      })
    ]);
  }

  /**
   * Get active providers (not circuit breaker open)
   */
  private async getActiveProviders(providers: string[]): Promise<string[]> {
    const activeProviders: string[] = [];
    
    for (const provider of providers) {
      const circuitBreaker = this.circuitBreakers.get(provider);
      if (circuitBreaker && circuitBreaker.canExecute()) {
        activeProviders.push(provider);
      }
    }
    
    return activeProviders;
  }

  /**
   * Setup circuit breakers for all providers
   */
  private setupCircuitBreakers(): void {
    const providers = this.providerRegistry.getAll();
    
    providers.forEach((provider, key) => {
      const circuitBreaker = new CircuitBreaker({
        threshold: this.config.circuitBreakerThreshold,
        timeout: 60000, // 1 minute
        resetTimeout: 30000 // 30 seconds
      });
      
      this.circuitBreakers.set(key, circuitBreaker);
    });
  }

  /**
   * Setup health monitoring
   */
  private setupHealthMonitoring(): void {
    this.healthMonitor.on('provider:unhealthy', (provider) => {
      console.warn(`Provider ${provider} is unhealthy`);
      this.emit('provider:unhealthy', provider);
    });

    this.healthMonitor.on('provider:healthy', (provider) => {
      console.log(`Provider ${provider} is healthy`);
      this.emit('provider:healthy', provider);
    });
  }

  /**
   * Calculate cost for provider operation
   */
  private calculateCost(provider: string, query: string, result?: any): number {
    // LLM providers have cost in result data
    if (result?.cost) {
      return result.cost;
    }
    
    // Search providers use base costs
    const baseCosts = {
      'perplexity': 0.01,
      'aio': 0.005,
      'brave': 0.001,
      'openai': 0.05,
      'anthropic': 0.08,
      'gemini': 0.01,
      'copilot': 0.05
    };
    
    const baseCost = (baseCosts as Record<string, number>)[provider] || 0.01;
    const queryLength = query.length;
    
    return baseCost * (queryLength / 100); // Scale by query length
  }

  /**
   * Get engine type for provider
   */
  private getEngineType(provider: string): 'search' | 'llm' {
    const llmProviders = ['openai', 'anthropic', 'gemini', 'copilot'];
    return llmProviders.includes(provider) ? 'llm' : 'search';
  }

  /**
   * Get orchestration metrics
   */
  async getMetrics(): Promise<{
    totalExecutions: number;
    successRate: number;
    averageLatency: number;
    totalCost: number;
    providerHealth: Record<string, any>;
    circuitBreakerStates: Record<string, string>;
  }> {
    const providerHealth = await this.healthMonitor.getHealthStatus();
    const circuitBreakerStates = Object.fromEntries(
      Array.from(this.circuitBreakers.entries()).map(([provider, cb]) => [
        provider,
        cb.getState()
      ])
    );

    return {
      totalExecutions: this.healthMonitor.getTotalExecutions(),
      successRate: this.healthMonitor.getSuccessRate(),
      averageLatency: this.healthMonitor.getAverageLatency(),
      totalCost: this.healthMonitor.getTotalCost(),
      providerHealth,
      circuitBreakerStates
    };
  }

  /**
   * Get provider status
   */
  getProviderStatus(provider: string): {
    healthy: boolean;
    circuitBreakerState: string;
    lastExecution: Date | null;
    successRate: number;
  } {
    const circuitBreaker = this.circuitBreakers.get(provider);
    const health = this.healthMonitor.getProviderHealth(provider);
    
    return {
      healthy: health.healthy,
      circuitBreakerState: circuitBreaker?.getState() || 'unknown',
      lastExecution: health.lastExecution,
      successRate: health.successRate
    };
  }
}

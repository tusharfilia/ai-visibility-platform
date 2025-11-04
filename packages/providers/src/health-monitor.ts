/**
 * Health Monitor for AI Providers
 * Tracks provider health, latency, and success rates
 */

import { EventEmitter } from 'events';
import { ProviderRegistry } from './provider-registry';

export interface HealthStatus {
  healthy: boolean;
  successRate: number;
  averageLatency: number;
  lastExecution: Date | null;
  totalExecutions: number;
  totalFailures: number;
  consecutiveFailures: number;
}

export interface HealthMetrics {
  totalExecutions: number;
  successRate: number;
  averageLatency: number;
  totalCost: number;
  providerHealth: Record<string, HealthStatus>;
}

export class HealthMonitor extends EventEmitter {
  private providerRegistry: ProviderRegistry;
  private healthData: Map<string, HealthStatus> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private config: {
    checkIntervalMs: number;
    unhealthyThreshold: number;
    recoveryThreshold: number;
  };

  constructor(
    providerRegistry: ProviderRegistry,
    checkIntervalMs: number = 60000
  ) {
    super();
    
    this.providerRegistry = providerRegistry;
    this.config = {
      checkIntervalMs,
      unhealthyThreshold: 0.5, // 50% success rate
      recoveryThreshold: 0.8    // 80% success rate
    };
    
    this.initializeHealthData();
    this.startHealthChecks();
  }

  /**
   * Initialize health data for all providers
   */
  private initializeHealthData(): void {
    const providers = this.providerRegistry.getAllProviders();
    
    providers.forEach(provider => {
      this.healthData.set(provider, {
        healthy: true,
        successRate: 1.0,
        averageLatency: 0,
        lastExecution: null,
        totalExecutions: 0,
        totalFailures: 0,
        consecutiveFailures: 0
      });
    });
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.checkInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Record successful execution
   */
  recordSuccess(provider: string, latency: number): void {
    const health = this.healthData.get(provider);
    if (!health) return;

    health.totalExecutions++;
    health.lastExecution = new Date();
    health.consecutiveFailures = 0;
    
    // Update success rate
    health.successRate = (health.totalExecutions - health.totalFailures) / health.totalExecutions;
    
    // Update average latency
    health.averageLatency = (health.averageLatency * (health.totalExecutions - 1) + latency) / health.totalExecutions;
    
    // Check if provider recovered
    if (!health.healthy && health.successRate >= this.config.recoveryThreshold) {
      health.healthy = true;
      this.emit('provider:healthy', provider);
    }
  }

  /**
   * Record failed execution
   */
  recordFailure(provider: string, error: string): void {
    const health = this.healthData.get(provider);
    if (!health) return;

    health.totalExecutions++;
    health.totalFailures++;
    health.consecutiveFailures++;
    health.lastExecution = new Date();
    
    // Update success rate
    health.successRate = (health.totalExecutions - health.totalFailures) / health.totalExecutions;
    
    // Check if provider became unhealthy
    if (health.healthy && health.successRate < this.config.unhealthyThreshold) {
      health.healthy = false;
      this.emit('provider:unhealthy', provider);
    }
  }

  /**
   * Get health status for provider
   */
  getProviderHealth(provider: string): HealthStatus {
    return this.healthData.get(provider) || {
      healthy: false,
      successRate: 0,
      averageLatency: 0,
      lastExecution: null,
      totalExecutions: 0,
      totalFailures: 0,
      consecutiveFailures: 0
    };
  }

  /**
   * Get overall health status
   */
  async getHealthStatus(): Promise<Record<string, HealthStatus>> {
    return Object.fromEntries(this.healthData);
  }

  /**
   * Get health metrics
   */
  getMetrics(): HealthMetrics {
    const totalExecutions = Array.from(this.healthData.values())
      .reduce((sum, health) => sum + health.totalExecutions, 0);
    
    const totalFailures = Array.from(this.healthData.values())
      .reduce((sum, health) => sum + health.totalFailures, 0);
    
    const successRate = totalExecutions > 0 ? (totalExecutions - totalFailures) / totalExecutions : 0;
    
    const averageLatency = Array.from(this.healthData.values())
      .reduce((sum, health) => sum + health.averageLatency, 0) / this.healthData.size;
    
    return {
      totalExecutions,
      successRate,
      averageLatency,
      totalCost: 0, // Would be calculated from cost tracking
      providerHealth: Object.fromEntries(this.healthData)
    };
  }

  /**
   * Get total executions
   */
  getTotalExecutions(): number {
    return Array.from(this.healthData.values())
      .reduce((sum, health) => sum + health.totalExecutions, 0);
  }

  /**
   * Get overall success rate
   */
  getSuccessRate(): number {
    const totalExecutions = this.getTotalExecutions();
    const totalFailures = Array.from(this.healthData.values())
      .reduce((sum, health) => sum + health.totalFailures, 0);
    
    return totalExecutions > 0 ? (totalExecutions - totalFailures) / totalExecutions : 0;
  }

  /**
   * Get average latency
   */
  getAverageLatency(): number {
    const latencies = Array.from(this.healthData.values())
      .map(health => health.averageLatency)
      .filter(latency => latency > 0);
    
    return latencies.length > 0 
      ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length 
      : 0;
  }

  /**
   * Get total cost
   */
  getTotalCost(): number {
    // This would integrate with cost tracking
    return 0;
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(): Promise<void> {
    const providers = this.providerRegistry.getAllProviders();
    
    for (const provider of providers) {
      try {
        await this.checkProviderHealth(provider);
      } catch (error) {
        console.error(`Health check failed for provider ${provider}:`, error);
      }
    }
  }

  /**
   * Check individual provider health
   */
  private async checkProviderHealth(provider: string): Promise<void> {
    const health = this.healthData.get(provider);
    if (!health) return;

    // Check if provider has been inactive for too long
    if (health.lastExecution) {
      const timeSinceLastExecution = Date.now() - health.lastExecution.getTime();
      const maxInactiveTime = 5 * 60 * 1000; // 5 minutes
      
      if (timeSinceLastExecution > maxInactiveTime && health.totalExecutions > 0) {
        // Mark as potentially unhealthy if inactive
        if (health.healthy) {
          health.healthy = false;
          this.emit('provider:unhealthy', provider);
        }
      }
    }
  }

  /**
   * Reset health data for provider
   */
  resetProviderHealth(provider: string): void {
    this.healthData.set(provider, {
      healthy: true,
      successRate: 1.0,
      averageLatency: 0,
      lastExecution: null,
      totalExecutions: 0,
      totalFailures: 0,
      consecutiveFailures: 0
    });
  }

  /**
   * Get unhealthy providers
   */
  getUnhealthyProviders(): string[] {
    return Array.from(this.healthData.entries())
      .filter(([_, health]) => !health.healthy)
      .map(([provider, _]) => provider);
  }

  /**
   * Get healthy providers
   */
  getHealthyProviders(): string[] {
    return Array.from(this.healthData.entries())
      .filter(([_, health]) => health.healthy)
      .map(([provider, _]) => provider);
  }
}



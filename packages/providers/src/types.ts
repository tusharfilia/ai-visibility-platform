/**
 * Provider types and interfaces for AI search engines
 */

import { EngineKey, Sentiment, EngineAnswer } from '@ai-visibility/shared';

// Provider configuration
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  simulateLatency?: boolean;
  simulateErrors?: boolean;
  errorRate?: number;
}

// Provider response metadata
export interface ProviderMetadata {
  model?: string;
  tokens?: number;
  latency?: number;
  cost?: number;
  region?: string;
  version?: string;
}

// Provider error details
export interface ProviderError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  retryAfter?: number;
}

// Provider request options
export interface ProviderRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  metadata?: Record<string, any>;
}

// Provider response with metadata
export interface ProviderResponse<T = any> {
  data: T;
  metadata: ProviderMetadata;
  error?: ProviderError;
}

// Cost estimation
export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  currency: string;
}

// Rate limit information
export interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  limit: number;
}

// Provider health status
export interface ProviderHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  lastCheck: Date;
  error?: string;
}

// Provider interface
export interface Provider {
  readonly key: EngineKey;
  readonly name: string;
  readonly version: string;
  
  // Core methods
  ask(prompt: string, options?: ProviderRequestOptions): Promise<EngineAnswer>;
  healthCheck(): Promise<ProviderHealth>;
  getCostEstimate(prompt: string, options?: ProviderRequestOptions): Promise<CostEstimate>;
  
  // Configuration
  configure(config: ProviderConfig): void;
  getConfig(): ProviderConfig;
  
  // Rate limiting
  getRateLimitInfo(): Promise<RateLimitInfo>;
  isRateLimited(): Promise<boolean>;
}

// Provider factory
export interface ProviderFactory {
  create(key: EngineKey, config?: ProviderConfig): Provider;
  getSupportedEngines(): EngineKey[];
}

// Mock provider configuration
export interface MockProviderConfig extends ProviderConfig {
  useFixtures?: boolean;
  fixturePath?: string;
  simulateLatency?: boolean;
  simulateErrors?: boolean;
  errorRate?: number;
}

// Fixture data structure
export interface ProviderFixture {
  prompt: string;
  response: EngineAnswer;
  metadata: ProviderMetadata;
  error?: ProviderError;
}

// Provider registry
export interface ProviderRegistry {
  register(key: EngineKey, provider: Provider): void;
  get(key: EngineKey): Provider | undefined;
  getAll(): Map<EngineKey, Provider>;
  unregister(key: EngineKey): boolean;
  clear(): void;
}

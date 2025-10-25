/**
 * OpenAPI client generation and typed fetch wrapper
 * Generates typed client from Swagger JSON at build time
 */

import { ApiResponse, PaginatedResponse } from './types';

// Base configuration for API client
export interface ApiClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

// Request options
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

// Typed fetch wrapper
export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout || this.config.timeout || 30000
    );

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, any>;
        return {
          ok: false,
          error: {
            code: `HTTP_${response.status}`,
            message: errorData.message || response.statusText,
            details: errorData,
          },
        };
      }

      const data = await response.json() as T;
      return {
        ok: true,
        data,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            ok: false,
            error: {
              code: 'TIMEOUT',
              message: 'Request timeout',
            },
          };
        }
      }

      return {
        ok: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // Convenience methods
  async get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  async delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  async patch<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }
}

// Factory function to create API client
export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

// Default client instance (to be configured by the SPA)
let defaultClient: ApiClient | null = null;

export function setDefaultClient(client: ApiClient): void {
  defaultClient = client;
}

export function getDefaultClient(): ApiClient {
  if (!defaultClient) {
    throw new Error('Default API client not configured. Call setDefaultClient() first.');
  }
  return defaultClient;
}

// Convenience functions using default client
export async function apiGet<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
  return getDefaultClient().get<T>(endpoint, options);
}

export async function apiPost<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
  return getDefaultClient().post<T>(endpoint, body, options);
}

export async function apiPut<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
  return getDefaultClient().put<T>(endpoint, body, options);
}

export async function apiDelete<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
  return getDefaultClient().delete<T>(endpoint, options);
}

export async function apiPatch<T>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>) {
  return getDefaultClient().patch<T>(endpoint, body, options);
}

// Build-time client generation script
export interface ClientGenerationConfig {
  swaggerUrl: string;
  outputPath: string;
  clientName?: string;
}

/**
 * Generate typed client from OpenAPI/Swagger spec
 * This would typically be run as a build script
 */
export async function generateTypedClient(config: ClientGenerationConfig): Promise<void> {
  // This is a placeholder for the actual client generation
  // In a real implementation, this would:
  // 1. Fetch the Swagger JSON from config.swaggerUrl
  // 2. Parse the OpenAPI spec
  // 3. Generate TypeScript types and client methods
  // 4. Write the generated code to config.outputPath
  
  console.log(`Generating typed client from ${config.swaggerUrl}`);
  console.log(`Output path: ${config.outputPath}`);
  
  // Example implementation would use tools like:
  // - openapi-typescript
  // - swagger-codegen
  // - or custom OpenAPI parser
}

// Export types for SPA consumption
export type {
  ApiResponse,
  PaginatedResponse,
};

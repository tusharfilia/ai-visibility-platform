/**
 * Provider registry and factory for managing AI search engine providers
 */

import { EngineKey } from '@ai-visibility/shared';
import { Provider, ProviderFactory, ProviderRegistry as IProviderRegistry } from './types';
import { PerplexityProvider } from './perplexity-provider';
import { AioProvider } from './aio-provider';
import { BraveProvider } from './brave-provider';

export class ProviderRegistry implements IProviderRegistry {
  private providers = new Map<EngineKey, Provider>();

  register(key: EngineKey, provider: Provider): void {
    this.providers.set(key, provider);
  }

  get(key: EngineKey): Provider | undefined {
    return this.providers.get(key);
  }

  getAll(): Map<EngineKey, Provider> {
    return new Map(this.providers);
  }

  unregister(key: EngineKey): boolean {
    return this.providers.delete(key);
  }

  clear(): void {
    this.providers.clear();
  }
}

export class ProviderFactory implements ProviderFactory {
  private registry: ProviderRegistry;

  constructor(registry?: ProviderRegistry) {
    this.registry = registry || new ProviderRegistry();
  }

  create(key: EngineKey, config?: any): Provider {
    let provider: Provider;

    switch (key) {
      case EngineKey.PERPLEXITY:
        provider = new PerplexityProvider(config);
        break;
      case EngineKey.AIO:
        provider = new AioProvider(config);
        break;
      case EngineKey.BRAVE:
        provider = new BraveProvider(config);
        break;
      default:
        throw new Error(`Unsupported engine: ${key}`);
    }

    this.registry.register(key, provider);
    return provider;
  }

  getSupportedEngines(): EngineKey[] {
    return [EngineKey.PERPLEXITY, EngineKey.AIO, EngineKey.BRAVE];
  }

  getRegistry(): ProviderRegistry {
    return this.registry;
  }
}

// Global registry instance
export const globalRegistry = new ProviderRegistry();
export const globalFactory = new ProviderFactory(globalRegistry);

// Convenience functions
export function createProvider(key: EngineKey, config?: any): Provider {
  return globalFactory.create(key, config);
}

export function getProvider(key: EngineKey): Provider | undefined {
  return globalRegistry.get(key);
}

export function getAllProviders(): Map<EngineKey, Provider> {
  return globalRegistry.getAll();
}

export function registerProvider(key: EngineKey, provider: Provider): void {
  globalRegistry.register(key, provider);
}

export function unregisterProvider(key: EngineKey): boolean {
  return globalRegistry.unregister(key);
}

export function clearProviders(): void {
  globalRegistry.clear();
}

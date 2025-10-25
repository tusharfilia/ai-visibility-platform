/**
 * @ai-visibility/providers
 * AI search engine providers with mock implementations and fixtures
 */

// Export all providers
export { PerplexityProvider } from './perplexity-provider';
export { AioProvider } from './aio-provider';
export { BraveProvider } from './brave-provider';

// Export base classes and utilities
export { BaseProvider } from './base-provider';
export { ProviderRegistry, ProviderFactory } from './provider-registry';

// Export types
export * from './types';

// Export fixture utilities
export { loadFixture, saveFixture, clearFixtures } from './fixture-loader';

// Export convenience functions
export {
  createProvider,
  getProvider,
  getAllProviders,
  registerProvider,
  unregisterProvider,
  clearProviders,
  globalRegistry,
  globalFactory,
} from './provider-registry';

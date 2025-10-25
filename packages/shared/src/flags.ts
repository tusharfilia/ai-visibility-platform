/**
 * Feature flags and configuration accessors
 * Reads from environment variables with typed defaults
 */

export interface FeatureFlags {
  // Provider toggles
  perplexityEnabled: boolean;
  aioEnabled: boolean;
  braveEnabled: boolean;
  
  // Copilot features
  fullAutoDefault: boolean;
  brandDefenseEnabled: boolean;
  
  // Future: Flagsmith integration hooks
  // getFlag(key: string): Promise<boolean>;
  // getFlagValue<T>(key: string, defaultValue: T): Promise<T>;
}

/**
 * Get feature flags from environment variables
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    // Provider toggles
    perplexityEnabled: process.env.PERPLEXITY_ENABLED === 'true',
    aioEnabled: process.env.AIO_ENABLED === 'true',
    braveEnabled: process.env.BRAVE_ENABLED === 'true',
    
    // Copilot features
    fullAutoDefault: process.env.FULL_AUTO_DEFAULT === 'true',
    brandDefenseEnabled: process.env.BRAND_DEFENSE_ENABLED === 'true',
  };
}

/**
 * Check if a specific provider is enabled
 */
export function isProviderEnabled(engine: string): boolean {
  const flags = getFeatureFlags();
  
  switch (engine.toUpperCase()) {
    case 'PERPLEXITY':
      return flags.perplexityEnabled;
    case 'AIO':
      return flags.aioEnabled;
    case 'BRAVE':
      return flags.braveEnabled;
    default:
      return false;
  }
}

/**
 * Check if Copilot features are enabled
 */
export function isCopilotEnabled(): boolean {
  const flags = getFeatureFlags();
  return flags.fullAutoDefault || flags.brandDefenseEnabled;
}

/**
 * Get Copilot configuration
 */
export function getCopilotConfig() {
  const flags = getFeatureFlags();
  return {
    fullAuto: flags.fullAutoDefault,
    brandDefense: flags.brandDefenseEnabled,
  };
}

// Future: Flagsmith integration
export interface FlagsmithConfig {
  environmentId: string;
  apiKey: string;
}

/**
 * Future: Initialize Flagsmith client
 * export async function initFlagsmith(config: FlagsmithConfig): Promise<void> {
 *   // Implementation for Flagsmith integration
 * }
 */

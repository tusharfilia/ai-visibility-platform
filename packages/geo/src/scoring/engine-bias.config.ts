/**
 * Engine Bias Configuration
 * Defines engine-specific citation source weights and multipliers
 */

import { EngineKey } from '@ai-visibility/shared';

export interface EngineBiasConfig {
  sourceWeights: {
    reddit: number;
    wikipedia: number;
    licensed_publisher: number;
    curated: number;
    directory: number;
    user_generated: number;
  };
  redditMultiplier?: number;
  licensedPublisherMultiplier?: number;
  curatedMultiplier?: number;
  redditPenalty?: number; // For engines that down-weight Reddit
  citationPatterns: Record<string, number>; // Historical citation percentages
}

export const ENGINE_BIAS_CONFIG: Record<EngineKey, EngineBiasConfig> = {
  PERPLEXITY: {
    sourceWeights: {
      reddit: 0.066,
      wikipedia: 0.03,
      licensed_publisher: 0.20,
      curated: 0.15,
      directory: 0.10,
      user_generated: 0.445, // Remainder
    },
    redditMultiplier: 1.5,
    citationPatterns: {
      reddit: 0.066,
      wikipedia: 0.03,
      licensed_publisher: 0.20,
    },
  },
  // @ts-ignore - OPENAI may not be in enum yet
  OPENAI: {
    sourceWeights: {
      reddit: 0.018,
      wikipedia: 0.078,
      licensed_publisher: 0.30,
      curated: 0.20,
      directory: 0.10,
      user_generated: 0.294, // Remainder
    },
    licensedPublisherMultiplier: 3.0,
    citationPatterns: {
      licensed_publisher: 0.30,
      wikipedia: 0.078,
      reddit: 0.018,
    },
  },
  AIO: {
    sourceWeights: {
      reddit: 0.022,
      wikipedia: 0.006,
      licensed_publisher: 0.15,
      curated: 0.40,
      directory: 0.12,
      user_generated: 0.302, // Remainder
    },
    curatedMultiplier: 2.5,
    redditPenalty: 0.8,
    citationPatterns: {
      curated: 0.40,
      wikipedia: 0.006,
      reddit: 0.022,
    },
  },
  ANTHROPIC: {
    sourceWeights: {
      reddit: 0.025,
      wikipedia: 0.10,
      licensed_publisher: 0.15,
      curated: 0.25,
      directory: 0.10,
      user_generated: 0.365, // Remainder
    },
    curatedMultiplier: 2.0,
    citationPatterns: {
      wikipedia: 0.10,
      curated: 0.25,
    },
  },
  GEMINI: {
    sourceWeights: {
      reddit: 0.030,
      wikipedia: 0.08,
      licensed_publisher: 0.18,
      curated: 0.30,
      directory: 0.12,
      user_generated: 0.290, // Remainder
    },
    curatedMultiplier: 2.2,
    citationPatterns: {
      curated: 0.30,
      wikipedia: 0.08,
    },
  },
  COPILOT: {
    sourceWeights: {
      reddit: 0.020,
      wikipedia: 0.05,
      licensed_publisher: 0.25,
      curated: 0.25,
      directory: 0.15,
      user_generated: 0.280, // Remainder
    },
    licensedPublisherMultiplier: 2.8,
    curatedMultiplier: 2.0,
    citationPatterns: {
      licensed_publisher: 0.25,
      curated: 0.25,
    },
  },
  BRAVE: {
    sourceWeights: {
      reddit: 0.035,
      wikipedia: 0.04,
      licensed_publisher: 0.12,
      curated: 0.20,
      directory: 0.15,
      user_generated: 0.455, // Remainder
    },
    citationPatterns: {
      curated: 0.20,
      directory: 0.15,
    },
  },
};

/**
 * Get engine bias configuration
 */
export function getEngineBiasConfig(engineKey: EngineKey): EngineBiasConfig {
  return ENGINE_BIAS_CONFIG[engineKey] || ENGINE_BIAS_CONFIG.PERPLEXITY; // Default fallback
}

/**
 * Get multiplier for source type on given engine
 */
export function getSourceMultiplier(
  engineKey: EngineKey,
  sourceType: string
): number {
  const config = getEngineBiasConfig(engineKey);

  // Licensed publisher multiplier
  if (sourceType === 'licensed_publisher' && config.licensedPublisherMultiplier) {
    return config.licensedPublisherMultiplier;
  }

  // Curated multiplier
  if (sourceType === 'curated' && config.curatedMultiplier) {
    return config.curatedMultiplier;
  }

  // Reddit multiplier (or penalty)
  if (sourceType === 'reddit') {
    if (config.redditPenalty) {
      return config.redditPenalty;
    }
    if (config.redditMultiplier) {
      return config.redditMultiplier;
    }
  }

  // Default: no multiplier
  return 1.0;
}


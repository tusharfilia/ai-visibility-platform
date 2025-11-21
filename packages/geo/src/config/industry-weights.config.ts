import { IndustryWeightOverrides } from '../types/premium-response.types';

/**
 * Industry-specific weight overrides for GEO Score calculation
 * Adjusts component weights based on industry characteristics
 */
export const industryWeightOverrides: IndustryWeightOverrides = {
  // Local services (plumbers, dentists, etc.) - reviews and local visibility matter more
  'local-services': {
    visibility: 0.40, // +5% (from 35%)
    eeat: 0.20, // -5% (from 25%)
    citations: 0.10, // -5% (from 15%)
    competitors: 0.15, // Same
    technical: 0.10, // Same
    reviews: 0.05, // Additional weight for reviews
  },
  
  // SaaS products - citations and technical signals matter more
  'saas': {
    visibility: 0.30, // -5% (from 35%)
    eeat: 0.25, // Same
    citations: 0.20, // +5% (from 15%)
    competitors: 0.15, // Same
    technical: 0.10, // Same
    reviews: -0.10, // Reviews less important (reduce other weights)
  },
  
  // E-commerce - citations and visibility matter more
  'e-commerce': {
    visibility: 0.40, // +5%
    eeat: 0.20, // -5%
    citations: 0.20, // +5%
    competitors: 0.10, // -5%
    technical: 0.10, // Same
  },
  
  // Healthcare - EEAT and citations matter more
  'healthcare': {
    visibility: 0.30, // -5%
    eeat: 0.35, // +10%
    citations: 0.20, // +5%
    competitors: 0.10, // -5%
    technical: 0.05, // -5%
  },
  
  // Vacation Rentals / OTA - visibility and competitors matter more
  'vacation-rentals': {
    visibility: 0.40, // +5%
    eeat: 0.20, // -5%
    citations: 0.15, // Same
    competitors: 0.20, // +5%
    technical: 0.05, // -5%
  },
  
  // B2B Services - EEAT and citations matter more
  'b2b-services': {
    visibility: 0.30, // -5%
    eeat: 0.30, // +5%
    citations: 0.20, // +5%
    competitors: 0.15, // Same
    technical: 0.05, // -5%
  },
};

/**
 * Get weight overrides for an industry
 */
export function getIndustryWeights(industry: string): IndustryWeightOverrides[string] | null {
  // Normalize industry name
  const normalized = industry.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  
  // Try exact match
  if (industryWeightOverrides[normalized]) {
    return industryWeightOverrides[normalized];
  }
  
  // Try partial match
  for (const [key, weights] of Object.entries(industryWeightOverrides)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return weights;
    }
  }
  
  return null;
}

/**
 * Apply industry weights to base weights
 */
export function applyIndustryWeights(
  baseWeights: {
    visibility: number;
    eeat: number;
    citations: number;
    competitors: number;
    technical: number;
  },
  industry: string
): {
  visibility: number;
  eeat: number;
  citations: number;
  competitors: number;
  technical: number;
} {
  const overrides = getIndustryWeights(industry);
  
  if (!overrides) {
    return baseWeights;
  }
  
  return {
    visibility: overrides.visibility ?? baseWeights.visibility,
    eeat: overrides.eeat ?? baseWeights.eeat,
    citations: overrides.citations ?? baseWeights.citations,
    competitors: overrides.competitors ?? baseWeights.competitors,
    technical: overrides.technical ?? baseWeights.technical,
  };
}


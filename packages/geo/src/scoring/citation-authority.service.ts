/**
 * Citation Authority Service
 * Calculates authority scores with source multipliers and freshness decay
 */

import { Injectable } from '@nestjs/common';
import { EngineKey } from '@ai-visibility/shared';
import { getSourceMultiplier } from './engine-bias.config';

export interface CitationAuthority {
  url: string;
  domain: string;
  sourceType?: string;
  isLicensed?: boolean;
  authorityScore?: number;
  freshness?: Date;
  rank?: number;
  confidence?: number;
}

@Injectable()
export class CitationAuthorityService {
  /**
   * Calculate authority score for citation with engine-specific multipliers
   */
  calculateAuthority(citation: CitationAuthority, engineKey: EngineKey): number {
    // Start with base authority
    let baseAuthority = citation.authorityScore || 0.5;

    // Apply source type multipliers
    if (citation.sourceType) {
      const multiplier = getSourceMultiplier(engineKey, citation.sourceType);
      baseAuthority = baseAuthority * multiplier;
    }

    // Licensed publishers get 3x multiplier (per audit)
    if (citation.isLicensed) {
      baseAuthority = baseAuthority * 3.0;
    }

    // Curated sources get 2x multiplier (per audit)
    if (citation.sourceType === 'curated') {
      baseAuthority = baseAuthority * 2.0;
    }

    // Directories get 1.5x multiplier (per audit)
    if (citation.sourceType === 'directory') {
      baseAuthority = baseAuthority * 1.5;
    }

    // Apply freshness decay if freshness is available
    if (citation.freshness) {
      baseAuthority = this.applyFreshnessDecay(baseAuthority, citation.freshness);
    }

    // Adjust by rank if available
    if (citation.rank !== null && citation.rank !== undefined) {
      const rankBoost = Math.max(0, (10 - citation.rank) / 10) * 0.1;
      baseAuthority = Math.min(1.0, baseAuthority + rankBoost);
    }

    // Adjust by confidence if available
    if (citation.confidence !== null && citation.confidence !== undefined) {
      baseAuthority = (baseAuthority + citation.confidence) / 2;
    }

    // Cap at 1.0
    return Math.min(1.0, Math.max(0, baseAuthority));
  }

  /**
   * Apply freshness decay to authority score
   * Exponential decay with half-life ~180 days
   */
  applyFreshnessDecay(authority: number, freshness: Date): number {
    const currentDate = new Date();
    const citationAge = currentDate.getTime() - freshness.getTime();
    const ageInDays = citationAge / (1000 * 60 * 60 * 24);

    // Exponential decay: 50% decay after 180 days, 90% after 365 days
    const decayFactor = Math.exp(-ageInDays / 180);
    const freshnessMultiplier = 0.5 + (0.5 * decayFactor);

    return authority * freshnessMultiplier;
  }

  /**
   * Apply source multipliers to base authority
   */
  applySourceMultipliers(
    baseAuthority: number,
    sourceType: string,
    engineKey: EngineKey
  ): number {
    const multiplier = getSourceMultiplier(engineKey, sourceType);
    return baseAuthority * multiplier;
  }
}


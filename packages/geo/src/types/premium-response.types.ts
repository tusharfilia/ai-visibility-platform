/**
 * Standardized premium response types with evidence, confidence, warnings
 */

export interface PremiumResponse<T> {
  data: T;
  evidence: EvidenceItem[];
  confidence: number; // 0-1
  warnings: string[];
  explanation: string;
  metadata?: {
    generatedAt: Date;
    serviceVersion?: string;
    industry?: string;
    missingData?: string[];
  };
}

export interface EvidenceItem {
  type: 'sov' | 'citation' | 'visibility' | 'prompt-test' | 'competitor' | 'eeat' | 'schema';
  prompt?: string;
  engine?: string;
  raw_output?: string;
  excerpt?: string;
  brands_found?: string[];
  order?: string[];
  context_snippet?: string;
  url?: string;
  domain?: string;
  confidence: number;
  timestamp?: Date;
  reasoning?: string;
}

export interface PremiumPrompt {
  text: string;
  intent: 'BEST' | 'ALTERNATIVES' | 'HOWTO' | 'PRICING' | 'COMPARISON' | 'LOCAL' | 'REVIEWS';
  industryRelevance: number;
  commercialIntent: number;
  evidence?: {
    hasBeenTested: boolean;
    visibilityScore?: number;
    competitorsFound?: string[];
    confidence: number;
  };
  reasoning: string;
}

export interface PremiumCompetitor {
  domain: string;
  brandName: string;
  type: 'direct' | 'content' | 'authority' | 'geo' | 'category';
  confidence: number;
  reasoning: string;
  evidence: {
    foundInPrompts: string[];
    foundInEngines: string[];
    citationCount: number;
    mentionFrequency: number;
    coOccurrenceCount: number;
  };
  visibility: {
    perEngine: Array<{
      engine: string;
      visible: boolean;
      promptsVisible: number;
      promptsTested: number;
    }>;
    overallVisibility: number;
  };
  ranking: {
    averagePosition: number;
    bestPosition: number;
    worstPosition: number;
  };
}

export interface PremiumShareOfVoice {
  entity: string;
  totalMentions: number;
  sharePercentage: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  perEngine: Array<{
    engine: string;
    mentions: number;
    sharePercentage: number;
    evidence: EvidenceItem[];
  }>;
  perPrompt: Array<{
    prompt: string;
    mentions: number;
    position: number;
    engines: string[];
    evidence: EvidenceItem[];
  }>;
  evidence: {
    totalEvidencePoints: number;
    confidence: number;
    missingData: string[];
  };
}

export interface PremiumCitation {
  id: string;
  domain: string;
  url: string;
  snippet: string;
  context: string;
  category: 'news' | 'blog' | 'review' | 'directory' | 'social' | 'other';
  sourcePage: string;
  domainAuthority?: number;
  foundInPrompt: string;
  foundInEngine: string;
  timestamp: Date;
  classification: {
    sourceType: string;
    isLicensed?: boolean;
    publisherName?: string;
    directoryType?: string;
  };
  evidence: {
    rawOutputExcerpt: string;
    whyItCounts: string;
    confidence: number;
  };
}

export interface PremiumGEOScore {
  total: number;
  breakdown: {
    aiVisibility: {
      score: number;
      weight: number;
      points: number;
      evidence: string[];
      explanation: string;
      missing: string[];
      details: {
        perEngine: Array<{
          engine: string;
          coverage: number;
          promptsTested: number;
          promptsVisible: number;
        }>;
        perPrompt: Array<{
          prompt: string;
          enginesVisible: number;
          totalEngines: number;
        }>;
      };
    };
    eeat: {
      score: number;
      weight: number;
      points: number;
      evidence: string[];
      explanation: string;
      missing: string[];
      breakdown: {
        expertise: number;
        authoritativeness: number;
        trustworthiness: number;
        experience: number;
      };
    };
    citations: {
      score: number;
      weight: number;
      points: number;
      evidence: string[];
      explanation: string;
      missing: string[];
      details: {
        totalCitations: number;
        licensedPublisherCitations: number;
        averageAuthority: number;
        citationCategories: Record<string, number>;
      };
    };
    competitorComparison: {
      score: number;
      weight: number;
      points: number;
      evidence: string[];
      explanation: string;
      missing: string[];
      details: {
        shareOfVoice: number;
        competitorCount: number;
        relativePosition: number;
      };
    };
    schemaTechnical: {
      score: number;
      weight: number;
      points: number;
      evidence: string[];
      explanation: string;
      missing: string[];
      details: {
        schemaTypes: string[];
        schemaCompleteness: number;
        structuredDataQuality: number;
      };
    };
  };
  confidence: number;
  warnings: string[];
  recommendations: string[];
}

export interface PremiumBusinessSummary {
  summary: string;
  structuredSummary: {
    what: string;
    where: string;
    differentiation: string;
    valueProps: string[];
    whyUsersChoose: string;
    trustFactors: string[];
    redFlags?: string[];
    category: string;
    intentClusters: string[];
  };
  aiEnginePerspective: {
    howAIInterprets: string;
    keySignals: string[];
    missingSignals: string[];
  };
  marketPosition: {
    position: 'leader' | 'challenger' | 'niche' | 'emerging' | 'unknown';
    reasoning: string;
    confidence: number;
  };
  confidence: number;
  missingData: string[];
  evidence: string[];
}

export interface IndustryWeightOverrides {
  [industry: string]: {
    visibility?: number;
    eeat?: number;
    citations?: number;
    competitors?: number;
    technical?: number;
    reviews?: number;
  };
}


/**
 * Diagnostic intelligence types for premium GEO analysis
 * These types add interpretation, reasoning, and recommendations to all outputs
 */

export interface DiagnosticInsight {
  type: 'strength' | 'weakness' | 'risk' | 'opportunity' | 'threat';
  category: 'visibility' | 'trust' | 'positioning' | 'competition' | 'technical' | 'content';
  title: string;
  description: string;
  reasoning: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number; // 0-1
  evidence: string[];
  affectedEngines?: string[];
  relatedCompetitors?: string[];
}

export interface DiagnosticRecommendation {
  id: string;
  title: string;
  description: string;
  category: 'schema' | 'content' | 'citations' | 'trust' | 'positioning' | 'technical';
  priority: 'high' | 'medium' | 'low';
  difficulty: 'easy' | 'medium' | 'hard';
  expectedImpact: {
    scoreImprovement?: number; // Points added to GEO score
    visibilityGain?: number; // Percentage
    trustGain?: number; // Percentage
    description: string;
  };
  steps: string[];
  relatedInsights: string[]; // IDs of related insights
  estimatedTime?: string; // e.g., "2 hours", "1 week"
  evidence: string[];
}

export interface EngineReasoning {
  engine: string;
  interpretation: string; // How this engine views the business
  keySignals: string[]; // Signals that influenced the engine's view
  missingSignals: string[]; // Signals that would improve visibility
  trustFactors: string[]; // Trust signals the engine values
  visibilityExplanation: string; // Why visibility succeeded/failed
  competitorPreference?: {
    competitor: string;
    reason: string;
    evidence: string[];
  };
}

export interface VisibilityOpportunity {
  prompt: string;
  intent: string;
  commercialValue: number; // 0-1
  industryRelevance: number; // 0-1
  currentVisibility: number; // 0-1
  opportunityGap: number; // 0-1 (how much room for improvement)
  competitorControl: number; // 0-1 (how much competitors dominate)
  recommendedAction: string;
  expectedImpact: string;
  engines: string[]; // Which engines this applies to
}

export interface ThreatAssessment {
  type: 'competitor_substitution' | 'visibility_loss' | 'hallucination_risk' | 'misclassification' | 'trust_degradation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedAreas: string[];
  evidence: string[];
  mitigation: string[];
  relatedCompetitors?: string[];
  relatedPrompts?: string[];
}

export interface CompetitiveThreat {
  competitor: string;
  threatLevel: 'high' | 'medium' | 'low';
  threatAreas: string[]; // e.g., ["high-value prompts", "local search", "trust signals"]
  dominanceReason: string;
  visibilityGap: {
    current: number;
    competitor: number;
    gap: number;
  };
  recommendedActions: string[];
}

export interface DiagnosticBreakdown {
  insights: DiagnosticInsight[];
  strengths: DiagnosticInsight[]; // Filtered insights where type='strength'
  weaknesses: DiagnosticInsight[]; // Filtered insights where type='weakness'
  risks: ThreatAssessment[];
  recommendations: DiagnosticRecommendation[];
  engineReasoning: EngineReasoning[];
  opportunities: VisibilityOpportunity[];
  competitiveThreats: CompetitiveThreat[];
}

/**
 * Enhanced PremiumResponse with diagnostic intelligence
 */
export interface DiagnosticPremiumResponse<T> {
  data: T;
  evidence: EvidenceItem[];
  confidence: number;
  warnings: string[];
  explanation: string;
  // Diagnostic intelligence layer
  diagnostics: DiagnosticBreakdown;
  metadata?: {
    generatedAt: Date;
    serviceVersion?: string;
    industry?: string;
    missingData?: string[];
  };
}


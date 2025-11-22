import { Injectable, Logger } from '@nestjs/common';
import { LLMRouterService } from '@ai-visibility/shared';
import { IndustryDetectorService, IndustryContext } from '../industry/industry-detector.service';
import { EntityExtractorService } from '../entity/entity-extractor.service';
import { SchemaAuditorService } from '../structural/schema-auditor';
import { DiagnosticIntelligenceService } from '../diagnostics/diagnostic-intelligence.service';
import {
  DiagnosticInsight,
  DiagnosticRecommendation,
  EngineReasoning,
  ThreatAssessment,
} from '../types/diagnostic.types';

export interface PremiumBusinessSummary {
  summary: string; // LLM-optimized paragraph for AI panels
  structuredSummary: {
    what: string; // What the business does
    where: string; // Geographic scope
    differentiation: string; // Key differentiators
    valueProps: string[]; // Value propositions
    whyUsersChoose: string; // Why customers choose this business
    trustFactors: string[]; // Trust signals
    redFlags?: string[]; // Potential issues
    category: string; // Business category
    intentClusters: string[]; // Customer intent clusters
  };
  aiEnginePerspective: {
    howAIInterprets: string; // How AI engines likely interpret this business
    keySignals: string[]; // Signals AI engines pick up
    missingSignals: string[]; // Signals that are missing
  };
  marketPosition: {
    position: 'leader' | 'challenger' | 'niche' | 'emerging' | 'unknown';
    reasoning: string;
    confidence: number;
  };
  confidence: number; // 0-1
  missingData: string[];
  evidence: string[];
}

@Injectable()
export class PremiumBusinessSummaryService {
  private readonly logger = new Logger(PremiumBusinessSummaryService.name);

  constructor(
    private readonly llmRouter: LLMRouterService,
    private readonly industryDetector: IndustryDetectorService,
    private readonly entityExtractor: EntityExtractorService,
    private readonly schemaAuditor: SchemaAuditorService,
    private readonly diagnosticIntelligence: DiagnosticIntelligenceService,
  ) {}

  /**
   * Generate premium, entity-first business summary
   */
  async generatePremiumSummary(
    workspaceId: string,
    domain: string,
    brandName?: string
  ): Promise<PremiumBusinessSummary> {
    const missingData: string[] = [];
    const evidence: string[] = [];

    // 1. Detect industry (CRITICAL - foundation for all analysis)
    let industryContext: IndustryContext | null = null;
    try {
      industryContext = await this.industryDetector.getIndustryContext(workspaceId, domain);
      evidence.push(`Industry detected: ${industryContext.industry} (${industryContext.category})`);
    } catch (error) {
      this.logger.warn(`Industry detection failed: ${error instanceof Error ? error.message : String(error)}`);
      missingData.push('Industry detection unavailable');
    }

    // 2. Extract entity data
    let entityData: any = null;
    try {
      entityData = await this.entityExtractor.extractEntityFromDomain(workspaceId, domain);
      evidence.push(`Entity extraction completed: ${entityData.businessName || 'Unknown'}`);
    } catch (error) {
      this.logger.warn(`Entity extraction failed: ${error instanceof Error ? error.message : String(error)}`);
      missingData.push('Entity extraction unavailable');
    }

    // 3. Audit schema
    let schemaAudit: any = null;
    try {
      schemaAudit = await this.schemaAuditor.auditPage(domain);
      if (schemaAudit.schemaTypes && schemaAudit.schemaTypes.length > 0) {
        const schemaTypeNames = schemaAudit.schemaTypes.map((st: any) => typeof st === 'string' ? st : st.type).filter(Boolean);
        evidence.push(`Schema markup found: ${schemaTypeNames.join(', ')}`);
      } else {
        missingData.push('No schema.org markup found');
      }
    } catch (error) {
      missingData.push('Schema audit unavailable');
    }

    // 4. Generate comprehensive summary using LLM
    const summaryPrompt = `You are an expert business analyst. Generate a comprehensive, accurate business summary for analysis.

Domain: ${domain}
Brand: ${brandName || entityData?.businessName || 'Unknown'}
Industry: ${industryContext?.industry || 'Unknown'}
Category: ${industryContext?.category || 'Unknown'}
Vertical: ${industryContext?.vertical || 'Unknown'}
Market Type: ${industryContext?.marketType || 'Unknown'}
Service Type: ${industryContext?.serviceType || 'Unknown'}

Entity Data:
- Services: ${entityData?.services?.join(', ') || 'Not available'}
- Geography: ${entityData?.geography?.primary || 'Not available'}
- Value Props: ${entityData?.valueProps?.join(', ') || 'Not available'}
- Credibility: ${entityData?.credibilityMarkers?.join(', ') || 'Not available'}

Schema Signals: ${schemaAudit?.schemaTypes?.map((st: any) => typeof st === 'string' ? st : st.type).join(', ') || 'None'}

Generate a JSON response with:
{
  "summary": "2-3 paragraph LLM-optimized summary for AI search engines. Focus on what the business does, where it operates, key differentiators, value propositions, and trust factors. Write as if explaining to an AI engine.",
  "structuredSummary": {
    "what": "Clear description of what the business does",
    "where": "Geographic scope and service areas",
    "differentiation": "Key differentiators vs competitors",
    "valueProps": ["value prop 1", "value prop 2", "value prop 3"],
    "whyUsersChoose": "Why customers choose this business",
    "trustFactors": ["trust factor 1", "trust factor 2"],
    "redFlags": ["potential issue 1", "potential issue 2"] (if any),
    "category": "Business category",
    "intentClusters": ["intent 1", "intent 2", "intent 3"]
  },
  "aiEnginePerspective": {
    "howAIInterprets": "How AI engines likely interpret this business based on available signals",
    "keySignals": ["signal 1", "signal 2"],
    "missingSignals": ["missing signal 1", "missing signal 2"]
  },
  "marketPosition": {
    "position": "leader|challenger|niche|emerging|unknown",
    "reasoning": "Why this position",
    "confidence": 0.0-1.0
  },
  "confidence": 0.0-1.0,
  "missingData": ["missing data point 1", "missing data point 2"]
}

Be specific, accurate, and evidence-based. Avoid generic statements.`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, summaryPrompt, {
        temperature: 0.3,
        maxTokens: 1500,
      });

      const text = (response.content || response.text || '').trim();
      const cleaned = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);

      // Merge missing data
      if (parsed.missingData) {
        missingData.push(...parsed.missingData);
      }

      return {
        summary: parsed.summary || 'Business summary unavailable',
        structuredSummary: parsed.structuredSummary || {
          what: 'Unknown',
          where: 'Unknown',
          differentiation: 'Unknown',
          valueProps: [],
          whyUsersChoose: 'Unknown',
          trustFactors: [],
          category: industryContext?.category || 'Unknown',
          intentClusters: [],
        },
        aiEnginePerspective: parsed.aiEnginePerspective || {
          howAIInterprets: 'Unable to determine AI engine perspective',
          keySignals: [],
          missingSignals: [],
        },
        marketPosition: parsed.marketPosition || {
          position: 'unknown',
          reasoning: 'Insufficient data',
          confidence: 0.3,
        },
        confidence: parsed.confidence || 0.5,
        missingData,
        evidence,
      };
    } catch (error) {
      this.logger.error(`Premium summary generation failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Fallback to basic summary
      return {
        summary: entityData?.summary || `Summary for ${brandName || domain} in the ${industryContext?.industry || 'general'} industry.`,
        structuredSummary: {
          what: entityData?.structuredSummary?.what || 'Business description unavailable',
          where: entityData?.geography?.primary || 'Geographic scope unknown',
          differentiation: entityData?.structuredSummary?.differentiation || 'Differentiators unknown',
          valueProps: entityData?.valueProps || [],
          whyUsersChoose: entityData?.structuredSummary?.whyUsersChoose || 'Unknown',
          trustFactors: entityData?.credibilityMarkers || [],
          category: industryContext?.category || 'Unknown',
          intentClusters: [],
        },
        aiEnginePerspective: {
          howAIInterprets: 'Unable to determine - insufficient data',
          keySignals: [],
          missingSignals: ['Schema markup', 'Detailed business information'],
        },
        marketPosition: {
          position: 'unknown',
          reasoning: 'Insufficient data for market position analysis',
          confidence: 0.2,
        },
        confidence: 0.3,
        missingData: ['LLM summary generation failed', ...missingData],
        evidence,
      };
    }
  }

  /**
   * Generate diagnostic intelligence for business summary
   */
  async generateSummaryDiagnostics(
    workspaceId: string,
    summary: PremiumBusinessSummary,
    competitors?: any[],
    engines: string[] = ['PERPLEXITY', 'AIO', 'BRAVE']
  ): Promise<{
    insights: DiagnosticInsight[];
    strengths: DiagnosticInsight[];
    weaknesses: DiagnosticInsight[];
    risks: ThreatAssessment[];
    recommendations: DiagnosticRecommendation[];
    engineReasoning: EngineReasoning[];
  }> {
    // Generate insights
    const insights = await this.diagnosticIntelligence.generateInsights(workspaceId, {
      category: 'business_summary',
      data: summary,
      competitors,
      engines,
    });

    // Separate strengths and weaknesses
    const strengths = insights.filter(i => i.type === 'strength');
    const weaknesses = insights.filter(i => i.type === 'weakness');

    // Generate additional insights based on summary data
    const additionalInsights = this.generateSummarySpecificInsights(summary);
    insights.push(...additionalInsights);

    // Generate recommendations
    const recommendations = await this.diagnosticIntelligence.generateRecommendations(workspaceId, insights, {
      category: 'business_summary',
      currentScore: summary.confidence * 100,
      maxScore: 100,
    });

    // Generate engine reasoning
    const engineReasoningPromises = engines.map(engine =>
      this.diagnosticIntelligence.generateEngineReasoning(workspaceId, engine, {
        businessSummary: summary.summary,
        visibility: summary.confidence > 0.5,
        competitors,
      })
    );
    const engineReasoning = await Promise.all(engineReasoningPromises);

    // Generate threat assessments
    const risks = await this.diagnosticIntelligence.generateThreatAssessments(workspaceId, {
      competitors: competitors || [],
      visibility: { overallVisibility: summary.confidence * 100 },
      prompts: [],
      citations: [],
    });

    return {
      insights,
      strengths,
      weaknesses,
      risks,
      recommendations,
      engineReasoning,
    };
  }

  /**
   * Generate summary-specific insights
   */
  private generateSummarySpecificInsights(summary: PremiumBusinessSummary): DiagnosticInsight[] {
    const insights: DiagnosticInsight[] = [];

    // Check for missing signals
    if (summary.aiEnginePerspective.missingSignals.length > 0) {
      insights.push({
        type: 'weakness',
        category: 'positioning',
        title: 'Missing Key Signals',
        description: `AI engines are missing ${summary.aiEnginePerspective.missingSignals.length} key signals`,
        reasoning: 'Missing signals reduce AI engine understanding and visibility',
        impact: 'high',
        confidence: 0.9,
        evidence: summary.aiEnginePerspective.missingSignals,
      });
    }

    // Check for red flags
    if (summary.structuredSummary.redFlags && summary.structuredSummary.redFlags.length > 0) {
      insights.push({
        type: 'risk',
        category: 'trust',
        title: 'Potential Red Flags Detected',
        description: `${summary.structuredSummary.redFlags.length} potential issue(s) identified`,
        reasoning: 'Red flags may reduce trust signals and visibility',
        impact: 'medium',
        confidence: 0.8,
        evidence: summary.structuredSummary.redFlags,
      });
    }

    // Check market position
    if (summary.marketPosition.position === 'unknown' || summary.marketPosition.confidence < 0.5) {
      insights.push({
        type: 'weakness',
        category: 'positioning',
        title: 'Unclear Market Position',
        description: 'Market position is unclear or low confidence',
        reasoning: 'Unclear positioning makes it harder for AI engines to categorize and recommend',
        impact: 'medium',
        confidence: 0.7,
        evidence: [`Position: ${summary.marketPosition.position}`, `Confidence: ${(summary.marketPosition.confidence * 100).toFixed(0)}%`],
      });
    }

    // Check for strong positioning
    if (summary.marketPosition.position === 'leader' && summary.marketPosition.confidence > 0.7) {
      insights.push({
        type: 'strength',
        category: 'positioning',
        title: 'Strong Market Position',
        description: 'Business is positioned as a market leader',
        reasoning: 'Strong positioning improves AI engine recommendations',
        impact: 'high',
        confidence: summary.marketPosition.confidence,
        evidence: [summary.marketPosition.reasoning],
      });
    }

    // Check trust factors
    if (summary.structuredSummary.trustFactors.length >= 3) {
      insights.push({
        type: 'strength',
        category: 'trust',
        title: 'Strong Trust Signals',
        description: `Business has ${summary.structuredSummary.trustFactors.length} trust factors`,
        reasoning: 'Multiple trust factors improve EEAT scores and engine confidence',
        impact: 'high',
        confidence: 0.8,
        evidence: summary.structuredSummary.trustFactors,
      });
    }

    return insights;
  }
}


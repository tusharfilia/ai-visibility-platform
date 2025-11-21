import { Injectable, Logger } from '@nestjs/common';
import { LLMRouterService } from '@ai-visibility/shared';
import { IndustryDetectorService, IndustryContext } from '../industry/industry-detector.service';
import { EntityExtractorService } from '../entity/entity-extractor.service';
import { SchemaAuditorService } from '../structural/schema-auditor';

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
}


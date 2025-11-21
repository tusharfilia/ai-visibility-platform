import { Injectable, Logger } from '@nestjs/common';
import { LLMRouterService } from '@ai-visibility/shared';
import { SchemaAuditorService } from '../structural/schema-auditor';
import { PageStructureAnalyzerService } from '../structural/page-structure-analyzer';

export interface IndustryClassification {
  primaryIndustry: string; // e.g., "Vacation Rentals / OTA"
  secondaryIndustries: string[];
  naicsCode?: string;
  confidence: number; // 0-1
  evidence: {
    schemaSignals: string[];
    contentSignals: string[];
    competitorSignals: string[];
    llmClassification: string;
    metadataSignals: string[];
  };
  missingData: string[];
  reasoning: string;
}

export interface IndustryContext {
  industry: string;
  category: string;
  vertical: string;
  subcategory?: string;
  marketType: 'B2B' | 'B2C' | 'B2B2C' | 'Marketplace';
  serviceType: 'Product' | 'Service' | 'Platform' | 'Hybrid';
  geographicScope: 'Local' | 'Regional' | 'National' | 'Global';
}

@Injectable()
export class IndustryDetectorService {
  private readonly logger = new Logger(IndustryDetectorService.name);

  // NAICS-like industry mappings
  private readonly industryKeywords: Record<string, string[]> = {
    'Vacation Rentals / OTA': [
      'vacation rental', 'short-term rental', 'airbnb', 'vrbo', 'booking.com',
      'holiday rental', 'property management', 'host', 'guest', 'listing',
      'check-in', 'amenities', 'cancellation policy'
    ],
    'Dental Clinic': [
      'dentist', 'dental', 'orthodontist', 'oral surgery', 'teeth cleaning',
      'dental exam', 'root canal', 'crown', 'implant', 'braces', 'whitening'
    ],
    'Home Services / Roofing': [
      'roofing', 'roofer', 'shingle', 'gutter', 'siding', 'home repair',
      'contractor', 'installation', 'leak repair', 'roof replacement'
    ],
    'Fitness Studio': [
      'gym', 'fitness', 'yoga', 'pilates', 'crossfit', 'personal training',
      'workout', 'exercise', 'membership', 'class schedule', 'trainer'
    ],
    'SaaS CRM': [
      'crm', 'customer relationship', 'sales pipeline', 'lead management',
      'contact management', 'sales automation', 'deal tracking', 'salesforce'
    ],
    'B2B Payments': [
      'payment processing', 'invoice', 'billing', 'payment gateway',
      'merchant account', 'payment solution', 'transaction', 'payment api'
    ],
    'E-commerce / Retail': [
      'online store', 'shop', 'cart', 'checkout', 'product catalog',
      'inventory', 'shipping', 'returns', 'customer reviews'
    ],
    'Healthcare / Medical': [
      'doctor', 'physician', 'medical', 'clinic', 'hospital', 'patient',
      'appointment', 'treatment', 'diagnosis', 'prescription'
    ],
    'Legal Services': [
      'lawyer', 'attorney', 'legal', 'law firm', 'litigation', 'legal advice',
      'contract', 'legal consultation', 'court', 'case'
    ],
    'Real Estate': [
      'real estate', 'realtor', 'property', 'home for sale', 'listing',
      'mortgage', 'buyer', 'seller', 'open house', 'mls'
    ],
    'Restaurant / Food Service': [
      'restaurant', 'menu', 'dining', 'cuisine', 'reservation', 'catering',
      'delivery', 'takeout', 'chef', 'food', 'dinner', 'lunch'
    ],
    'Education / Training': [
      'course', 'training', 'education', 'learning', 'certification',
      'workshop', 'seminar', 'tutorial', 'instructor', 'student'
    ],
  };

  constructor(
    private readonly llmRouter: LLMRouterService,
    private readonly schemaAuditor: SchemaAuditorService,
    private readonly pageStructureAnalyzer: PageStructureAnalyzerService,
  ) {}

  /**
   * Detect industry with high confidence using multiple signals
   */
  async detectIndustry(
    workspaceId: string,
    domain: string,
    websiteContent?: {
      html?: string;
      title?: string;
      metaDescription?: string;
      headings?: string[];
      bodyText?: string;
    },
    competitorDomains?: string[]
  ): Promise<IndustryClassification> {
    const evidence = {
      schemaSignals: [] as string[],
      contentSignals: [] as string[],
      competitorSignals: [] as string[],
      llmClassification: '',
      metadataSignals: [] as string[],
    };

    const missingData: string[] = [];

    // 1. Schema-based detection
    try {
      const schemaAudit = await this.schemaAuditor.auditPage(workspaceId, domain);
      if (schemaAudit.schemaTypes && schemaAudit.schemaTypes.length > 0) {
        for (const schemaType of schemaAudit.schemaTypes) {
          if (schemaType === 'LocalBusiness') {
            evidence.schemaSignals.push('LocalBusiness schema found');
            // Try to extract business type from schema
            if (schemaAudit.schemas?.localBusiness) {
              const businessType = schemaAudit.schemas.localBusiness['@type'];
              if (businessType) {
                evidence.schemaSignals.push(`Business type: ${businessType}`);
              }
            }
          } else if (schemaType === 'Organization') {
            evidence.schemaSignals.push('Organization schema found');
          } else if (schemaType === 'Product') {
            evidence.schemaSignals.push('Product schema found');
          } else if (schemaType === 'Service') {
            evidence.schemaSignals.push('Service schema found');
          }
        }
      } else {
        missingData.push('No schema.org markup found');
      }
    } catch (error) {
      this.logger.warn(`Schema audit failed for industry detection: ${error instanceof Error ? error.message : String(error)}`);
      missingData.push('Schema audit unavailable');
    }

    // 2. Content-based keyword detection
    const allText = [
      websiteContent?.title || '',
      websiteContent?.metaDescription || '',
      ...(websiteContent?.headings || []),
      websiteContent?.bodyText || '',
    ].join(' ').toLowerCase();

    const industryScores: Record<string, number> = {};
    for (const [industry, keywords] of Object.entries(this.industryKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (allText.includes(keyword.toLowerCase())) {
          score += 1;
          evidence.contentSignals.push(`Found keyword "${keyword}" for ${industry}`);
        }
      }
      if (score > 0) {
        industryScores[industry] = score / keywords.length; // Normalize by keyword count
      }
    }

    // 3. Competitor-based detection
    if (competitorDomains && competitorDomains.length > 0) {
      // Analyze competitor domains for industry patterns
      for (const competitor of competitorDomains) {
        const competitorIndustry = await this.inferIndustryFromDomain(competitor);
        if (competitorIndustry) {
          evidence.competitorSignals.push(`${competitor} suggests ${competitorIndustry}`);
        }
      }
    }

    // 4. LLM-based classification (most reliable)
    let llmClassification = '';
    let llmConfidence = 0.5;
    try {
      const classificationPrompt = `You are an expert business classifier. Analyze the following business information and determine its PRIMARY industry.

Domain: ${domain}
Title: ${websiteContent?.title || 'Not available'}
Meta Description: ${websiteContent?.metaDescription || 'Not available'}
Key Headings: ${websiteContent?.headings?.slice(0, 10).join(', ') || 'Not available'}
Content Excerpt: ${websiteContent?.bodyText?.substring(0, 500) || 'Not available'}

Schema Signals: ${evidence.schemaSignals.join(', ') || 'None'}
Content Keywords Found: ${Object.keys(industryScores).join(', ') || 'None'}

Return a JSON object with:
{
  "primaryIndustry": "exact industry name (e.g., 'Vacation Rentals / OTA', 'Dental Clinic', 'SaaS CRM')",
  "category": "broad category (e.g., 'Travel', 'Healthcare', 'Technology')",
  "vertical": "specific vertical (e.g., 'Short-term Rentals', 'Dental Services', 'Sales Software')",
  "marketType": "B2B, B2C, B2B2C, or Marketplace",
  "serviceType": "Product, Service, Platform, or Hybrid",
  "geographicScope": "Local, Regional, National, or Global",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of why this industry was chosen",
  "alternativeIndustries": ["industry1", "industry2"]
}

Be specific and accurate. Use industry-standard terminology.`;

      const response = await this.llmRouter.routeLLMRequest(workspaceId, classificationPrompt, {
        temperature: 0.2,
        maxTokens: 500,
      });

      const text = (response.content || response.text || '').trim();
      const cleaned = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);

      llmClassification = parsed.primaryIndustry || '';
      llmConfidence = parsed.confidence || 0.5;
      evidence.llmClassification = parsed.reasoning || '';

      // Merge LLM results with keyword-based detection
      if (parsed.alternativeIndustries) {
        evidence.contentSignals.push(`LLM alternatives: ${parsed.alternativeIndustries.join(', ')}`);
      }
    } catch (error) {
      this.logger.warn(`LLM classification failed: ${error instanceof Error ? error.message : String(error)}`);
      missingData.push('LLM classification unavailable');
    }

    // 5. Metadata-based detection
    if (websiteContent?.title) {
      evidence.metadataSignals.push(`Title: ${websiteContent.title}`);
    }
    if (websiteContent?.metaDescription) {
      evidence.metadataSignals.push(`Meta: ${websiteContent.metaDescription}`);
    }

    // Determine final industry
    let primaryIndustry = llmClassification;
    let confidence = llmConfidence;

    // If LLM failed, use keyword-based detection
    if (!primaryIndustry || confidence < 0.3) {
      const sortedIndustries = Object.entries(industryScores)
        .sort(([, a], [, b]) => (b as number) - (a as number));
      
      if (sortedIndustries.length > 0 && sortedIndustries[0][1] > 0.1) {
        primaryIndustry = sortedIndustries[0][0];
        confidence = Math.min(0.8, sortedIndustries[0][1] as number);
      } else {
        primaryIndustry = 'General Business';
        confidence = 0.2;
        missingData.push('Insufficient signals for industry detection');
      }
    }

    // Build reasoning
    const reasoning = `Industry detected as "${primaryIndustry}" with ${(confidence * 100).toFixed(0)}% confidence. ` +
      `Evidence: ${evidence.schemaSignals.length} schema signals, ${evidence.contentSignals.length} content signals, ` +
      `${evidence.competitorSignals.length} competitor signals. ` +
      (evidence.llmClassification ? `LLM reasoning: ${evidence.llmClassification}` : 'LLM classification unavailable.');

    return {
      primaryIndustry,
      secondaryIndustries: Object.keys(industryScores)
        .filter(ind => ind !== primaryIndustry)
        .slice(0, 3),
      confidence,
      evidence,
      missingData,
      reasoning,
    };
  }

  /**
   * Infer industry from domain name (heuristic)
   */
  private async inferIndustryFromDomain(domain: string): Promise<string | null> {
    const domainLower = domain.toLowerCase();
    
    // Simple heuristics based on common domain patterns
    if (domainLower.includes('dental') || domainLower.includes('dentist')) {
      return 'Dental Clinic';
    }
    if (domainLower.includes('roof') || domainLower.includes('roofing')) {
      return 'Home Services / Roofing';
    }
    if (domainLower.includes('gym') || domainLower.includes('fitness')) {
      return 'Fitness Studio';
    }
    if (domainLower.includes('crm') || domainLower.includes('sales')) {
      return 'SaaS CRM';
    }
    if (domainLower.includes('payment') || domainLower.includes('pay')) {
      return 'B2B Payments';
    }
    if (domainLower.includes('rental') || domainLower.includes('booking')) {
      return 'Vacation Rentals / OTA';
    }

    return null;
  }

  /**
   * Get industry context for prompt generation and analysis
   */
  async getIndustryContext(
    workspaceId: string,
    domain: string,
    websiteContent?: {
      html?: string;
      title?: string;
      metaDescription?: string;
      headings?: string[];
      bodyText?: string;
    }
  ): Promise<IndustryContext> {
    const classification = await this.detectIndustry(workspaceId, domain, websiteContent);

    // Parse the primary industry to extract components
    const parts = classification.primaryIndustry.split(' / ');
    const industry = parts[0] || classification.primaryIndustry;
    const category = parts[1] || industry;

    return {
      industry: classification.primaryIndustry,
      category,
      vertical: classification.secondaryIndustries[0] || category,
      marketType: 'B2C', // Default, should be determined from LLM
      serviceType: 'Service', // Default, should be determined from LLM
      geographicScope: 'National', // Default, should be determined from LLM
    };
  }
}


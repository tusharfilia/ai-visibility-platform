import { Injectable, Logger } from '@nestjs/common';
import { LLMRouterService } from '@ai-visibility/shared';
import { SchemaAuditorService } from '../structural/schema-auditor';
import { PageStructureAnalyzerService } from '../structural/page-structure-analyzer';
import { FactExtractorService } from '../evidence/fact-extractor.service';

export interface BusinessEntity {
  businessName: string;
  domain: string;
  category: string;
  vertical: string;
  services: string[];
  geography: string;
  pricePositioning?: string;
  valueProps: string[];
  credibilityMarkers: string[];
  summary: string; // LLM-optimized summary for AI panels
  structuredSummary: Record<string, any>; // Detailed structured data
  metadata: {
    schemaTypes: string[];
    mainContentKeywords: string[];
    pageTitle: string;
    metaDescription: string;
  };
}

export interface EntityExtractionResult {
  businessName: string;
  category: string;
  vertical: string;
  services: string[];
  geography: {
    primary: string;
    serviceAreas: string[];
  };
  pricePositioning: 'premium' | 'mid-market' | 'budget';
  valueProps: string[];
  credibilityMarkers: string[];
  summary: string; // LLM-optimized paragraph
  structuredSummary: {
    what: string;
    where: string;
    differentiation: string;
    whyUsersChoose: string;
    trustFactors: string[];
    redFlags?: string[];
  };
  metadata: {
    schemaFound: boolean;
    schemaTypes: string[];
    pagesAnalyzed: string[];
    extractionConfidence: number;
  };
}

export interface WebsiteAnalysis {
  homepage: {
    html: string;
    title: string;
    metaDescription: string;
    headings: string[];
    keyContent: string;
  };
  aboutPage?: {
    html: string;
    content: string;
  };
  servicesPage?: {
    html: string;
    content: string;
  };
  schema: {
    organization?: any;
    localBusiness?: any;
    product?: any[];
    service?: any[];
    faq?: any[];
  };
}

@Injectable()
export class EntityExtractorService {
  private readonly logger = new Logger(EntityExtractorService.name);

  constructor(
    private readonly llmRouter: LLMRouterService,
    private readonly schemaAuditor: SchemaAuditorService,
    private readonly pageStructureAnalyzer: PageStructureAnalyzerService,
    private readonly factExtractor: FactExtractorService,
  ) {}

  /**
   * Extract comprehensive entity information from a domain
   * Uses existing services (SchemaAuditor, PageStructureAnalyzer, FactExtractor) for deep analysis
   */
  async extractEntityFromDomain(
    workspaceId: string,
    domain: string
  ): Promise<BusinessEntity> {
    this.logger.log(`Extracting entity for domain: ${domain}`);
    const url = `https://${domain}`; // Assume HTTPS for primary analysis

    let htmlContent: string | null = null;
    let schemaAuditResult;
    let structureAnalysis;
    let extractedFacts;

    try {
      // Step 1: Fetch HTML content (in parallel with other operations)
      htmlContent = await this.fetchPageContent(url);
    } catch (error) {
      this.logger.warn(`Failed to fetch HTML for ${domain}: ${error instanceof Error ? error.message : String(error)}`);
      // Continue without HTML content if fetch fails
    }

    // Step 2-4: Run analysis in parallel for performance
    const analysisPromises = [];
    
    if (htmlContent) {
      // Step 2: Audit Schema using existing service
      analysisPromises.push(
        this.schemaAuditor.auditPage(url).catch(error => {
          this.logger.warn(`Failed to audit schema for ${domain}: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        })
      );

      // Step 3: Analyze Page Structure using existing service
      analysisPromises.push(
        this.pageStructureAnalyzer.analyzeStructure(url).catch(error => {
          this.logger.warn(`Failed to analyze page structure for ${domain}: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        })
      );

      // Step 4: Extract facts from content using existing service
      analysisPromises.push(
        this.factExtractor.extractFacts(htmlContent, `entity-${domain}`, 'curated' as any).catch(error => {
          this.logger.warn(`Failed to extract facts from content for ${domain}: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        })
      );
    } else {
      // If no HTML, push nulls
      analysisPromises.push(Promise.resolve(null), Promise.resolve(null), Promise.resolve(null));
    }

    // Wait for all analysis to complete in parallel
    const [schemaResult, structureResult, factsResult] = await Promise.all(analysisPromises);
    schemaAuditResult = schemaResult;
    structureAnalysis = structureResult;
    extractedFacts = factsResult;

    // Step 5: Use LLM to synthesize information and infer missing details
    const llmPrompt = this.buildEntityExtractionPrompt(domain, htmlContent, schemaAuditResult, structureAnalysis, extractedFacts);
    let llmResponse;
    try {
      llmResponse = await this.llmRouter.routeLLMRequest(workspaceId, llmPrompt, {
        responseFormat: { type: 'json_object' },
        temperature: 0.3,
        maxTokens: 2000,
      });
    } catch (error) {
      this.logger.error(`LLM entity extraction failed for ${domain}: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`LLM entity extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const parsedResponse = this.parseLLMResponseEntity(llmResponse.text || llmResponse.content || '');

    // Combine all gathered information
    const businessEntity: BusinessEntity = {
      businessName: parsedResponse.businessName || this.deriveBrandFromDomain(domain),
      domain: domain,
      category: parsedResponse.category || 'Uncategorized',
      vertical: parsedResponse.vertical || 'General Business',
      services: parsedResponse.services || [],
      geography: parsedResponse.geography || 'Global',
      pricePositioning: parsedResponse.pricePositioning,
      valueProps: parsedResponse.valueProps || [],
      credibilityMarkers: parsedResponse.credibilityMarkers || [],
      summary: parsedResponse.summary || `A business operating at ${domain}.`,
      structuredSummary: parsedResponse.structuredSummary || {},
      metadata: {
        schemaTypes: schemaAuditResult?.schemaTypes?.map((s: any) => s.type || s['@type']).filter(Boolean) || [],
        mainContentKeywords: [], // Will be extracted from HTML if needed
        pageTitle: '', // Will be extracted from HTML if needed
        metaDescription: '', // Will be extracted from HTML if needed
      },
    };

    this.logger.log(`Successfully extracted entity for domain: ${domain}`);
    return businessEntity;
  }

  /**
   * Fetch page content with proper error handling
   */
  private async fetchPageContent(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GEOEntityExtractor/1.0)',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }
    return response.text();
  }

  /**
   * Build comprehensive entity extraction prompt
   */
  private buildEntityExtractionPrompt(
    domain: string,
    htmlContent: string | null,
    schemaAuditResult: any,
    structureAnalysis: any,
    extractedFacts: any,
  ): string {
    let prompt = `Analyze the following information about a business at the domain "${domain}".
Your goal is to infer a comprehensive, entity-first understanding of the business, suitable for an AI knowledge panel.
Provide the output in a JSON object with the following keys:
- businessName: string
- category: string (e.g., "Local Services", "E-commerce", "SaaS")
- vertical: string (e.g., "Plumbing", "Fashion Retail", "CRM Software")
- services: string[] (list of key services/products offered)
- geography: string (e.g., "New York City", "United States", "Global")
- pricePositioning: string (e.g., "Budget-friendly", "Mid-range", "Premium", "Luxury")
- valueProps: string[] (key differentiators and benefits)
- credibilityMarkers: string[] (e.g., "Certifications", "Awards", "Years in business", "Customer testimonials")
- summary: string (A concise, LLM-optimized paragraph summary for AI panels - 2-3 sentences covering: what the business does, where it operates, what differentiates it, why users choose it, trust factors)
- structuredSummary: object (Detailed structured data about the business, e.g., { "address": "...", "phone": "...", "what": "...", "where": "...", "differentiation": "...", "whyUsersChoose": "...", "trustFactors": [...] })

Prioritize information from schema markup and direct website content. If information is not explicitly available, infer it based on context and common patterns for businesses in similar categories. Avoid hallucination.

---
Domain: ${domain}
`;

    if (htmlContent) {
      prompt += `\nWebsite Content Snippet (first 2000 chars):\n${htmlContent.substring(0, 2000)}\n...`;
    }
    if (schemaAuditResult && schemaAuditResult.schemaTypes && schemaAuditResult.schemaTypes.length > 0) {
      prompt += `\nSchema Markup Found:\n${JSON.stringify(schemaAuditResult.schemaTypes, null, 2)}`;
      prompt += `\nSchema Coverage Score: ${schemaAuditResult.coverageScore || 0}/100`;
      prompt += `\nValid Schemas: ${schemaAuditResult.validSchemas || 0}`;
    }
    if (structureAnalysis) {
      prompt += `\nStructure Score: ${structureAnalysis.structureScore || 0}/100`;
      prompt += `\nHas TLDR: ${structureAnalysis.hasTLDR ? 'Yes' : 'No'}`;
      prompt += `\nHas Clear Headings: ${structureAnalysis.hasClearHeadings ? 'Yes' : 'No'}`;
      prompt += `\nHas External Citations: ${structureAnalysis.hasExternalCitations ? 'Yes' : 'No'}`;
      prompt += `\nHas Bullet Points: ${structureAnalysis.hasBulletPoints ? 'Yes' : 'No'}`;
      prompt += `\nWord Count: ${structureAnalysis.wordCount || 0}`;
      prompt += `\nHeading Count: ${structureAnalysis.headingCount || 0}`;
      prompt += `\nExternal Link Count: ${structureAnalysis.externalLinkCount || 0}`;
    }
    if (extractedFacts && Array.isArray(extractedFacts) && extractedFacts.length > 0) {
      prompt += `\nExtracted Facts:\n${extractedFacts.map((f: any) => `- ${f.type}: ${f.value} (confidence: ${f.confidence})`).join('\n')}`;
    }

    prompt += `\n---
Based on the above, provide the JSON output:`;
    return prompt;
  }

  /**
   * Parse LLM response for entity extraction
   */
  private parseLLMResponseEntity(llmText: string): Partial<BusinessEntity> {
    try {
      const cleaned = llmText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);
      // Basic validation and type conversion
      return {
        businessName: typeof parsed.businessName === 'string' ? parsed.businessName : undefined,
        category: typeof parsed.category === 'string' ? parsed.category : undefined,
        vertical: typeof parsed.vertical === 'string' ? parsed.vertical : undefined,
        services: Array.isArray(parsed.services) ? parsed.services.filter(s => typeof s === 'string') : undefined,
        geography: typeof parsed.geography === 'string' ? parsed.geography : undefined,
        pricePositioning: typeof parsed.pricePositioning === 'string' ? parsed.pricePositioning : undefined,
        valueProps: Array.isArray(parsed.valueProps) ? parsed.valueProps.filter(s => typeof s === 'string') : undefined,
        credibilityMarkers: Array.isArray(parsed.credibilityMarkers) ? parsed.credibilityMarkers.filter(s => typeof s === 'string') : undefined,
        summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
        structuredSummary: typeof parsed.structuredSummary === 'object' && parsed.structuredSummary !== null ? parsed.structuredSummary : undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to parse LLM entity extraction response: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
  }

  /**
   * Derive brand name from domain
   */
  private deriveBrandFromDomain(domain: string): string {
    const parts = domain.split('.');
    if (parts.length > 1) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return domain;
  }

  /**
   * Analyze website structure by fetching key pages
   */
  async analyzeWebsiteStructure(domain: string): Promise<WebsiteAnalysis> {
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    
    // Fetch homepage
    const homepage = await this.fetchAndParsePage(baseUrl);
    
    // Try to fetch about and services pages
    const aboutPage = await this.tryFetchPage(baseUrl, ['/about', '/about-us', '/company']);
    const servicesPage = await this.tryFetchPage(baseUrl, ['/services', '/products', '/solutions']);
    
    // Extract schema from all pages
    const allSchemas = [
      ...this.parseJsonLd(homepage.html),
      ...(aboutPage ? this.parseJsonLd(aboutPage.html) : []),
      ...(servicesPage ? this.parseJsonLd(servicesPage.html) : []),
    ];
    
    const schema = this.organizeSchemas(allSchemas);
    
    return {
      homepage: {
        html: homepage.html,
        title: homepage.title,
        metaDescription: homepage.metaDescription,
        headings: homepage.headings,
        keyContent: homepage.keyContent,
      },
      aboutPage: aboutPage ? {
        html: aboutPage.html,
        content: aboutPage.content,
      } : undefined,
      servicesPage: servicesPage ? {
        html: servicesPage.html,
        content: servicesPage.content,
      } : undefined,
      schema,
    };
  }

  /**
   * Extract and organize schema.org data
   */
  extractSchemaData(analysis: WebsiteAnalysis): any {
    return analysis.schema;
  }

  /**
   * Infer business category from website content and schema
   */
  async inferBusinessCategory(
    workspaceId: string,
    analysis: WebsiteAnalysis,
    schema: any
  ): Promise<{ category: string; vertical: string }> {
    // Try to extract from schema first
    if (schema.organization?.industry || schema.localBusiness?.industry) {
      const industry = schema.organization?.industry || schema.localBusiness?.industry;
      return {
        category: this.normalizeCategory(industry),
        vertical: this.inferVertical(industry),
      };
    }
    
    // Use LLM to infer from content
    const content = [
      analysis.homepage.title,
      analysis.homepage.metaDescription,
      ...analysis.homepage.headings.slice(0, 5),
      analysis.homepage.keyContent.substring(0, 500),
    ].join('\n');
    
    const prompt = `Analyze this business website content and determine:
1. Primary business category (e.g., "SaaS", "E-commerce", "Professional Services", "Healthcare", "Finance")
2. Vertical/industry (e.g., "B2B Software", "Retail", "Legal", "Medical", "Banking")

Website content:
${content}

Return JSON: {"category": "string", "vertical": "string"}`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt, {
        temperature: 0.2,
        maxTokens: 200,
      });
      
      const text = (response.content || response.text || '').trim();
      const parsed = JSON.parse(text);
      return {
        category: parsed.category || 'General Business',
        vertical: parsed.vertical || 'General',
      };
    } catch (error) {
      console.warn('Category inference failed, using defaults:', error);
      return {
        category: 'General Business',
        vertical: 'General',
      };
    }
  }

  /**
   * Generate comprehensive entity extraction using LLM
   */
  private async generateEntityExtraction(
    workspaceId: string,
    domain: string,
    analysis: WebsiteAnalysis,
    schema: any,
    categoryInfo: { category: string; vertical: string }
  ): Promise<Omit<EntityExtractionResult, 'metadata'>> {
    // Build comprehensive context
    const context = this.buildExtractionContext(domain, analysis, schema, categoryInfo);
    
    const prompt = `You are an expert business analyst extracting comprehensive entity information for Generative Engine Optimization (GEO).

Analyze the following business website and extract ALL entity information. Your output will be used to help AI engines understand this business.

Domain: ${domain}
Category: ${categoryInfo.category}
Vertical: ${categoryInfo.vertical}

Website Content:
${context}

Schema.org Data:
${JSON.stringify(schema, null, 2)}

Extract and return a JSON object with this exact structure:
{
  "businessName": "Official business name",
  "category": "${categoryInfo.category}",
  "vertical": "${categoryInfo.vertical}",
  "services": ["service1", "service2", ...],
  "geography": {
    "primary": "Primary location (city, state/country)",
    "serviceAreas": ["area1", "area2", ...]
  },
  "pricePositioning": "premium" | "mid-market" | "budget",
  "valueProps": ["value prop 1", "value prop 2", ...],
  "credibilityMarkers": ["marker1", "marker2", ...],
  "summary": "A 2-3 sentence LLM-optimized summary that AI engines would use in knowledge panels. Be precise, structured, entity-focused. Include: what the business does, where it operates, what differentiates it, why users choose it, trust factors.",
  "structuredSummary": {
    "what": "What the business does (1-2 sentences)",
    "where": "Where it operates (geography, service areas)",
    "differentiation": "What makes it unique or different from competitors",
    "whyUsersChoose": "Why customers/users choose this business",
    "trustFactors": ["factor1", "factor2", ...],
    "redFlags": ["any inconsistencies or concerns", ...] // Optional, only if found
  }
}

IMPORTANT:
- Be evidence-based: Only extract facts that are clearly stated in the content
- No hallucinations: If information is missing, use empty arrays or "Unknown"
- Be specific: Use actual business details, not generic descriptions
- Trust factors: Look for reviews, certifications, awards, years in business, customer count
- Red flags: Only include if you find actual inconsistencies (e.g., conflicting addresses, missing contact info)`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt, {
        temperature: 0.3,
        maxTokens: 2000,
      });
      
      const text = (response.content || response.text || '').trim();
      // Clean up JSON if wrapped in markdown code blocks
      const cleaned = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned);
      
      // Validate and normalize
      return {
        businessName: parsed.businessName || this.deriveBusinessName(domain),
        category: parsed.category || categoryInfo.category,
        vertical: parsed.vertical || categoryInfo.vertical,
        services: Array.isArray(parsed.services) ? parsed.services : [],
        geography: {
          primary: parsed.geography?.primary || 'Unknown',
          serviceAreas: Array.isArray(parsed.geography?.serviceAreas) 
            ? parsed.geography.serviceAreas 
            : [],
        },
        pricePositioning: ['premium', 'mid-market', 'budget'].includes(parsed.pricePositioning)
          ? parsed.pricePositioning
          : 'mid-market',
        valueProps: Array.isArray(parsed.valueProps) ? parsed.valueProps : [],
        credibilityMarkers: Array.isArray(parsed.credibilityMarkers) ? parsed.credibilityMarkers : [],
        summary: parsed.summary || this.generateFallbackSummary(domain, categoryInfo),
        structuredSummary: {
          what: parsed.structuredSummary?.what || 'Business information not available',
          where: parsed.structuredSummary?.where || 'Location information not available',
          differentiation: parsed.structuredSummary?.differentiation || 'Differentiation not specified',
          whyUsersChoose: parsed.structuredSummary?.whyUsersChoose || 'Value proposition not specified',
          trustFactors: Array.isArray(parsed.structuredSummary?.trustFactors)
            ? parsed.structuredSummary.trustFactors
            : [],
          redFlags: Array.isArray(parsed.structuredSummary?.redFlags)
            ? parsed.structuredSummary.redFlags
            : undefined,
        },
      };
    } catch (error) {
      console.warn('Entity extraction failed, using fallback:', error);
      return this.generateFallbackEntity(domain, categoryInfo);
    }
  }

  /**
   * Build extraction context from website analysis
   */
  private buildExtractionContext(
    domain: string,
    analysis: WebsiteAnalysis,
    schema: any,
    categoryInfo: { category: string; vertical: string }
  ): string {
    const parts: string[] = [];
    
    parts.push(`Homepage Title: ${analysis.homepage.title}`);
    parts.push(`Meta Description: ${analysis.homepage.metaDescription}`);
    parts.push(`Headings: ${analysis.homepage.headings.join(', ')}`);
    parts.push(`Key Content: ${analysis.homepage.keyContent.substring(0, 1000)}`);
    
    if (analysis.aboutPage) {
      parts.push(`About Page: ${analysis.aboutPage.content.substring(0, 500)}`);
    }
    
    if (analysis.servicesPage) {
      parts.push(`Services Page: ${analysis.servicesPage.content.substring(0, 500)}`);
    }
    
    return parts.join('\n\n');
  }

  /**
   * Fetch and parse a page
   */
  private async fetchAndParsePage(url: string): Promise<{
    html: string;
    title: string;
    metaDescription: string;
    headings: string[];
    keyContent: string;
  }> {
    try {
      const html = await this.fetchPage(url);
      return {
        html,
        title: this.extractTitle(html),
        metaDescription: this.extractMetaDescription(html),
        headings: this.extractHeadings(html),
        keyContent: this.extractKeyContent(html),
      };
    } catch (error) {
      console.warn(`Failed to fetch ${url}:`, error);
      return {
        html: '',
        title: '',
        metaDescription: '',
        headings: [],
        keyContent: '',
      };
    }
  }

  /**
   * Try to fetch a page from multiple possible paths
   */
  private async tryFetchPage(baseUrl: string, paths: string[]): Promise<{ html: string; content: string } | null> {
    for (const path of paths) {
      try {
        const url = `${baseUrl}${path}`;
        const html = await this.fetchPage(url);
        if (html && html.length > 100) {
          return {
            html,
            content: this.extractKeyContent(html),
          };
        }
      } catch (error) {
        // Try next path
        continue;
      }
    }
    return null;
  }

  /**
   * Fetch page HTML
   */
  private async fetchPage(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GEOEntityExtractor/1.0)',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Parse JSON-LD scripts from HTML
   */
  private parseJsonLd(html: string): any[] {
    const schemas: any[] = [];
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
    
    let match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const json = JSON.parse(match[1]);
        if (json['@type'] || json['@graph']) {
          if (json['@graph']) {
            schemas.push(...json['@graph']);
          } else {
            schemas.push(json);
          }
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }

    return schemas;
  }

  /**
   * Organize schemas by type
   */
  private organizeSchemas(schemas: any[]): any {
    const organized: any = {};
    
    for (const schema of schemas) {
      const type = schema['@type'] || '';
      
      if (type.includes('Organization')) {
        organized.organization = schema;
      } else if (type.includes('LocalBusiness')) {
        organized.localBusiness = schema;
      } else if (type.includes('Product')) {
        if (!organized.product) organized.product = [];
        organized.product.push(schema);
      } else if (type.includes('Service')) {
        if (!organized.service) organized.service = [];
        organized.service.push(schema);
      } else if (type.includes('FAQPage') || type.includes('Question')) {
        if (!organized.faq) organized.faq = [];
        organized.faq.push(schema);
      }
    }
    
    return organized;
  }

  /**
   * Extract title from HTML
   */
  private extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : '';
  }

  /**
   * Extract meta description from HTML
   */
  private extractMetaDescription(html: string): string {
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    return metaMatch ? metaMatch[1].trim() : '';
  }

  /**
   * Extract headings from HTML
   */
  private extractHeadings(html: string): string[] {
    const headings: string[] = [];
    const h1Matches = html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gi);
    const h2Matches = html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gi);
    
    for (const match of h1Matches) {
      const text = this.stripHtml(match[1]);
      if (text) headings.push(text);
    }
    
    for (const match of h2Matches) {
      const text = this.stripHtml(match[1]);
      if (text && headings.length < 10) headings.push(text);
    }
    
    return headings;
  }

  /**
   * Extract key content from HTML
   */
  private extractKeyContent(html: string): string {
    // Remove script and style tags
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Extract text from paragraphs and divs
    const paragraphs = text.match(/<p[^>]*>(.*?)<\/p>/gi) || [];
    const divs = text.match(/<div[^>]*>(.*?)<\/div>/gi) || [];
    
    const content = [...paragraphs, ...divs]
      .map(tag => this.stripHtml(tag))
      .filter(text => text.length > 20)
      .slice(0, 10)
      .join(' ');
    
    return content.substring(0, 2000);
  }

  /**
   * Strip HTML tags
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize domain
   */
  private normalizeDomain(domain: string): string {
    try {
      const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
      return url.origin;
    } catch {
      return domain.startsWith('http') ? domain : `https://${domain}`;
    }
  }

  /**
   * Derive business name from domain
   */
  private deriveBusinessName(domain: string): string {
    try {
      const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
      const hostname = url.hostname.replace(/^www\./, '');
      const parts = hostname.split('.');
      const primary = parts[0];
      return primary.charAt(0).toUpperCase() + primary.slice(1);
    } catch {
      return 'Business';
    }
  }

  /**
   * Normalize category
   */
  private normalizeCategory(category: string): string {
    if (!category) return 'General Business';
    return category.trim();
  }

  /**
   * Infer vertical from category
   */
  private inferVertical(category: string): string {
    // Simple mapping - can be enhanced
    const mappings: Record<string, string> = {
      'SaaS': 'B2B Software',
      'E-commerce': 'Retail',
      'Professional Services': 'Services',
      'Healthcare': 'Medical',
      'Finance': 'Financial Services',
    };
    
    return mappings[category] || category || 'General';
  }

  /**
   * Extract schema types
   */
  private extractSchemaTypes(schema: any): string[] {
    const types: string[] = [];
    if (schema.organization) types.push('Organization');
    if (schema.localBusiness) types.push('LocalBusiness');
    if (schema.product) types.push('Product');
    if (schema.service) types.push('Service');
    if (schema.faq) types.push('FAQPage');
    return types;
  }

  /**
   * Get analyzed pages
   */
  private getAnalyzedPages(analysis: WebsiteAnalysis): string[] {
    const pages: string[] = ['homepage'];
    if (analysis.aboutPage) pages.push('about');
    if (analysis.servicesPage) pages.push('services');
    return pages;
  }

  /**
   * Calculate extraction confidence
   */
  private calculateConfidence(analysis: WebsiteAnalysis, schema: any): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on available data
    if (analysis.homepage.title) confidence += 0.1;
    if (analysis.homepage.metaDescription) confidence += 0.1;
    if (analysis.homepage.keyContent.length > 200) confidence += 0.1;
    if (analysis.aboutPage) confidence += 0.1;
    if (analysis.servicesPage) confidence += 0.1;
    if (Object.keys(schema).length > 0) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  /**
   * Generate fallback summary
   */
  private generateFallbackSummary(domain: string, categoryInfo: { category: string; vertical: string }): string {
    return `${this.deriveBusinessName(domain)} is a ${categoryInfo.category} business operating in the ${categoryInfo.vertical} vertical.`;
  }

  /**
   * Generate fallback entity data
   */
  private generateFallbackEntity(
    domain: string,
    categoryInfo: { category: string; vertical: string }
  ): Omit<EntityExtractionResult, 'metadata'> {
    const businessName = this.deriveBusinessName(domain);
    
    return {
      businessName,
      category: categoryInfo.category,
      vertical: categoryInfo.vertical,
      services: [],
      geography: {
        primary: 'Unknown',
        serviceAreas: [],
      },
      pricePositioning: 'mid-market',
      valueProps: [],
      credibilityMarkers: [],
      summary: this.generateFallbackSummary(domain, categoryInfo),
      structuredSummary: {
        what: `${businessName} operates in the ${categoryInfo.category} space.`,
        where: 'Location information not available',
        differentiation: 'Differentiation not specified',
        whyUsersChoose: 'Value proposition not specified',
        trustFactors: [],
      },
    };
  }
}


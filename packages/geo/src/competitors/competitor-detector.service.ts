import { Injectable } from '@nestjs/common';
import { LLMRouterService } from '@ai-visibility/shared';

export interface CompetitorInfo {
  domain: string;
  name: string;
  category?: string;
  geography?: string;
  type: 'direct' | 'content' | 'authority' | 'geo';
  confidence: number;
  evidence: string[];
}

export interface CompetitorDetectionResult {
  direct: CompetitorInfo[];
  content: CompetitorInfo[];
  authority: CompetitorInfo[];
  geo: CompetitorInfo[];
  all: CompetitorInfo[]; // Combined and deduplicated
}

export interface CompetitorDetectionContext {
  brandName: string;
  domain: string;
  category: string;
  vertical: string;
  geography?: {
    primary: string;
    serviceAreas: string[];
  };
  services: string[];
  pricePositioning?: 'premium' | 'mid-market' | 'budget';
  summary?: string;
  promptTexts?: string[];
  existingMentions?: Array<{ brand: string; domain?: string }>; // From AI answers
  citationDomains?: string[]; // Domains that appear in citations
}

@Injectable()
export class CompetitorDetectorService {
  constructor(private readonly llmRouter: LLMRouterService) {}

  /**
   * Detect competitors from multiple sources
   */
  async detectCompetitors(
    workspaceId: string,
    context: CompetitorDetectionContext
  ): Promise<CompetitorDetectionResult> {
    // Run all detection methods in parallel
    const [direct, content, authority, geo] = await Promise.all([
      this.detectDirectCompetitors(workspaceId, context),
      this.detectContentCompetitors(workspaceId, context),
      this.detectAuthorityCompetitors(workspaceId, context),
      this.detectGEOCompetitors(workspaceId, context),
    ]);

    // Combine and deduplicate
    const all = this.combineAndDeduplicate([...direct, ...content, ...authority, ...geo]);

    return {
      direct,
      content,
      authority,
      geo,
      all,
    };
  }

  /**
   * Detect direct competitors: same category, geography, similar pricing
   */
  async detectDirectCompetitors(
    workspaceId: string,
    context: CompetitorDetectionContext
  ): Promise<CompetitorInfo[]> {
    const prompt = `You are analyzing the competitive landscape for ${context.brandName}.

Business Context:
- Category: ${context.category}
- Vertical: ${context.vertical}
- Geography: ${context.geography?.primary || 'Unknown'}
- Service Areas: ${context.geography?.serviceAreas?.join(', ') || 'Unknown'}
- Services: ${context.services.join(', ') || 'Not specified'}
- Price Positioning: ${context.pricePositioning || 'Unknown'}
- Summary: ${context.summary || 'Not available'}

Identify 3-6 DIRECT competitors that:
1. Operate in the same category/vertical
2. Serve the same or overlapping geography
3. Offer similar services/products
4. Target similar customer segments
5. Have similar price positioning

Return a JSON array of competitor objects with this structure:
[
  {
    "domain": "competitor.com",
    "name": "Competitor Name",
    "category": "Category",
    "geography": "Primary location",
    "confidence": 0.9
  }
]

IMPORTANT:
- Only include real, verifiable competitors
- Use actual domain names (e.g., "stripe.com", not "Stripe")
- Confidence should reflect how certain you are (0.7-1.0)
- Focus on businesses that directly compete for the same customers`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt, {
        temperature: 0.2,
        maxTokens: 1000,
      });

      const text = (response.content || response.text || '').trim();
      const cleaned = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned) as any[];

      return parsed
        .filter(c => c.domain && c.name)
        .map(c => ({
          domain: this.normalizeDomain(c.domain),
          name: c.name,
          category: c.category || context.category,
          geography: c.geography || context.geography?.primary,
          type: 'direct' as const,
          confidence: Math.min(1.0, Math.max(0.5, c.confidence || 0.8)),
          evidence: [
            `Same category: ${c.category || context.category}`,
            `Similar geography: ${c.geography || context.geography?.primary}`,
            `Similar services: ${context.services.join(', ')}`,
          ],
        }));
    } catch (error) {
      console.warn('Direct competitor detection failed:', error);
      return [];
    }
  }

  /**
   * Detect content competitors: compete for same search queries
   */
  async detectContentCompetitors(
    workspaceId: string,
    context: CompetitorDetectionContext
  ): Promise<CompetitorInfo[]> {
    if (!context.promptTexts || context.promptTexts.length === 0) {
      return [];
    }

    const prompt = `Analyze these search queries and identify businesses that would compete for the same search results:

Queries:
${context.promptTexts.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Business Context:
- Brand: ${context.brandName}
- Category: ${context.category}
- Domain: ${context.domain}

Identify 3-5 CONTENT competitors that:
1. Would appear in search results for these same queries
2. Target similar keywords/content
3. Compete for organic/search visibility on these topics

Return a JSON array:
[
  {
    "domain": "competitor.com",
    "name": "Competitor Name",
    "overlappingQueries": ["query1", "query2"],
    "confidence": 0.8
  }
]`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt, {
        temperature: 0.3,
        maxTokens: 800,
      });

      const text = (response.content || response.text || '').trim();
      const cleaned = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned) as any[];

      return parsed
        .filter(c => c.domain && c.name)
        .map(c => ({
          domain: this.normalizeDomain(c.domain),
          name: c.name,
          type: 'content' as const,
          confidence: Math.min(1.0, Math.max(0.5, c.confidence || 0.7)),
          evidence: [
            `Overlapping queries: ${(c.overlappingQueries || []).join(', ')}`,
            `Content competition for: ${context.category}`,
          ],
        }));
    } catch (error) {
      console.warn('Content competitor detection failed:', error);
      return [];
    }
  }

  /**
   * Detect authority competitors: similar domain authority, citation patterns
   */
  async detectAuthorityCompetitors(
    workspaceId: string,
    context: CompetitorDetectionContext
  ): Promise<CompetitorInfo[]> {
    // Use citation domains as a signal
    const citationDomains = context.citationDomains || [];
    
    if (citationDomains.length === 0) {
      // Fallback to LLM-based detection
      return this.detectAuthorityCompetitorsLLM(workspaceId, context);
    }

    // Analyze citation patterns to find authority competitors
    const prompt = `Analyze these domains that appear in citations and identify which are likely competitors based on authority and citation patterns:

Citation Domains:
${citationDomains.slice(0, 20).map((d, i) => `${i + 1}. ${d}`).join('\n')}

Business Context:
- Brand: ${context.brandName}
- Category: ${context.category}
- Domain: ${context.domain}

Identify 3-5 AUTHORITY competitors that:
1. Have similar domain authority/trust
2. Appear in similar citation contexts
3. Are recognized as authoritative sources in this category
4. Compete for citation/reference opportunities

Return a JSON array:
[
  {
    "domain": "competitor.com",
    "name": "Competitor Name",
    "authorityScore": 85,
    "citationCount": 10,
    "confidence": 0.8
  }
]`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt, {
        temperature: 0.2,
        maxTokens: 800,
      });

      const text = (response.content || response.text || '').trim();
      const cleaned = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned) as any[];

      return parsed
        .filter(c => c.domain && c.name)
        .map(c => ({
          domain: this.normalizeDomain(c.domain),
          name: c.name,
          type: 'authority' as const,
          confidence: Math.min(1.0, Math.max(0.5, c.confidence || 0.7)),
          evidence: [
            `Similar authority level (score: ${c.authorityScore || 'unknown'})`,
            `Citation count: ${c.citationCount || 'unknown'}`,
            `Appears in citation patterns for ${context.category}`,
          ],
        }));
    } catch (error) {
      console.warn('Authority competitor detection failed:', error);
      return [];
    }
  }

  /**
   * Fallback LLM-based authority competitor detection
   */
  private async detectAuthorityCompetitorsLLM(
    workspaceId: string,
    context: CompetitorDetectionContext
  ): Promise<CompetitorInfo[]> {
    const prompt = `Identify 3-5 AUTHORITY competitors for ${context.brandName} in the ${context.category} category.

These should be businesses that:
1. Have established domain authority
2. Are frequently cited as references
3. Compete for citation opportunities
4. Are recognized as thought leaders

Return JSON array with domain, name, and confidence.`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt, {
        temperature: 0.3,
        maxTokens: 600,
      });

      const text = (response.content || response.text || '').trim();
      const cleaned = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned) as any[];

      return parsed
        .filter(c => c.domain && c.name)
        .map(c => ({
          domain: this.normalizeDomain(c.domain),
          name: c.name,
          type: 'authority' as const,
          confidence: Math.min(1.0, Math.max(0.5, c.confidence || 0.7)),
          evidence: [`Authority competitor in ${context.category}`],
        }));
    } catch (error) {
      console.warn('LLM authority competitor detection failed:', error);
      return [];
    }
  }

  /**
   * Detect GEO competitors: appear in same AI answers
   */
  async detectGEOCompetitors(
    workspaceId: string,
    context: CompetitorDetectionContext
  ): Promise<CompetitorInfo[]> {
    // Use existing mentions from AI answers
    const mentions = context.existingMentions || [];
    
    if (mentions.length === 0) {
      // If no mentions yet, use LLM to predict which competitors would co-appear
      return this.predictGEOCompetitors(workspaceId, context);
    }

    // Extract competitors from mentions
    const competitorMap = new Map<string, { brand: string; domain?: string; count: number }>();
    
    for (const mention of mentions) {
      if (mention.brand.toLowerCase() !== context.brandName.toLowerCase()) {
        const key = mention.domain || mention.brand.toLowerCase();
        const existing = competitorMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          competitorMap.set(key, {
            brand: mention.brand,
            domain: mention.domain,
            count: 1,
          });
        }
      }
    }

    // Convert to CompetitorInfo
    const competitors: CompetitorInfo[] = [];
    for (const [key, data] of competitorMap.entries()) {
      if (data.count >= 2) { // Only include if mentioned multiple times
        competitors.push({
          domain: data.domain || this.deriveDomainFromBrand(data.brand),
          name: data.brand,
          type: 'geo',
          confidence: Math.min(1.0, 0.6 + (data.count * 0.1)), // Higher confidence for more mentions
          evidence: [
            `Co-mentioned in ${data.count} AI answers`,
            `Appears alongside ${context.brandName} in search results`,
          ],
        });
      }
    }

    return competitors;
  }

  /**
   * Predict which competitors would co-appear in AI answers
   */
  private async predictGEOCompetitors(
    workspaceId: string,
    context: CompetitorDetectionContext
  ): Promise<CompetitorInfo[]> {
    const prompt = `Predict which competitors would co-appear with ${context.brandName} in AI-generated search answers.

Business Context:
- Brand: ${context.brandName}
- Category: ${context.category}
- Domain: ${context.domain}
- Summary: ${context.summary || 'Not available'}

Identify 3-5 GEO competitors that:
1. Would be mentioned in the same AI answers
2. Are commonly compared together
3. Appear in "best X" or "X vs Y" type queries
4. Are top-of-mind alternatives

Return JSON array with domain, name, and confidence.`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt, {
        temperature: 0.3,
        maxTokens: 600,
      });

      const text = (response.content || response.text || '').trim();
      const cleaned = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleaned) as any[];

      return parsed
        .filter(c => c.domain && c.name)
        .map(c => ({
          domain: this.normalizeDomain(c.domain),
          name: c.name,
          type: 'geo' as const,
          confidence: Math.min(1.0, Math.max(0.5, c.confidence || 0.7)),
          evidence: [
            `Predicted co-appearance with ${context.brandName} in AI answers`,
            `Common comparison target in ${context.category}`,
          ],
        }));
    } catch (error) {
      console.warn('GEO competitor prediction failed:', error);
      return [];
    }
  }

  /**
   * Combine and deduplicate competitors
   */
  private combineAndDeduplicate(competitors: CompetitorInfo[]): CompetitorInfo[] {
    const domainMap = new Map<string, CompetitorInfo>();

    for (const competitor of competitors) {
      const normalizedDomain = this.normalizeDomain(competitor.domain);
      const existing = domainMap.get(normalizedDomain);

      if (!existing) {
        domainMap.set(normalizedDomain, competitor);
      } else {
        // Merge: keep highest confidence, combine types, merge evidence
        const merged: CompetitorInfo = {
          ...existing,
          confidence: Math.max(existing.confidence, competitor.confidence),
          type: existing.type, // Keep first type, or could combine
          evidence: [...new Set([...existing.evidence, ...competitor.evidence])],
        };
        domainMap.set(normalizedDomain, merged);
      }
    }

    return Array.from(domainMap.values()).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Categorize competitors by type
   */
  categorizeCompetitors(competitors: CompetitorInfo[]): {
    direct: CompetitorInfo[];
    content: CompetitorInfo[];
    authority: CompetitorInfo[];
    geo: CompetitorInfo[];
  } {
    return {
      direct: competitors.filter(c => c.type === 'direct'),
      content: competitors.filter(c => c.type === 'content'),
      authority: competitors.filter(c => c.type === 'authority'),
      geo: competitors.filter(c => c.type === 'geo'),
    };
  }

  /**
   * Normalize domain
   */
  private normalizeDomain(domain: string): string {
    try {
      const url = new URL(domain.startsWith('http') ? domain : `https://${domain}`);
      return url.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return domain.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase().split('/')[0];
    }
  }

  /**
   * Derive domain from brand name (fallback)
   */
  private deriveDomainFromBrand(brand: string): string {
    // Simple heuristic - in production, might use a domain lookup service
    const cleaned = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${cleaned}.com`;
  }
}


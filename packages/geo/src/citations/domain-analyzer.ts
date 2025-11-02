import { Injectable } from '@nestjs/common';

export interface DomainMetrics {
  domain: string;
  authority: number;
  trustScore: number;
  backlinks: number;
  referringDomains: number;
  organicTraffic: number;
  socialSignals: number;
  lastUpdated: Date;
}

export interface AuthorityFactors {
  backlinkQuality: number;
  domainAge: number;
  contentQuality: number;
  technicalSEO: number;
  socialSignals: number;
  brandMentions: number;
}

@Injectable()
export class DomainAnalyzerService {
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private authorityCache = new Map<string, { metrics: DomainMetrics; timestamp: number }>();

  /**
   * Calculate domain authority score (0-100)
   */
  async calculateAuthority(domain: string): Promise<number> {
    try {
      // Check cache first
      const cached = this.getCachedAuthority(domain);
      if (cached) {
        return cached.authority;
      }

      // Calculate authority using multiple factors
      const factors = await this.analyzeAuthorityFactors(domain);
      const authority = this.calculateAuthorityScore(factors);

      // Cache the result
      const metrics: DomainMetrics = {
        domain,
        authority,
        trustScore: factors.contentQuality,
        backlinks: Math.floor(factors.backlinkQuality * 1000),
        referringDomains: Math.floor(factors.backlinkQuality * 100),
        organicTraffic: Math.floor(factors.contentQuality * 10000),
        socialSignals: factors.socialSignals,
        lastUpdated: new Date()
      };

      this.cacheAuthority(domain, metrics);

      return authority;
    } catch (error) {
      console.error(`Failed to calculate authority for ${domain}:`, error);
      return 0;
    }
  }

  /**
   * Get comprehensive domain metrics
   */
  async getDomainMetrics(domain: string): Promise<DomainMetrics> {
    const cached = this.getCachedAuthority(domain);
    if (cached) {
      return cached;
    }

    const authority = await this.calculateAuthority(domain);
    return this.getCachedAuthority(domain) || {
      domain,
      authority,
      trustScore: 0,
      backlinks: 0,
      referringDomains: 0,
      organicTraffic: 0,
      socialSignals: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Analyze multiple domains for comparison
   */
  async analyzeMultipleDomains(domains: string[]): Promise<DomainMetrics[]> {
    const metrics = await Promise.all(
      domains.map(domain => this.getDomainMetrics(domain))
    );

    return metrics.sort((a, b) => b.authority - a.authority);
  }

  /**
   * Check if domain is trustworthy
   */
  async isTrustworthy(domain: string, threshold: number = 50): Promise<boolean> {
    const authority = await this.calculateAuthority(domain);
    return authority >= threshold;
  }

  /**
   * Get domain category/industry
   */
  async getDomainCategory(domain: string): Promise<string> {
    // Mock implementation - in real implementation, use domain classification API
    const categories = {
      'news': ['cnn.com', 'bbc.com', 'reuters.com', 'nytimes.com'],
      'tech': ['techcrunch.com', 'wired.com', 'theverge.com', 'arstechnica.com'],
      'business': ['forbes.com', 'bloomberg.com', 'wsj.com', 'ft.com'],
      'health': ['webmd.com', 'mayoclinic.org', 'healthline.com', 'medlineplus.gov'],
      'education': ['wikipedia.org', 'edu', 'coursera.org', 'khanacademy.org'],
      'government': ['.gov', '.mil'],
      'nonprofit': ['.org']
    };

    for (const [category, patterns] of Object.entries(categories)) {
      if (patterns.some(pattern => domain.includes(pattern))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Analyze authority factors for domain
   */
  private async analyzeAuthorityFactors(domain: string): Promise<AuthorityFactors> {
    // Mock implementation - in real implementation, integrate with:
    // - Moz API for backlink data
    // - Ahrefs API for domain metrics
    // - SEMrush API for traffic data
    // - Social media APIs for social signals

    return {
      backlinkQuality: this.mockBacklinkQuality(domain),
      domainAge: this.mockDomainAge(domain),
      contentQuality: this.mockContentQuality(domain),
      technicalSEO: this.mockTechnicalSEO(domain),
      socialSignals: this.mockSocialSignals(domain),
      brandMentions: this.mockBrandMentions(domain)
    };
  }

  /**
   * Calculate authority score from factors
   */
  private calculateAuthorityScore(factors: AuthorityFactors): number {
    const weights = {
      backlinkQuality: 0.35,
      domainAge: 0.15,
      contentQuality: 0.25,
      technicalSEO: 0.10,
      socialSignals: 0.10,
      brandMentions: 0.05
    };

    const score = Object.entries(weights).reduce((total, [factor, weight]) => {
      return total + (factors[factor as keyof AuthorityFactors] * weight * 100);
    }, 0);

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Mock backlink quality analysis
   */
  private mockBacklinkQuality(domain: string): number {
    // Simulate different authority levels based on domain patterns
    if (domain.includes('edu') || domain.includes('gov')) return 0.9;
    if (domain.includes('org')) return 0.8;
    if (domain.includes('com')) return 0.7;
    if (domain.includes('net')) return 0.6;
    return 0.5;
  }

  /**
   * Mock domain age analysis
   */
  private mockDomainAge(domain: string): number {
    // Simulate domain age based on common patterns
    const oldDomains = ['wikipedia.org', 'google.com', 'microsoft.com', 'apple.com'];
    const mediumDomains = ['github.com', 'stackoverflow.com', 'reddit.com'];
    
    if (oldDomains.some(d => domain.includes(d))) return 0.9;
    if (mediumDomains.some(d => domain.includes(d))) return 0.7;
    return 0.5;
  }

  /**
   * Mock content quality analysis
   */
  private mockContentQuality(domain: string): number {
    // Simulate content quality based on domain type
    if (domain.includes('edu') || domain.includes('gov')) return 0.9;
    if (domain.includes('wikipedia.org')) return 0.8;
    if (domain.includes('news') || domain.includes('blog')) return 0.7;
    return 0.6;
  }

  /**
   * Mock technical SEO analysis
   */
  private mockTechnicalSEO(domain: string): number {
    // Simulate technical SEO score
    const highTechDomains = ['google.com', 'microsoft.com', 'apple.com', 'amazon.com'];
    const mediumTechDomains = ['github.com', 'stackoverflow.com', 'medium.com'];
    
    if (highTechDomains.some(d => domain.includes(d))) return 0.9;
    if (mediumTechDomains.some(d => domain.includes(d))) return 0.7;
    return 0.6;
  }

  /**
   * Mock social signals analysis
   */
  private mockSocialSignals(domain: string): number {
    // Simulate social signals based on domain popularity
    const highSocialDomains = ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com'];
    const mediumSocialDomains = ['reddit.com', 'youtube.com', 'tiktok.com'];
    
    if (highSocialDomains.some(d => domain.includes(d))) return 0.9;
    if (mediumSocialDomains.some(d => domain.includes(d))) return 0.7;
    return 0.5;
  }

  /**
   * Mock brand mentions analysis
   */
  private mockBrandMentions(domain: string): number {
    // Simulate brand mention frequency
    const highMentionDomains = ['forbes.com', 'bloomberg.com', 'wsj.com', 'techcrunch.com'];
    const mediumMentionDomains = ['medium.com', 'linkedin.com', 'reddit.com'];
    
    if (highMentionDomains.some(d => domain.includes(d))) return 0.8;
    if (mediumMentionDomains.some(d => domain.includes(d))) return 0.6;
    return 0.4;
  }

  /**
   * Get cached authority data
   */
  private getCachedAuthority(domain: string): DomainMetrics | null {
    const cached = this.authorityCache.get(domain);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.metrics;
    }
    return null;
  }

  /**
   * Cache authority data
   */
  private cacheAuthority(domain: string, metrics: DomainMetrics): void {
    this.authorityCache.set(domain, {
      metrics,
      timestamp: Date.now()
    });
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [domain, cached] of this.authorityCache.entries()) {
      if (now - cached.timestamp >= this.CACHE_TTL) {
        this.authorityCache.delete(domain);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; domains: string[] } {
    return {
      size: this.authorityCache.size,
      domains: Array.from(this.authorityCache.keys())
    };
  }
}
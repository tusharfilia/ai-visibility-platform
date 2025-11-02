/**
 * Freshness Analyzer Service
 * Extracts last-updated timestamps and calculates freshness scores
 */

import { Injectable } from '@nestjs/common';

export interface FreshnessAnalysis {
  lastUpdated?: Date;
  freshnessScore: number; // 0-100
  freshnessSource: 'header' | 'schema' | 'html' | 'unknown';
  ageInDays: number;
  isStale: boolean; // >180 days
}

@Injectable()
export class FreshnessAnalyzerService {
  /**
   * Analyze freshness of a page
   */
  async analyzeFreshness(url: string): Promise<FreshnessAnalysis> {
    try {
      // Fetch page
      const html = await this.fetchPage(url);
      const headers = await this.fetchHeaders(url);

      // Extract last updated from various sources
      const lastUpdated = this.extractLastUpdated(html, headers);

      // Calculate freshness score
      const freshnessScore = this.calculateFreshnessScore(lastUpdated);

      // Calculate age
      const ageInDays = lastUpdated
        ? (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      return {
        lastUpdated,
        freshnessScore,
        freshnessSource: lastUpdated ? this.determineSource(html, headers) : 'unknown',
        ageInDays: Math.round(ageInDays),
        isStale: ageInDays > 180,
      };
    } catch (error) {
      console.error(`Error analyzing freshness for ${url}:`, error);
      return {
        freshnessScore: 0,
        freshnessSource: 'unknown',
        ageInDays: Infinity,
        isStale: true,
      };
    }
  }

  /**
   * Extract last updated timestamp from HTML and headers
   */
  extractLastUpdated(html: string, headers: Headers): Date | undefined {
    // Try headers first (most reliable)
    const lastModified = headers.get('last-modified');
    if (lastModified) {
      return new Date(lastModified);
    }

    // Try schema.org dateModified
    const schemaDate = this.extractSchemaDate(html);
    if (schemaDate) {
      return schemaDate;
    }

    // Try <time> elements
    const timeDate = this.extractTimeElement(html);
    if (timeDate) {
      return timeDate;
    }

    // Try meta tags
    const metaDate = this.extractMetaDate(html);
    if (metaDate) {
      return metaDate;
    }

    return undefined;
  }

  /**
   * Calculate freshness score with decay
   */
  calculateFreshnessScore(lastUpdated?: Date): number {
    if (!lastUpdated) {
      return 0; // No date = 0 score
    }

    const now = Date.now();
    const ageInDays = (now - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

    // Exponential decay: 50% after 180 days, 90% after 365 days
    const decayFactor = Math.exp(-ageInDays / 180);
    const score = 50 + (50 * decayFactor); // Starts at 100, decays to 50

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Fetch page HTML
   */
  private async fetchPage(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GEOAuditor/1.0)',
        },
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      console.warn(`Failed to fetch ${url}:`, error);
      throw error;
    }
  }

  /**
   * Fetch page headers
   */
  private async fetchHeaders(url: string): Promise<Headers> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GEOAuditor/1.0)',
        },
        signal: AbortSignal.timeout(5000),
      });
      
      return response.headers;
    } catch (error) {
      return new Headers(); // Return empty headers on error
    }
  }

  /**
   * Extract date from schema.org markup
   */
  private extractSchemaDate(html: string): Date | undefined {
    // Look for datePublished or dateModified in JSON-LD
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
    
    let match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const json = JSON.parse(match[1]);
        const dateModified = json.dateModified || json['dateModified'] || json['@dateModified'];
        const datePublished = json.datePublished || json['datePublished'] || json['@datePublished'];
        
        if (dateModified) {
          return new Date(dateModified);
        }
        if (datePublished) {
          return new Date(datePublished);
        }
      } catch (e) {
        // Invalid JSON, continue
      }
    }

    return undefined;
  }

  /**
   * Extract date from <time> elements
   */
  private extractTimeElement(html: string): Date | undefined {
    const timeRegex = /<time[^>]*datetime=["']([^"']+)["'][^>]*>/gi;
    const matches = html.match(timeRegex);
    
    if (matches && matches.length > 0) {
      for (const match of matches) {
        const datetimeMatch = match.match(/datetime=["']([^"']+)["']/i);
        if (datetimeMatch) {
          const date = new Date(datetimeMatch[1]);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Extract date from meta tags
   */
  private extractMetaDate(html: string): Date | undefined {
    // Look for common meta tags
    const metaTags = [
      /<meta[^>]*property=["']article:modified_time["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*name=["']last-modified["'][^>]*content=["']([^"']+)["']/i,
      /<meta[^>]*http-equiv=["']last-modified["'][^>]*content=["']([^"']+)["']/i,
    ];

    for (const regex of metaTags) {
      const match = html.match(regex);
      if (match && match[1]) {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return undefined;
  }

  /**
   * Determine freshness source
   */
  private determineSource(html: string, headers: Headers): 'header' | 'schema' | 'html' | 'unknown' {
    if (headers.get('last-modified')) {
      return 'header';
    }
    if (html.includes('application/ld+json') && (html.includes('dateModified') || html.includes('datePublished'))) {
      return 'schema';
    }
    if (html.includes('<time') || html.includes('last-modified')) {
      return 'html';
    }
    return 'unknown';
  }
}



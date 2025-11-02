/**
 * Page Structure Analyzer Service
 * Detects "atomic page" structure indicators
 */

import { Injectable } from '@nestjs/common';

export interface StructureAnalysis {
  structureScore: number; // 0-100
  hasTLDR: boolean;
  hasClearHeadings: boolean;
  hasExternalCitations: boolean;
  hasBulletPoints: boolean;
  isFocused: boolean;
  wordCount: number;
  headingCount: number;
  externalLinkCount: number;
  bulletPointCount: number;
  recommendations: string[];
}

@Injectable()
export class PageStructureAnalyzerService {
  /**
   * Analyze page structure for atomic page indicators
   */
  async analyzeStructure(url: string): Promise<StructureAnalysis> {
    try {
      const html = await this.fetchPage(url);
      
      // Extract text content (simplified - in production use proper HTML parser)
      const textContent = this.extractTextContent(html);
      
      // Check indicators
      const hasTLDR = this.detectTLDR(textContent);
      const headingCount = this.countHeadings(html);
      const hasClearHeadings = headingCount >= 3;
      const externalLinkCount = this.countExternalLinks(html);
      const hasExternalCitations = externalLinkCount >= 1;
      const bulletPointCount = this.countBulletPoints(html);
      const hasBulletPoints = bulletPointCount >= 3;
      const wordCount = this.countWords(textContent);
      const isFocused = wordCount < 2000; // Atomic pages are concise

      // Calculate structure score
      const structureScore = this.calculateStructureScore({
        hasTLDR,
        hasClearHeadings,
        hasExternalCitations,
        hasBulletPoints,
        isFocused,
      });

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        hasTLDR,
        hasClearHeadings,
        hasExternalCitations,
        hasBulletPoints,
        isFocused,
        headingCount,
        externalLinkCount,
        bulletPointCount,
        wordCount,
      });

      return {
        structureScore,
        hasTLDR,
        hasClearHeadings,
        hasExternalCitations,
        hasBulletPoints,
        isFocused,
        wordCount,
        headingCount,
        externalLinkCount,
        bulletPointCount,
        recommendations,
      };
    } catch (error) {
      console.error(`Error analyzing structure for ${url}:`, error);
      return {
        structureScore: 0,
        hasTLDR: false,
        hasClearHeadings: false,
        hasExternalCitations: false,
        hasBulletPoints: false,
        isFocused: false,
        wordCount: 0,
        headingCount: 0,
        externalLinkCount: 0,
        bulletPointCount: 0,
        recommendations: ['Unable to analyze page structure'],
      };
    }
  }

  /**
   * Detect atomic page structure
   */
  detectAtomicPage(html: string): boolean {
    const analysis = this.analyzeStructureSync(html);
    // Atomic page if score >= 60
    return analysis.structureScore >= 60;
  }

  /**
   * Synchronous version for quick checks
   */
  private analyzeStructureSync(html: string): { structureScore: number } {
    const textContent = this.extractTextContent(html);
    const hasTLDR = this.detectTLDR(textContent);
    const hasClearHeadings = this.countHeadings(html) >= 3;
    const hasExternalCitations = this.countExternalLinks(html) >= 1;
    const hasBulletPoints = this.countBulletPoints(html) >= 3;
    const isFocused = this.countWords(textContent) < 2000;

    const structureScore = this.calculateStructureScore({
      hasTLDR,
      hasClearHeadings,
      hasExternalCitations,
      hasBulletPoints,
      isFocused,
    });

    return { structureScore };
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
   * Extract text content from HTML (simplified)
   */
  private extractTextContent(html: string): string {
    // Remove script and style tags
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Decode entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    
    return text.trim();
  }

  /**
   * Detect TL;DR or summary section
   */
  private detectTLDR(text: string): boolean {
    const textLower = text.toLowerCase();
    return (
      textLower.includes('tldr') ||
      textLower.includes('tl;dr') ||
      textLower.includes('summary') ||
      textLower.includes('key takeaways') ||
      textLower.includes('bottom line')
    );
  }

  /**
   * Count headings (h1-h6)
   */
  private countHeadings(html: string): number {
    const headingRegex = /<h[1-6][^>]*>/gi;
    const matches = html.match(headingRegex);
    return matches ? matches.length : 0;
  }

  /**
   * Count external links
   */
  private countExternalLinks(html: string): number {
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
    const links: string[] = [];
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      // Check if it's an external link (simplified - check for http/https)
      if (href.startsWith('http://') || href.startsWith('https://')) {
        links.push(href);
      }
    }

    return links.length;
  }

  /**
   * Count bullet points (ul, ol, li)
   */
  private countBulletPoints(html: string): number {
    const liRegex = /<li[^>]*>/gi;
    const matches = html.match(liRegex);
    return matches ? matches.length : 0;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Calculate structure score
   */
  private calculateStructureScore(indicators: {
    hasTLDR: boolean;
    hasClearHeadings: boolean;
    hasExternalCitations: boolean;
    hasBulletPoints: boolean;
    isFocused: boolean;
  }): number {
    let score = 0;

    if (indicators.hasTLDR) score += 25;
    if (indicators.hasClearHeadings) score += 25;
    if (indicators.hasExternalCitations) score += 25;
    if (indicators.hasBulletPoints) score += 15;
    if (indicators.isFocused) score += 10;

    return Math.min(100, score);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(metrics: {
    hasTLDR: boolean;
    hasClearHeadings: boolean;
    hasExternalCitations: boolean;
    hasBulletPoints: boolean;
    isFocused: boolean;
    headingCount: number;
    externalLinkCount: number;
    bulletPointCount: number;
    wordCount: number;
  }): string[] {
    const recommendations: string[] = [];

    if (!metrics.hasTLDR) {
      recommendations.push('Add a TL;DR or summary section');
    }

    if (!metrics.hasClearHeadings) {
      recommendations.push(`Add more headings (currently ${metrics.headingCount}, recommend at least 3)`);
    }

    if (!metrics.hasExternalCitations) {
      recommendations.push('Add external citations or links');
    }

    if (!metrics.hasBulletPoints) {
      recommendations.push(`Add bullet points or lists (currently ${metrics.bulletPointCount}, recommend at least 3)`);
    }

    if (!metrics.isFocused) {
      recommendations.push(`Reduce content length (currently ${metrics.wordCount} words, recommend under 2000)`);
    }

    return recommendations;
  }
}



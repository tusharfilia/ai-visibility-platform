/**
 * Citation Classifier Service
 * Classifies citations by source type: licensed_publisher, curated, directory, reddit, user_generated
 */

import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type CitationSourceType = 'licensed_publisher' | 'curated' | 'directory' | 'reddit' | 'user_generated';

export interface CitationInput {
  url: string;
  domain: string;
  rank?: number;
  confidence?: number;
}

export interface ClassificationResult {
  sourceType: CitationSourceType;
  isLicensed?: boolean;
  publisherName?: string;
  directoryType?: string;
  redditThread?: string;
}

@Injectable()
export class CitationClassifierService {
  private licensedPublishers!: Set<string>;
  private publisherNames!: Map<string, string>;
  private directoryDomains!: Map<string, { type: string; name: string }>;
  private redditDomains!: Set<string>;
  private redditPatterns!: string[];
  private curatedDomains!: Set<string>;

  constructor() {
    this.loadAssets();
  }

  /**
   * Load asset JSON files
   */
  private loadAssets(): void {
    try {
      // Load licensed publishers
      const publishersPath = path.join(__dirname, '../../assets/licensed_publishers.json');
      const publishersData = JSON.parse(fs.readFileSync(publishersPath, 'utf8'));
      this.licensedPublishers = new Set(publishersData.domains || []);
      this.publisherNames = new Map(Object.entries(publishersData.publishers || {}));

      // Load directories
      const directoriesPath = path.join(__dirname, '../../assets/known_directories.json');
      const directoriesData = JSON.parse(fs.readFileSync(directoriesPath, 'utf8'));
      this.directoryDomains = new Map();
      (directoriesData.directories || []).forEach((dir: any) => {
        this.directoryDomains.set(dir.domain, { type: dir.type, name: dir.name });
      });

      // Load Reddit domains
      const redditPath = path.join(__dirname, '../../assets/reddit_domains.json');
      const redditData = JSON.parse(fs.readFileSync(redditPath, 'utf8'));
      this.redditDomains = new Set(redditData.domains || []);
      this.redditPatterns = redditData.patterns || [];

      // Initialize curated domains (Wikipedia, academic sources)
      this.curatedDomains = new Set([
        'wikipedia.org',
        'wikimedia.org',
        'edu', // .edu TLD
        'gov', // .gov TLD
        'org', // Major .org sources
        'ac.uk',
        'edu.au',
      ]);
    } catch (error) {
      console.warn('Failed to load citation classification assets:', error);
      // Initialize with empty sets to prevent crashes
      this.licensedPublishers = new Set();
      this.publisherNames = new Map();
      this.directoryDomains = new Map();
      this.redditDomains = new Set();
      this.redditPatterns = [];
      this.curatedDomains = new Set();
    }
  }

  /**
   * Classify a citation by source type
   */
  async classifyCitation(citation: CitationInput): Promise<ClassificationResult> {
    const domain = this.normalizeDomain(citation.domain);
    const url = citation.url.toLowerCase();

    // Check licensed publisher first (highest priority)
    const licensedResult = this.detectLicensedPublisher(domain);
    if (licensedResult) {
      return {
        sourceType: 'licensed_publisher',
        isLicensed: true,
        publisherName: licensedResult,
      };
    }

    // Check Reddit
    const redditResult = this.detectReddit(url);
    if (redditResult) {
      return {
        sourceType: 'reddit',
        redditThread: citation.url,
      };
    }

    // Check directory
    const directoryResult = this.detectDirectory(domain, url);
    if (directoryResult) {
      return {
        sourceType: 'directory',
        directoryType: directoryResult.type,
      };
    }

    // Check curated sources
    if (this.detectCurated(domain)) {
      return {
        sourceType: 'curated',
      };
    }

    // Default to user_generated
    return {
      sourceType: 'user_generated',
    };
  }

  /**
   * Detect licensed publisher
   */
  detectLicensedPublisher(domain: string): string | null {
    const normalized = this.normalizeDomain(domain);
    
    // Check exact match
    if (this.licensedPublishers.has(normalized)) {
      return this.publisherNames.get(normalized) || null;
    }

    // Check subdomain matches (e.g., www.wsj.com -> wsj.com)
    const parts = normalized.split('.');
    if (parts.length > 2) {
      const rootDomain = parts.slice(-2).join('.');
      if (this.licensedPublishers.has(rootDomain)) {
        return this.publisherNames.get(rootDomain) || null;
      }
    }

    return null;
  }

  /**
   * Detect Reddit citation
   */
  detectReddit(url: string): boolean {
    const urlLower = url.toLowerCase();
    
    // Check domain
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Check exact Reddit domains
      if (this.redditDomains.has(hostname)) {
        return true;
      }

      // Check subdomain (e.g., www.reddit.com)
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        const rootDomain = parts.slice(-2).join('.');
        if (this.redditDomains.has(rootDomain)) {
          return true;
        }
      }
    } catch {
      // Invalid URL, check patterns
    }

    // Check URL patterns
    return this.redditPatterns.some(pattern => urlLower.includes(pattern));
  }

  /**
   * Detect directory listing
   */
  detectDirectory(domain: string, url: string): { type: string; name: string } | null {
    const normalized = this.normalizeDomain(domain);
    const urlLower = url.toLowerCase();

    // Check exact domain match
    const exactMatch = this.directoryDomains.get(normalized);
    if (exactMatch) {
      return exactMatch;
    }

    // Check URL path matches (e.g., google.com/maps -> gbp)
    for (const [directoryDomain, directoryInfo] of this.directoryDomains.entries()) {
      if (urlLower.includes(directoryDomain)) {
        return directoryInfo;
      }
    }

    // Check domain contains directory keywords
    const directoryKeywords: Record<string, string> = {
      'google.com': 'gbp',
      'maps.google.com': 'gbp',
      'bing.com': 'bing_places',
      'maps.bing.com': 'bing_places',
      'apple.com': 'apple_business',
      'g2.com': 'g2',
      'capterra.com': 'capterra',
      'trustpilot.com': 'trustpilot',
      'yelp.com': 'yelp',
    };

    for (const [keyword, type] of Object.entries(directoryKeywords)) {
      if (normalized.includes(keyword) || urlLower.includes(keyword)) {
        return {
          type,
          name: this.getDirectoryName(type),
        };
      }
    }

    return null;
  }

  /**
   * Detect curated sources (Wikipedia, academic)
   */
  private detectCurated(domain: string): boolean {
    const normalized = this.normalizeDomain(domain);
    
    // Check exact match
    if (this.curatedDomains.has(normalized)) {
      return true;
    }

    // Check TLD matches
    const parts = normalized.split('.');
    const tld = parts[parts.length - 1];
    if (tld === 'edu' || tld === 'gov') {
      return true;
    }

    // Check subdomain matches (e.g., en.wikipedia.org)
    if (parts.length >= 2) {
      const rootDomain = parts.slice(-2).join('.');
      if (this.curatedDomains.has(rootDomain)) {
        return true;
      }
    }

    // Check Wikipedia variants
    if (normalized.includes('wikipedia')) {
      return true;
    }

    return false;
  }

  /**
   * Normalize domain for matching
   */
  private normalizeDomain(domain: string): string {
    return domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
  }

  /**
   * Get directory name by type
   */
  private getDirectoryName(type: string): string {
    const names: Record<string, string> = {
      gbp: 'Google Business Profile',
      bing_places: 'Bing Places',
      apple_business: 'Apple Business Connect',
      g2: 'G2',
      capterra: 'Capterra',
      trustpilot: 'Trustpilot',
      yelp: 'Yelp',
    };
    return names[type] || type;
  }

  /**
   * Get all supported source types
   */
  getSupportedSourceTypes(): CitationSourceType[] {
    return ['licensed_publisher', 'curated', 'directory', 'reddit', 'user_generated'];
  }
}


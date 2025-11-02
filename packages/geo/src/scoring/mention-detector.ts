/**
 * Mention Detection System
 * Detects brand mentions in AI responses with sentiment analysis
 */

export interface MentionDetectionConfig {
  minConfidence: number;
  maxSnippetLength: number;
  sentimentThreshold: number;
  brandVariations: string[];
}

export interface DetectedMention {
  brand: string;
  position: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  snippet: string;
  confidence: number;
  context: string;
  engine: string;
}

export class MentionDetector {
  private config: MentionDetectionConfig;
  private sentimentKeywords = {
    positive: [
      'best', 'excellent', 'top', 'recommended', 'leading', 'premium',
      'quality', 'reliable', 'trusted', 'innovative', 'advanced'
    ],
    negative: [
      'worst', 'poor', 'bad', 'terrible', 'avoid', 'problematic',
      'unreliable', 'outdated', 'expensive', 'slow', 'buggy'
    ]
  };

  constructor(config: Partial<MentionDetectionConfig> = {}) {
    this.config = {
      minConfidence: 0.7,
      maxSnippetLength: 200,
      sentimentThreshold: 0.6,
      brandVariations: [],
      ...config
    };
  }

  /**
   * Detect mentions in AI response text
   */
  detectMentions(
    text: string,
    brand: string,
    engine: string
  ): DetectedMention[] {
    const mentions: DetectedMention[] = [];
    const brandPatterns = this.createBrandPatterns(brand);
    
    brandPatterns.forEach(pattern => {
      const matches = this.findPatternMatches(text, pattern, brand, engine);
      mentions.push(...matches);
    });

    // Remove duplicates and sort by position
    return this.deduplicateMentions(mentions)
      .sort((a, b) => a.position - b.position);
  }

  /**
   * Create brand patterns for detection
   */
  private createBrandPatterns(brand: string): RegExp[] {
    const patterns: RegExp[] = [];
    
    // Exact brand name
    patterns.push(new RegExp(`\\b${this.escapeRegex(brand)}\\b`, 'gi'));
    
    // Brand variations
    this.config.brandVariations.forEach(variation => {
      patterns.push(new RegExp(`\\b${this.escapeRegex(variation)}\\b`, 'gi'));
    });
    
    // Common brand name variations
    const variations = this.generateBrandVariations(brand);
    variations.forEach(variation => {
      patterns.push(new RegExp(`\\b${this.escapeRegex(variation)}\\b`, 'gi'));
    });
    
    return patterns;
  }

  /**
   * Find pattern matches in text
   */
  private findPatternMatches(
    text: string,
    pattern: RegExp,
    brand: string,
    engine: string
  ): DetectedMention[] {
    const mentions: DetectedMention[] = [];
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const position = match.index;
      const snippet = this.extractSnippet(text, position);
      const context = this.extractContext(text, position);
      const sentiment = this.analyzeSentiment(snippet, context);
      const confidence = this.calculateConfidence(snippet, sentiment);
      
      if (confidence >= this.config.minConfidence) {
        mentions.push({
          brand: match[0],
          position,
          sentiment,
          snippet,
          confidence,
          context,
          engine
        });
      }
    }
    
    return mentions;
  }

  /**
   * Extract snippet around mention
   */
  private extractSnippet(text: string, position: number): string {
    const start = Math.max(0, position - 50);
    const end = Math.min(text.length, position + 50);
    return text.substring(start, end);
  }

  /**
   * Extract broader context around mention
   */
  private extractContext(text: string, position: number): string {
    const start = Math.max(0, position - 100);
    const end = Math.min(text.length, position + 100);
    return text.substring(start, end);
  }

  /**
   * Analyze sentiment of mention
   */
  private analyzeSentiment(snippet: string, context: string): 'positive' | 'neutral' | 'negative' {
    const text = `${snippet} ${context}`.toLowerCase();
    
    const positiveScore = this.calculateSentimentScore(text, this.sentimentKeywords.positive);
    const negativeScore = this.calculateSentimentScore(text, this.sentimentKeywords.negative);
    
    if (positiveScore > negativeScore && positiveScore > this.config.sentimentThreshold) {
      return 'positive';
    } else if (negativeScore > positiveScore && negativeScore > this.config.sentimentThreshold) {
      return 'negative';
    } else {
      return 'neutral';
    }
  }

  /**
   * Calculate sentiment score
   */
  private calculateSentimentScore(text: string, keywords: string[]): number {
    let score = 0;
    let totalWords = text.split(/\s+/).length;
    
    keywords.forEach(keyword => {
      const matches = (text.match(new RegExp(keyword, 'gi')) || []).length;
      score += matches;
    });
    
    return totalWords > 0 ? score / totalWords : 0;
  }

  /**
   * Calculate mention confidence
   */
  private calculateConfidence(snippet: string, sentiment: string): number {
    let confidence = 0.5; // Base confidence
    
    // Length factor
    if (snippet.length > 20) confidence += 0.1;
    
    // Sentiment factor
    if (sentiment === 'positive') confidence += 0.2;
    else if (sentiment === 'negative') confidence += 0.1;
    
    // Context factor
    if (snippet.includes('recommend') || snippet.includes('suggest')) confidence += 0.1;
    if (snippet.includes('best') || snippet.includes('top')) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  /**
   * Generate brand name variations
   */
  private generateBrandVariations(brand: string): string[] {
    const variations: string[] = [];
    
    // Add common variations
    variations.push(brand.toLowerCase());
    variations.push(brand.toUpperCase());
    variations.push(brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase());
    
    // Add common abbreviations
    if (brand.length > 3) {
      variations.push(brand.substring(0, 3).toUpperCase());
    }
    
    // Add common suffixes/prefixes
    const commonSuffixes = ['Inc', 'Corp', 'LLC', 'Ltd', 'Co'];
    commonSuffixes.forEach(suffix => {
      variations.push(`${brand} ${suffix}`);
      variations.push(`${brand} ${suffix.toLowerCase()}`);
    });
    
    return variations;
  }

  /**
   * Remove duplicate mentions
   */
  private deduplicateMentions(mentions: DetectedMention[]): DetectedMention[] {
    const seen = new Set<string>();
    const unique: DetectedMention[] = [];
    
    mentions.forEach(mention => {
      const key = `${mention.brand}:${mention.position}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(mention);
      }
    });
    
    return unique;
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get mention statistics
   */
  getMentionStatistics(mentions: DetectedMention[]): {
    total: number;
    bySentiment: Record<string, number>;
    byEngine: Record<string, number>;
    averageConfidence: number;
    averagePosition: number;
  } {
    const bySentiment = mentions.reduce((acc, mention) => {
      acc[mention.sentiment] = (acc[mention.sentiment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byEngine = mentions.reduce((acc, mention) => {
      acc[mention.engine] = (acc[mention.engine] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageConfidence = mentions.length > 0
      ? mentions.reduce((sum, mention) => sum + mention.confidence, 0) / mentions.length
      : 0;

    const averagePosition = mentions.length > 0
      ? mentions.reduce((sum, mention) => sum + mention.position, 0) / mentions.length
      : 0;

    return {
      total: mentions.length,
      bySentiment,
      byEngine,
      averageConfidence,
      averagePosition
    };
  }

  /**
   * Get top mentions by confidence
   */
  getTopMentions(mentions: DetectedMention[], limit: number = 10): DetectedMention[] {
    return mentions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Get mentions by sentiment
   */
  getMentionsBySentiment(
    mentions: DetectedMention[],
    sentiment: 'positive' | 'neutral' | 'negative'
  ): DetectedMention[] {
    return mentions.filter(mention => mention.sentiment === sentiment);
  }
}



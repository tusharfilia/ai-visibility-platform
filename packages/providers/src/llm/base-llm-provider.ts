import { ProviderConfig } from '../types';

export interface LLMResponse {
  content: string;
  citations?: string[];
  mentions?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
  cost: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface EngineAnswer {
  engine: string;
  answer: string;
  citations: string[];
  mentions: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  timestamp: Date;
  cost: number;
}

export abstract class BaseLLMProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Query the LLM provider with a prompt
   */
  abstract query(prompt: string, options?: any): Promise<LLMResponse>;

  /**
   * Normalize LLM response to standard EngineAnswer format
   */
  abstract normalizeResponse(response: LLMResponse, originalPrompt: string): EngineAnswer;

  /**
   * Calculate cost for the API call
   */
  abstract calculateCost(response: LLMResponse): number;

  /**
   * Get provider name
   */
  abstract getProviderName(): string;

  /**
   * Check if provider is available
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Extract citations from response text
   */
  protected extractCitations(text: string): string[] {
    const citationPatterns = [
      /\[(\d+)\]/g, // [1], [2], etc.
      /\(([^)]+)\)/g, // (source), (reference)
      /https?:\/\/[^\s]+/g, // URLs
    ];

    const citations: string[] = [];
    
    for (const pattern of citationPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        citations.push(...matches);
      }
    }

    return [...new Set(citations)]; // Remove duplicates
  }

  /**
   * Extract mentions from response text
   */
  protected extractMentions(text: string, brandName?: string): string[] {
    const mentions: string[] = [];
    
    if (brandName) {
      const brandPattern = new RegExp(`\\b${brandName}\\b`, 'gi');
      const brandMatches = text.match(brandPattern);
      if (brandMatches) {
        mentions.push(...brandMatches);
      }
    }

    // Extract other potential brand mentions (capitalized words)
    const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const capitalizedMatches = text.match(capitalizedPattern);
    if (capitalizedMatches) {
      mentions.push(...capitalizedMatches);
    }

    return [...new Set(mentions)]; // Remove duplicates
  }

  /**
   * Analyze sentiment of text
   */
  protected analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'outstanding', 'superb'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing', 'poor', 'worst', 'hate'];
    
    const lowerText = text.toLowerCase();
    
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Calculate confidence score based on response characteristics
   */
  protected calculateConfidence(response: LLMResponse): number {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence for longer responses
    if (response.content.length > 100) confidence += 0.1;
    if (response.content.length > 500) confidence += 0.1;
    
    // Increase confidence for responses with citations
    if (response.citations && response.citations.length > 0) confidence += 0.2;
    
    // Increase confidence for responses with mentions
    if (response.mentions && response.mentions.length > 0) confidence += 0.1;
    
    // Decrease confidence for very short responses
    if (response.content.length < 50) confidence -= 0.2;
    
    return Math.min(Math.max(confidence, 0), 1); // Clamp between 0 and 1
  }
}
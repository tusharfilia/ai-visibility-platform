import { EngineAnswer } from './base-llm-provider';

export interface NormalizedResponse {
  engine: string;
  answer: string;
  citations: string[];
  mentions: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  timestamp: Date;
  cost: number;
  metadata?: {
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
    model?: string;
    provider?: string;
  };
}

export class ResponseNormalizer {
  /**
   * Normalize responses from different LLM providers to a consistent format
   */
  static normalizeResponses(responses: EngineAnswer[]): NormalizedResponse[] {
    return responses.map(response => this.normalizeResponse(response));
  }

  /**
   * Normalize a single response
   */
  static normalizeResponse(response: EngineAnswer): NormalizedResponse {
    return {
      engine: response.engine,
      answer: this.cleanAnswer(response.answer),
      citations: this.normalizeCitations(response.citations),
      mentions: this.normalizeMentions(response.mentions),
      sentiment: response.sentiment,
      confidence: Math.round(response.confidence * 100) / 100, // Round to 2 decimal places
      timestamp: response.timestamp,
      cost: Math.round(response.cost * 10000) / 10000, // Round to 4 decimal places
      metadata: {
        provider: response.engine,
      },
    };
  }

  /**
   * Clean and normalize answer text
   */
  private static cleanAnswer(answer: string): string {
    return answer
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
      .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, ''); // Remove non-printable characters
  }

  /**
   * Normalize citations array
   */
  private static normalizeCitations(citations: string[]): string[] {
    return citations
      .map(citation => citation.trim())
      .filter(citation => citation.length > 0)
      .filter((citation, index, array) => array.indexOf(citation) === index); // Remove duplicates
  }

  /**
   * Normalize mentions array
   */
  private static normalizeMentions(mentions: string[]): string[] {
    return mentions
      .map(mention => mention.trim())
      .filter(mention => mention.length > 0)
      .filter((mention, index, array) => array.indexOf(mention) === index); // Remove duplicates
  }

  /**
   * Merge multiple responses from the same engine
   */
  static mergeResponses(responses: NormalizedResponse[]): NormalizedResponse {
    if (responses.length === 0) {
      throw new Error('Cannot merge empty responses array');
    }

    if (responses.length === 1) {
      return responses[0];
    }

    const firstResponse = responses[0];
    const allAnswers = responses.map(r => r.answer).join('\n\n');
    const allCitations = responses.flatMap(r => r.citations);
    const allMentions = responses.flatMap(r => r.mentions);
    const totalCost = responses.reduce((sum, r) => sum + r.cost, 0);
    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;

    // Determine overall sentiment (majority vote)
    const sentiments = responses.map(r => r.sentiment);
    const sentimentCounts = sentiments.reduce((acc, sentiment) => {
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const overallSentiment = Object.entries(sentimentCounts)
      .sort(([, a], [, b]) => b - a)[0][0] as 'positive' | 'negative' | 'neutral';

    return {
      engine: firstResponse.engine,
      answer: allAnswers,
      citations: [...new Set(allCitations)], // Remove duplicates
      mentions: [...new Set(allMentions)], // Remove duplicates
      sentiment: overallSentiment,
      confidence: Math.round(avgConfidence * 100) / 100,
      timestamp: new Date(),
      cost: Math.round(totalCost * 10000) / 10000,
      metadata: {
        provider: firstResponse.engine,
      } as any,
    };
  }

  /**
   * Compare responses for consistency
   */
  static compareResponses(responses: NormalizedResponse[]): {
    consistency: number;
    differences: string[];
  } {
    if (responses.length < 2) {
      return { consistency: 1, differences: [] };
    }

    const differences: string[] = [];
    let totalComparisons = 0;
    let consistentComparisons = 0;

    // Compare sentiment
    const sentiments = responses.map(r => r.sentiment);
    const uniqueSentiments = [...new Set(sentiments)];
    if (uniqueSentiments.length > 1) {
      differences.push(`Sentiment varies: ${uniqueSentiments.join(', ')}`);
    } else {
      consistentComparisons++;
    }
    totalComparisons++;

    // Compare confidence (within 20% range)
    const confidences = responses.map(r => r.confidence);
    const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const confidenceRange = avgConfidence * 0.2;
    const confidenceConsistent = confidences.every(c => 
      Math.abs(c - avgConfidence) <= confidenceRange
    );
    
    if (confidenceConsistent) {
      consistentComparisons++;
    } else {
      differences.push(`Confidence varies significantly: ${confidences.map(c => c.toFixed(2)).join(', ')}`);
    }
    totalComparisons++;

    // Compare citations overlap
    const allCitations = responses.flatMap(r => r.citations);
    const uniqueCitations = [...new Set(allCitations)];
    const citationOverlap = uniqueCitations.length / allCitations.length;
    
    if (citationOverlap > 0.5) {
      consistentComparisons++;
    } else {
      differences.push(`Low citation overlap: ${(citationOverlap * 100).toFixed(1)}%`);
    }
    totalComparisons++;

    const consistency = consistentComparisons / totalComparisons;
    
    return {
      consistency: Math.round(consistency * 100) / 100,
      differences,
    };
  }
}
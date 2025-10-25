/**
 * Mention extraction utilities
 * Extracts brand mentions from text with fuzzy matching and context
 */

import { Sentiment } from '@ai-visibility/shared';

export interface Mention {
  brand: string;
  position?: number;
  sentiment: Sentiment;
  snippet: string;
  confidence: number;
}

export interface MentionExtractionOptions {
  allowlist?: string[];
  denylist?: string[];
  contextWindow?: number;
  minConfidence?: number;
  caseSensitive?: boolean;
}

/**
 * Extract brand mentions from text with fuzzy matching
 */
export function extractMentions(
  text: string,
  brands: string[],
  options: MentionExtractionOptions = {}
): Mention[] {
  const {
    allowlist = [],
    denylist = [],
    contextWindow = 120,
    minConfidence = 0.6,
    caseSensitive = false,
  } = options;

  const mentions: Mention[] = [];
  const processedText = caseSensitive ? text : text.toLowerCase();
  const processedBrands = caseSensitive ? brands : brands.map(b => b.toLowerCase());

  // Filter brands based on allowlist/denylist
  const filteredBrands = processedBrands.filter(brand => {
    if (allowlist.length > 0 && !allowlist.some(a => a.toLowerCase() === brand)) {
      return false;
    }
    if (denylist.some(d => d.toLowerCase() === brand)) {
      return false;
    }
    return true;
  });

  for (const brand of filteredBrands) {
    const mentions_found = findBrandMentions(
      text,
      processedText,
      brand,
      contextWindow,
      minConfidence
    );
    mentions.push(...mentions_found);
  }

  // Remove duplicates and sort by position
  return deduplicateMentions(mentions).sort((a, b) => (a.position || 0) - (b.position || 0));
}

/**
 * Find mentions of a specific brand in text
 */
function findBrandMentions(
  originalText: string,
  processedText: string,
  brand: string,
  contextWindow: number,
  minConfidence: number
): Mention[] {
  const mentions: Mention[] = [];
  const brandWords = brand.split(/\s+/);
  const textWords = processedText.split(/\s+/);
  
  // Look for exact matches first
  let index = 0;
  while ((index = processedText.indexOf(brand, index)) !== -1) {
    const confidence = calculateExactMatchConfidence(brand, index, processedText);
    if (confidence >= minConfidence) {
      const snippet = extractSnippet(originalText, index, contextWindow);
      const position = getPositionInList(originalText, index);
      const sentiment = analyzeSentiment(snippet);
      
      mentions.push({
        brand: getOriginalBrandName(brand),
        position,
        sentiment,
        snippet,
        confidence,
      });
    }
    index += brand.length;
  }

  // Look for fuzzy matches
  for (let i = 0; i < textWords.length - brandWords.length + 1; i++) {
    const window = textWords.slice(i, i + brandWords.length);
    const confidence = calculateFuzzyMatchConfidence(brandWords, window);
    
    if (confidence >= minConfidence) {
      const startIndex = getWordIndexInText(processedText, i);
      const snippet = extractSnippet(originalText, startIndex, contextWindow);
      const position = getPositionInList(originalText, startIndex);
      const sentiment = analyzeSentiment(snippet);
      
      mentions.push({
        brand: getOriginalBrandName(brand),
        position,
        sentiment,
        snippet,
        confidence,
      });
    }
  }

  return mentions;
}

/**
 * Calculate confidence for exact matches
 */
function calculateExactMatchConfidence(
  brand: string,
  index: number,
  text: string
): number {
  let confidence = 1.0;
  
  // Check context for brand indicators
  const before = text.substring(Math.max(0, index - 20), index);
  const after = text.substring(index + brand.length, index + brand.length + 20);
  
  // Boost confidence for brand indicators
  const brandIndicators = ['by', 'from', 'using', 'with', 'via', 'powered by'];
  if (brandIndicators.some(indicator => before.includes(indicator))) {
    confidence += 0.1;
  }
  
  // Reduce confidence for common words
  const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
  if (commonWords.includes(brand.toLowerCase())) {
    confidence -= 0.3;
  }
  
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Calculate confidence for fuzzy matches
 */
function calculateFuzzyMatchConfidence(
  brandWords: string[],
  window: string[]
): number {
  if (brandWords.length !== window.length) {
    return 0;
  }
  
  let matches = 0;
  for (let i = 0; i < brandWords.length; i++) {
    if (brandWords[i] === window[i]) {
      matches++;
    } else if (calculateLevenshteinSimilarity(brandWords[i], window[i]) > 0.8) {
      matches += 0.8;
    }
  }
  
  return matches / brandWords.length;
}

/**
 * Calculate Levenshtein similarity between two strings
 */
function calculateLevenshteinSimilarity(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  const distance = matrix[str2.length][str1.length];
  return 1 - (distance / Math.max(str1.length, str2.length));
}

/**
 * Extract snippet with context window
 */
function extractSnippet(text: string, index: number, contextWindow: number): string {
  const start = Math.max(0, index - contextWindow);
  const end = Math.min(text.length, index + contextWindow);
  return text.substring(start, end);
}

/**
 * Get position in ordered list if applicable
 */
function getPositionInList(text: string, index: number): number | undefined {
  // Look for numbered lists
  const beforeText = text.substring(Math.max(0, index - 50), index);
  const match = beforeText.match(/(\d+)\.\s*$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  // Look for bullet points
  const bulletMatch = beforeText.match(/^[\s]*[-*]\s*$/);
  if (bulletMatch) {
    // Count bullet points before this one
    const textBefore = text.substring(0, index);
    const bullets = (textBefore.match(/^[\s]*[-*]\s/gm) || []).length;
    return bullets;
  }
  
  return undefined;
}

/**
 * Get word index in text
 */
function getWordIndexInText(text: string, wordIndex: number): number {
  const words = text.split(/\s+/);
  let index = 0;
  for (let i = 0; i < wordIndex && i < words.length; i++) {
    index += words[i].length + 1; // +1 for space
  }
  return index;
}

/**
 * Analyze sentiment of snippet
 */
function analyzeSentiment(snippet: string): Sentiment {
  const positiveWords = ['excellent', 'great', 'best', 'amazing', 'outstanding', 'superior', 'top', 'leading', 'premium', 'advanced'];
  const negativeWords = ['poor', 'worst', 'terrible', 'awful', 'bad', 'inferior', 'cheap', 'basic', 'limited', 'outdated'];
  
  const words = snippet.toLowerCase().split(/\s+/);
  let positiveScore = 0;
  let negativeScore = 0;
  
  for (const word of words) {
    if (positiveWords.includes(word)) positiveScore++;
    if (negativeWords.includes(word)) negativeScore++;
  }
  
  if (positiveScore > negativeScore) return Sentiment.POS;
  if (negativeScore > positiveScore) return Sentiment.NEG;
  return Sentiment.NEU;
}

/**
 * Get original brand name (preserve case)
 */
function getOriginalBrandName(brand: string): string {
  // This would typically maintain a mapping of lowercase to original case
  // For now, just return the brand as-is
  return brand;
}

/**
 * Remove duplicate mentions
 */
function deduplicateMentions(mentions: Mention[]): Mention[] {
  const seen = new Set<string>();
  return mentions.filter(mention => {
    const key = `${mention.brand.toLowerCase()}-${mention.position || 0}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

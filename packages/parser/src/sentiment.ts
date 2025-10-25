/**
 * Sentiment analysis utilities
 * Rule-based sentiment analysis with lexicon scoring
 */

import { Sentiment } from '@ai-visibility/shared';

export interface SentimentAnalysisOptions {
  useLLM?: boolean;
  llmProvider?: string;
  confidence?: number;
}

export interface SentimentResult {
  sentiment: Sentiment;
  confidence: number;
  scores: {
    positive: number;
    negative: number;
    neutral: number;
  };
  keywords: {
    positive: string[];
    negative: string[];
  };
}

// Positive sentiment lexicon
const POSITIVE_WORDS = new Set([
  'excellent', 'great', 'amazing', 'outstanding', 'superior', 'best', 'top',
  'leading', 'premium', 'advanced', 'innovative', 'cutting-edge', 'revolutionary',
  'breakthrough', 'game-changing', 'exceptional', 'remarkable', 'impressive',
  'powerful', 'robust', 'reliable', 'trusted', 'proven', 'established',
  'comprehensive', 'complete', 'full-featured', 'feature-rich', 'versatile',
  'flexible', 'scalable', 'efficient', 'fast', 'quick', 'easy', 'simple',
  'intuitive', 'user-friendly', 'seamless', 'smooth', 'effortless',
  'affordable', 'cost-effective', 'value', 'worth', 'recommended', 'popular',
  'loved', 'favorite', 'preferred', 'chosen', 'selected', 'winner',
  'success', 'achievement', 'accomplishment', 'victory', 'triumph',
  'benefit', 'advantage', 'pro', 'plus', 'positive', 'good', 'nice',
  'wonderful', 'fantastic', 'brilliant', 'perfect', 'ideal', 'optimal'
]);

// Negative sentiment lexicon
const NEGATIVE_WORDS = new Set([
  'poor', 'terrible', 'awful', 'horrible', 'worst', 'bad', 'inferior',
  'cheap', 'basic', 'limited', 'outdated', 'obsolete', 'deprecated',
  'broken', 'buggy', 'unreliable', 'unstable', 'slow', 'sluggish',
  'complicated', 'complex', 'difficult', 'hard', 'confusing', 'unclear',
  'expensive', 'costly', 'overpriced', 'waste', 'useless', 'worthless',
  'disappointing', 'frustrating', 'annoying', 'irritating', 'problematic',
  'flawed', 'defective', 'faulty', 'inadequate', 'insufficient', 'lacking',
  'missing', 'absent', 'unavailable', 'inaccessible', 'restricted',
  'limited', 'constrained', 'restricted', 'blocked', 'prevented',
  'failed', 'failure', 'error', 'mistake', 'issue', 'problem', 'concern',
  'worry', 'risk', 'danger', 'threat', 'harm', 'damage', 'loss',
  'disadvantage', 'con', 'negative', 'downside', 'drawback', 'flaw'
]);

// Intensifiers that amplify sentiment
const INTENSIFIERS = new Set([
  'very', 'extremely', 'highly', 'incredibly', 'absolutely', 'completely',
  'totally', 'entirely', 'perfectly', 'exactly', 'precisely', 'definitely',
  'certainly', 'surely', 'undoubtedly', 'clearly', 'obviously', 'evidently',
  'remarkably', 'exceptionally', 'particularly', 'especially', 'notably',
  'significantly', 'substantially', 'considerably', 'dramatically', 'massively'
]);

// Negation words that reverse sentiment
const NEGATION_WORDS = new Set([
  'not', 'no', 'never', 'none', 'nothing', 'nobody', 'nowhere', 'neither',
  'nor', 'without', 'lacking', 'missing', 'absent', 'unable', 'cannot',
  'can\'t', 'won\'t', 'don\'t', 'doesn\'t', 'didn\'t', 'isn\'t', 'aren\'t',
  'wasn\'t', 'weren\'t', 'hasn\'t', 'haven\'t', 'hadn\'t', 'wouldn\'t',
  'shouldn\'t', 'couldn\'t', 'mustn\'t', 'needn\'t'
]);

/**
 * Analyze sentiment of text using lexicon-based approach
 */
export function classifySentiment(
  text: string,
  options: SentimentAnalysisOptions = {}
): SentimentResult {
  const { useLLM = false, llmProvider, confidence = 0.6 } = options;
  
  if (useLLM && llmProvider) {
    return analyzeSentimentWithLLM(text, llmProvider);
  }
  
  return analyzeSentimentWithLexicon(text);
}

/**
 * Analyze sentiment using lexicon-based scoring
 */
function analyzeSentimentWithLexicon(text: string): SentimentResult {
  const words = tokenizeText(text);
  const scores = { positive: 0, negative: 0, neutral: 0 };
  const keywords = { positive: [] as string[], negative: [] as string[] };
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();
    const nextWord = i + 1 < words.length ? words[i + 1].toLowerCase() : '';
    const prevWord = i > 0 ? words[i - 1].toLowerCase() : '';
    
    let sentiment = 0;
    let keyword = '';
    
    // Check for positive words
    if (POSITIVE_WORDS.has(word)) {
      sentiment = 1;
      keyword = words[i];
    }
    // Check for negative words
    else if (NEGATIVE_WORDS.has(word)) {
      sentiment = -1;
      keyword = words[i];
    }
    
    // Apply intensifiers
    if (INTENSIFIERS.has(prevWord)) {
      sentiment *= 1.5;
    }
    
    // Apply negation
    if (NEGATION_WORDS.has(prevWord) || NEGATION_WORDS.has(nextWord)) {
      sentiment *= -1;
    }
    
    // Update scores
    if (sentiment > 0) {
      scores.positive += sentiment;
      keywords.positive.push(keyword);
    } else if (sentiment < 0) {
      scores.negative += Math.abs(sentiment);
      keywords.negative.push(keyword);
    } else {
      scores.neutral += 1;
    }
  }
  
  // Determine overall sentiment
  const totalScore = scores.positive + scores.negative + scores.neutral;
  const positiveRatio = scores.positive / totalScore;
  const negativeRatio = scores.negative / totalScore;
  
  let sentiment: Sentiment;
  let confidence: number;
  
  if (positiveRatio > negativeRatio && positiveRatio > 0.3) {
    sentiment = Sentiment.POS;
    confidence = positiveRatio;
  } else if (negativeRatio > positiveRatio && negativeRatio > 0.3) {
    sentiment = Sentiment.NEG;
    confidence = negativeRatio;
  } else {
    sentiment = Sentiment.NEU;
    confidence = scores.neutral / totalScore;
  }
  
  return {
    sentiment,
    confidence: Math.min(1, confidence),
    scores,
    keywords,
  };
}

/**
 * Analyze sentiment using LLM (placeholder for future implementation)
 */
function analyzeSentimentWithLLM(text: string, provider: string): SentimentResult {
  // This would integrate with an LLM provider for more sophisticated analysis
  // For now, fall back to lexicon-based analysis
  console.warn(`LLM sentiment analysis not implemented for provider: ${provider}`);
  return analyzeSentimentWithLexicon(text);
}

/**
 * Tokenize text into words
 */
function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Analyze sentiment of multiple texts
 */
export function analyzeMultipleSentiments(
  texts: string[],
  options: SentimentAnalysisOptions = {}
): SentimentResult[] {
  return texts.map(text => classifySentiment(text, options));
}

/**
 * Get sentiment distribution from multiple texts
 */
export function getSentimentDistribution(
  results: SentimentResult[]
): { [key in Sentiment]: number } {
  const distribution = {
    [Sentiment.POS]: 0,
    [Sentiment.NEU]: 0,
    [Sentiment.NEG]: 0,
  };
  
  for (const result of results) {
    distribution[result.sentiment]++;
  }
  
  return distribution;
}

/**
 * Calculate average sentiment score
 */
export function calculateAverageSentiment(results: SentimentResult[]): number {
  if (results.length === 0) return 0;
  
  let totalScore = 0;
  for (const result of results) {
    const score = result.sentiment === Sentiment.POS ? 1 : 
                  result.sentiment === Sentiment.NEG ? -1 : 0;
    totalScore += score * result.confidence;
  }
  
  return totalScore / results.length;
}

/**
 * Get sentiment trends over time
 */
export function getSentimentTrends(
  results: Array<{ timestamp: Date; sentiment: SentimentResult }>
): Array<{ date: string; sentiment: number; count: number }> {
  const trends = new Map<string, { sentiment: number; count: number }>();
  
  for (const { timestamp, sentiment } of results) {
    const date = timestamp.toISOString().split('T')[0];
    const score = sentiment.sentiment === Sentiment.POS ? 1 : 
                  sentiment.sentiment === Sentiment.NEG ? -1 : 0;
    
    if (!trends.has(date)) {
      trends.set(date, { sentiment: 0, count: 0 });
    }
    
    const trend = trends.get(date)!;
    trend.sentiment += score * sentiment.confidence;
    trend.count++;
  }
  
  return Array.from(trends.entries())
    .map(([date, data]) => ({
      date,
      sentiment: data.sentiment / data.count,
      count: data.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

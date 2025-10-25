/**
 * Comprehensive tests for parser utilities
 */

import { Sentiment } from '@ai-visibility/shared';
import { extractMentions, MentionExtractionOptions } from './mentions';
import { extractCitations, normalizeUrl, extractDomain, CitationExtractionOptions } from './citations';
import { classifySentiment, analyzeMultipleSentiments, getSentimentDistribution } from './sentiment';

describe('Parser Utilities', () => {
  describe('Mention Extraction', () => {
    const testText = `
      1. Asana - Excellent for task management and team collaboration
      2. Trello - Simple kanban boards perfect for small teams  
      3. Monday.com - Highly customizable with great automation features
      4. Notion - All-in-one workspace with project management capabilities
      5. ClickUp - Feature-rich with time tracking and reporting
    `;

    const brands = ['Asana', 'Trello', 'Monday.com', 'Notion', 'ClickUp'];

    it('should extract brand mentions with positions', () => {
      const mentions = extractMentions(testText, brands);
      
      expect(mentions).toHaveLength(5);
      expect(mentions[0]).toMatchObject({
        brand: 'Asana',
        position: 1,
        sentiment: expect.any(String),
        snippet: expect.any(String),
        confidence: expect.any(Number),
      });
    });

    it('should handle fuzzy matching', () => {
      const fuzzyText = 'Asana is great for project management';
      const mentions = extractMentions(fuzzyText, ['Asana']);
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0].brand).toBe('Asana');
    });

    it('should respect allowlist and denylist', () => {
      const options: MentionExtractionOptions = {
        allowlist: ['Asana', 'Trello'],
        denylist: ['Monday.com'],
      };
      
      const mentions = extractMentions(testText, brands, options);
      const mentionedBrands = mentions.map(m => m.brand);
      
      expect(mentionedBrands).toContain('Asana');
      expect(mentionedBrands).toContain('Trello');
      expect(mentionedBrands).not.toContain('Monday.com');
    });

    it('should handle case sensitivity', () => {
      const caseText = 'ASANA is great for teams';
      const mentions = extractMentions(caseText, ['Asana'], { caseSensitive: false });
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0].brand).toBe('Asana');
    });

    it('should extract context snippets', () => {
      const mentions = extractMentions(testText, ['Asana']);
      
      expect(mentions[0].snippet).toContain('Asana');
      expect(mentions[0].snippet.length).toBeGreaterThan(10);
    });

    it('should handle empty text', () => {
      const mentions = extractMentions('', brands);
      expect(mentions).toHaveLength(0);
    });

    it('should handle no matching brands', () => {
      const mentions = extractMentions(testText, ['NonExistentBrand']);
      expect(mentions).toHaveLength(0);
    });
  });

  describe('Citation Parsing', () => {
    const testText = `
      Here are some useful links:
      - https://asana.com/features (excellent tool)
      - https://trello.com/boards (simple kanban)
      - https://monday.com/pricing?utm_source=test&utm_campaign=test
      - https://notion.so/help (all-in-one workspace)
      - https://clickup.com/integrations
    `;

    it('should extract URLs from text', () => {
      const citations = extractCitations(testText);
      
      expect(citations).toHaveLength(5);
      expect(citations[0]).toMatchObject({
        url: expect.stringMatching(/^https?:\/\//),
        domain: expect.any(String),
        confidence: expect.any(Number),
        rank: expect.any(Number),
      });
    });

    it('should normalize URLs by removing UTM parameters', () => {
      const citations = extractCitations(testText, { removeUtm: true });
      const mondayCitation = citations.find(c => c.url.includes('monday.com'));
      
      expect(mondayCitation).toBeDefined();
      expect(mondayCitation!.url).not.toContain('utm_source');
      expect(mondayCitation!.url).not.toContain('utm_campaign');
    });

    it('should extract domains correctly', () => {
      const citations = extractCitations(testText);
      
      expect(citations[0].domain).toBe('asana.com');
      expect(citations[1].domain).toBe('trello.com');
    });

    it('should handle malformed URLs', () => {
      const malformedText = 'Check out https://invalid-url and https://valid.com';
      const citations = extractCitations(malformedText);
      
      // Should only extract valid URLs
      expect(citations.length).toBeGreaterThan(0);
      citations.forEach(citation => {
        expect(citation.url).toMatch(/^https?:\/\//);
      });
    });

    it('should remove duplicate URLs', () => {
      const duplicateText = 'https://asana.com and https://asana.com again';
      const citations = extractCitations(duplicateText);
      
      expect(citations).toHaveLength(1);
      expect(citations[0].url).toBe('https://asana.com');
    });

    it('should handle empty text', () => {
      const citations = extractCitations('');
      expect(citations).toHaveLength(0);
    });

    it('should normalize domains', () => {
      const textWithWww = 'https://www.asana.com and https://blog.asana.com';
      const citations = extractCitations(textWithWww, { normalizeDomains: true });
      
      expect(citations[0].domain).toBe('asana.com');
      expect(citations[1].domain).toBe('asana.com');
    });
  });

  describe('URL Normalization', () => {
    it('should normalize URL with UTM parameters', () => {
      const url = 'https://example.com/page?utm_source=test&utm_campaign=test&other=value';
      const normalized = normalizeUrl(url, { removeUtm: true });
      
      expect(normalized).toBe('https://example.com/page?other=value');
    });

    it('should normalize URL with tracking parameters', () => {
      const url = 'https://example.com/page?fbclid=123&gclid=456&ref=test';
      const normalized = normalizeUrl(url, { removeTracking: true });
      
      expect(normalized).toBe('https://example.com/page');
    });

    it('should extract domain from URL', () => {
      const domain = extractDomain('https://www.example.com/path?query=value');
      expect(domain).toBe('www.example.com');
    });

    it('should handle invalid URLs', () => {
      const normalized = normalizeUrl('not-a-url');
      expect(normalized).toBe('not-a-url');
    });
  });

  describe('Sentiment Analysis', () => {
    it('should classify positive sentiment', () => {
      const result = classifySentiment('This is an excellent tool with amazing features');
      
      expect(result.sentiment).toBe(Sentiment.POS);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.keywords.positive).toContain('excellent');
    });

    it('should classify negative sentiment', () => {
      const result = classifySentiment('This is a terrible tool with poor performance');
      
      expect(result.sentiment).toBe(Sentiment.NEG);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.keywords.negative).toContain('terrible');
    });

    it('should classify neutral sentiment', () => {
      const result = classifySentiment('This is a tool for project management');
      
      expect(result.sentiment).toBe(Sentiment.NEU);
    });

    it('should handle intensifiers', () => {
      const result = classifySentiment('This is very excellent and extremely good');
      
      expect(result.sentiment).toBe(Sentiment.POS);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should handle negation', () => {
      const result = classifySentiment('This is not good and not excellent');
      
      expect(result.sentiment).toBe(Sentiment.NEG);
    });

    it('should analyze multiple texts', () => {
      const texts = [
        'This is excellent',
        'This is terrible',
        'This is okay',
      ];
      
      const results = analyzeMultipleSentiments(texts);
      
      expect(results).toHaveLength(3);
      expect(results[0].sentiment).toBe(Sentiment.POS);
      expect(results[1].sentiment).toBe(Sentiment.NEG);
      expect(results[2].sentiment).toBe(Sentiment.NEU);
    });

    it('should calculate sentiment distribution', () => {
      const results = [
        { sentiment: Sentiment.POS, confidence: 0.8, scores: { positive: 0.8, negative: 0.1, neutral: 0.1 }, keywords: { positive: [], negative: [] } },
        { sentiment: Sentiment.NEG, confidence: 0.7, scores: { positive: 0.1, negative: 0.7, neutral: 0.2 }, keywords: { positive: [], negative: [] } },
        { sentiment: Sentiment.NEU, confidence: 0.6, scores: { positive: 0.2, negative: 0.2, neutral: 0.6 }, keywords: { positive: [], negative: [] } },
      ];
      
      const distribution = getSentimentDistribution(results);
      
      expect(distribution[Sentiment.POS]).toBe(1);
      expect(distribution[Sentiment.NEG]).toBe(1);
      expect(distribution[Sentiment.NEU]).toBe(1);
    });

    it('should handle empty text', () => {
      const result = classifySentiment('');
      
      expect(result.sentiment).toBe(Sentiment.NEU);
      expect(result.confidence).toBe(0);
    });

    it('should handle mixed sentiment', () => {
      const result = classifySentiment('This tool is excellent but has some issues');
      
      // Should lean towards the stronger sentiment
      expect([Sentiment.POS, Sentiment.NEG]).toContain(result.sentiment);
    });
  });

  describe('Edge Cases', () => {
    it('should handle homonyms in mentions', () => {
      const text = 'The root cause is not the plant root';
      const mentions = extractMentions(text, ['root']);
      
      // Should handle context to avoid false positives
      expect(mentions.length).toBeLessThanOrEqual(2);
    });

    it('should handle malformed URLs in citations', () => {
      const text = 'Check out https:// and https://valid.com';
      const citations = extractCitations(text);
      
      expect(citations.length).toBeGreaterThan(0);
      citations.forEach(citation => {
        expect(citation.url).toMatch(/^https?:\/\/.+/);
      });
    });

    it('should handle very long text', () => {
      const longText = 'This is a test. '.repeat(1000);
      const mentions = extractMentions(longText, ['test']);
      
      expect(mentions.length).toBeGreaterThan(0);
    });

    it('should handle special characters in sentiment analysis', () => {
      const text = 'This is @#$%^&*() excellent!!!';
      const result = classifySentiment(text);
      
      expect(result.sentiment).toBe(Sentiment.POS);
    });
  });
});

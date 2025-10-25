/**
 * Tests for content optimizer
 */

import { optimizeContent, OptimizationOptions, ContentMetadata } from './optimizer';
import { createRuleEngine, getDefaultRuleConfig } from './rules';

describe('Content Optimizer', () => {
  const sampleContent = `
# Project Management Tools for Small Teams

## Introduction
Managing projects effectively is crucial for small teams. Here are the best tools:

## Top Tools

### 1. Asana
Asana is excellent for task management and team collaboration.

### 2. Trello
Trello offers simple kanban boards perfect for small teams.

### 3. Monday.com
Monday.com is highly customizable with great automation features.

## FAQ

Q: What is the best tool for beginners?
A: Trello is the most beginner-friendly option.

Q: Which tool has the best automation?
A: Monday.com offers the most advanced automation features.

## Quotes

> "Asana has transformed how we manage our projects" - Team Lead
> "Trello's simplicity is its greatest strength" - Project Manager

## Conclusion
Choose the tool that best fits your team's needs.
  `;

  const sampleMetadata: ContentMetadata = {
    title: 'Best Project Management Tools',
    description: 'A comprehensive guide to project management tools for small teams',
    author: 'AI Visibility Team',
    publishDate: new Date('2024-01-15'),
    tags: ['project-management', 'tools', 'small-teams'],
    category: 'Software',
    vertical: 'Technology',
  };

  const sampleCitations = [
    { url: 'https://asana.com', domain: 'asana.com', confidence: 0.9 },
    { url: 'https://trello.com', domain: 'trello.com', confidence: 0.8 },
    { url: 'https://monday.com', domain: 'monday.com', confidence: 0.85 },
  ];

  describe('Content Optimization', () => {
    it('should optimize content with TL;DR', () => {
      const options: OptimizationOptions = {
        intensity: 2,
        generateTldr: true,
        maxTldrLength: 200,
      };

      const result = optimizeContent(sampleContent, sampleMetadata, sampleCitations, options);

      expect(result.tldr).toBeDefined();
      expect(result.tldr!.length).toBeLessThanOrEqual(200);
      expect(result.optimized).toContain('## TL;DR');
    });

    it('should extract FAQ items', () => {
      const options: OptimizationOptions = {
        intensity: 2,
        generateFaq: true,
        maxFaqItems: 5,
      };

      const result = optimizeContent(sampleContent, sampleMetadata, sampleCitations, options);

      expect(result.faq).toBeDefined();
      expect(result.faq!.length).toBeGreaterThan(0);
      expect(result.faq![0]).toMatchObject({
        question: expect.any(String),
        answer: expect.any(String),
        confidence: expect.any(Number),
      });
    });

    it('should extract quotes', () => {
      const options: OptimizationOptions = {
        intensity: 2,
        extractQuotes: true,
        maxQuotes: 5,
      };

      const result = optimizeContent(sampleContent, sampleMetadata, sampleCitations, options);

      expect(result.quotes).toBeDefined();
      expect(result.quotes!.length).toBeGreaterThan(0);
      expect(result.quotes![0]).toMatchObject({
        text: expect.any(String),
        confidence: expect.any(Number),
      });
    });

    it('should generate JSON-LD schemas', () => {
      const options: OptimizationOptions = {
        intensity: 2,
        generateJsonLd: true,
      };

      const result = optimizeContent(sampleContent, sampleMetadata, sampleCitations, options);

      expect(result.jsonLd).toBeDefined();
      expect(result.jsonLd!.length).toBeGreaterThan(0);
      expect(result.jsonLd![0]).toMatchObject({
        '@context': 'https://schema.org',
        '@type': expect.any(String),
      });
    });

    it('should generate unified diff', () => {
      const options: OptimizationOptions = {
        intensity: 2,
      };

      const result = optimizeContent(sampleContent, sampleMetadata, sampleCitations, options);

      expect(result.diff).toBeDefined();
      expect(result.diff).toContain('--- Original');
      expect(result.diff).toContain('+++ Optimized');
    });

    it('should respect intensity levels', () => {
      const lowIntensityOptions: OptimizationOptions = {
        intensity: 1,
      };

      const highIntensityOptions: OptimizationOptions = {
        intensity: 3,
      };

      const lowResult = optimizeContent(sampleContent, sampleMetadata, sampleCitations, lowIntensityOptions);
      const highResult = optimizeContent(sampleContent, sampleMetadata, sampleCitations, highIntensityOptions);

      // Higher intensity should produce more optimizations
      expect(highResult.optimized.length).toBeGreaterThanOrEqual(lowResult.optimized.length);
    });

    it('should handle empty content', () => {
      const options: OptimizationOptions = {
        intensity: 2,
      };

      const result = optimizeContent('', sampleMetadata, [], options);

      expect(result.original).toBe('');
      expect(result.optimized).toBeDefined();
      expect(result.diff).toBeDefined();
    });

    it('should handle missing metadata', () => {
      const options: OptimizationOptions = {
        intensity: 2,
      };

      const result = optimizeContent(sampleContent, {}, [], options);

      expect(result.metadata).toEqual({});
      expect(result.optimized).toBeDefined();
    });
  });

  describe('Rules Engine', () => {
    it('should create rule engine with default config', () => {
      const config = getDefaultRuleConfig();
      const engine = createRuleEngine(config);

      expect(engine).toBeDefined();
    });

    it('should get rules based on intensity', () => {
      const config = getDefaultRuleConfig();
      config.intensity = 1;
      
      const engine = createRuleEngine(config);
      const rules = engine.getRules(config);

      expect(rules.tldrRules.length).toBeGreaterThan(0);
      expect(rules.faqRules.length).toBeGreaterThan(0);
      expect(rules.quoteRules.length).toBeGreaterThan(0);
      expect(rules.jsonLdRules.length).toBeGreaterThan(0);
    });

    it('should add custom rules', () => {
      const config = getDefaultRuleConfig();
      const engine = createRuleEngine(config);

      const customRule = {
        id: 'custom-tldr',
        type: 'tldr' as const,
        pattern: /^Custom:\s*(.+)$/gm,
        extractor: (match: RegExpMatchArray) => match[1],
        priority: 1,
        enabled: true,
      };

      engine.addCustomRule(customRule);
      engine.updateRuleConfig({ ...config, enabledRules: [...config.enabledRules, 'custom-tldr'] });

      const rules = engine.getRules(config);
      expect(rules.tldrRules.length).toBeGreaterThan(0);
    });

    it('should remove custom rules', () => {
      const config = getDefaultRuleConfig();
      const engine = createRuleEngine(config);

      const customRule = {
        id: 'custom-tldr',
        type: 'tldr' as const,
        pattern: /^Custom:\s*(.+)$/gm,
        extractor: (match: RegExpMatchArray) => match[1],
        priority: 1,
        enabled: true,
      };

      engine.addCustomRule(customRule);
      engine.removeCustomRule('custom-tldr');

      const rules = engine.getRules(config);
      // Should not include the custom rule
      expect(rules.tldrRules.every(rule => rule.pattern.source !== '^Custom:\\s*(.+)$')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle content with no headings', () => {
      const contentWithoutHeadings = 'This is just plain text with no headings.';
      const options: OptimizationOptions = {
        intensity: 2,
        generateTldr: true,
      };

      const result = optimizeContent(contentWithoutHeadings, sampleMetadata, [], options);

      expect(result.tldr).toBeUndefined();
      expect(result.optimized).toBeDefined();
    });

    it('should handle content with no FAQ', () => {
      const contentWithoutFaq = '# Title\n\nThis is content without FAQ.';
      const options: OptimizationOptions = {
        intensity: 2,
        generateFaq: true,
      };

      const result = optimizeContent(contentWithoutFaq, sampleMetadata, [], options);

      expect(result.faq).toEqual([]);
      expect(result.optimized).toBeDefined();
    });

    it('should handle content with no quotes', () => {
      const contentWithoutQuotes = '# Title\n\nThis is content without quotes.';
      const options: OptimizationOptions = {
        intensity: 2,
        extractQuotes: true,
      };

      const result = optimizeContent(contentWithoutQuotes, sampleMetadata, [], options);

      expect(result.quotes).toEqual([]);
      expect(result.optimized).toBeDefined();
    });

    it('should handle very long content', () => {
      const longContent = '# Title\n\n' + 'This is a very long content. '.repeat(1000);
      const options: OptimizationOptions = {
        intensity: 2,
      };

      const result = optimizeContent(longContent, sampleMetadata, [], options);

      expect(result.optimized).toBeDefined();
      expect(result.diff).toBeDefined();
    });

    it('should handle content with special characters', () => {
      const specialContent = '# Title with @#$%^&*()\n\nContent with special characters: @#$%^&*()';
      const options: OptimizationOptions = {
        intensity: 2,
      };

      const result = optimizeContent(specialContent, sampleMetadata, [], options);

      expect(result.optimized).toBeDefined();
      expect(result.diff).toBeDefined();
    });
  });
});

/**
 * Rules engine for content optimization
 * Configurable rules for different optimization strategies
 */

import { OptimizationRules, TldrRule, FaqRule, QuoteRule, JsonLdRule } from './optimizer';

export interface RuleConfig {
  intensity: number;
  enabledRules: string[];
  customRules?: CustomRule[];
}

export interface CustomRule {
  id: string;
  type: 'tldr' | 'faq' | 'quote' | 'jsonld';
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => any;
  priority: number;
  enabled: boolean;
}

export interface RuleEngine {
  getRules(config: RuleConfig): OptimizationRules;
  addCustomRule(rule: CustomRule): void;
  removeCustomRule(ruleId: string): void;
  updateRuleConfig(config: RuleConfig): void;
}

export class ContentRuleEngine implements RuleEngine {
  private customRules: Map<string, CustomRule> = new Map();
  private config: RuleConfig;

  constructor(config: RuleConfig) {
    this.config = config;
  }

  getRules(config: RuleConfig): OptimizationRules {
    this.config = config;
    const baseRules = getBaseRules();
    const customRules = this.getCustomRules();
    
    return this.mergeRules(baseRules, customRules);
  }

  addCustomRule(rule: CustomRule): void {
    this.customRules.set(rule.id, rule);
  }

  removeCustomRule(ruleId: string): void {
    this.customRules.delete(ruleId);
  }

  updateRuleConfig(config: RuleConfig): void {
    this.config = config;
  }

  private getCustomRules(): CustomRule[] {
    return Array.from(this.customRules.values())
      .filter(rule => rule.enabled && this.config.enabledRules.includes(rule.id));
  }

  private mergeRules(baseRules: OptimizationRules, customRules: CustomRule[]): OptimizationRules {
    const rules = { ...baseRules };
    
    for (const customRule of customRules) {
      switch (customRule.type) {
        case 'tldr':
          rules.tldrRules.push({
            pattern: customRule.pattern,
            extractor: customRule.extractor,
            priority: customRule.priority,
          });
          break;
        case 'faq':
          rules.faqRules.push({
            pattern: customRule.pattern,
            questionExtractor: (match) => customRule.extractor(match).question,
            answerExtractor: (match) => customRule.extractor(match).answer,
            priority: customRule.priority,
          });
          break;
        case 'quote':
          rules.quoteRules.push({
            pattern: customRule.pattern,
            extractor: customRule.extractor,
            priority: customRule.priority,
          });
          break;
        case 'jsonld':
          rules.jsonLdRules.push({
            type: customRule.id,
            generator: (content, metadata) => customRule.extractor(content.match(customRule.pattern) || []),
            priority: customRule.priority,
          });
          break;
      }
    }
    
    return rules;
  }
}

/**
 * Get base optimization rules
 */
function getBaseRules(): OptimizationRules {
  return {
    tldrRules: [
      {
        pattern: /^#\s*(.+)$/gm,
        extractor: (match) => match[1],
        priority: 1,
      },
      {
        pattern: /^##\s*(.+)$/gm,
        extractor: (match) => match[1],
        priority: 2,
      },
      {
        pattern: /^###\s*(.+)$/gm,
        extractor: (match) => match[1],
        priority: 3,
      },
      {
        pattern: /^####\s*(.+)$/gm,
        extractor: (match) => match[1],
        priority: 4,
      },
    ],
    faqRules: [
      {
        pattern: /^Q:\s*(.+?)\s*A:\s*(.+)$/gms,
        questionExtractor: (match) => match[1].trim(),
        answerExtractor: (match) => match[2].trim(),
        priority: 1,
      },
      {
        pattern: /^Question:\s*(.+?)\s*Answer:\s*(.+)$/gms,
        questionExtractor: (match) => match[1].trim(),
        answerExtractor: (match) => match[2].trim(),
        priority: 2,
      },
      {
        pattern: /^FAQ:\s*(.+?)\s*Answer:\s*(.+)$/gms,
        questionExtractor: (match) => match[1].trim(),
        answerExtractor: (match) => match[2].trim(),
        priority: 3,
      },
    ],
    quoteRules: [
      {
        pattern: /^>\s*(.+)$/gm,
        extractor: (match) => ({
          text: match[1].trim(),
          confidence: 0.9,
        }),
        priority: 1,
      },
      {
        pattern: /"([^"]+)"/g,
        extractor: (match) => ({
          text: match[1],
          confidence: 0.7,
        }),
        priority: 2,
      },
      {
        pattern: /'([^']+)'/g,
        extractor: (match) => ({
          text: match[1],
          confidence: 0.6,
        }),
        priority: 3,
      },
    ],
    jsonLdRules: [
      {
        type: 'Article',
        generator: generateArticleSchema,
        priority: 1,
      },
      {
        type: 'FAQPage',
        generator: generateFaqPageSchema,
        priority: 2,
      },
      {
        type: 'Organization',
        generator: generateOrganizationSchema,
        priority: 3,
      },
      {
        type: 'Product',
        generator: generateProductSchema,
        priority: 4,
      },
    ],
  };
}

/**
 * Generate Article schema
 */
function generateArticleSchema(content: string, metadata: any): any {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: metadata.title || 'Untitled',
    description: metadata.description || '',
    author: metadata.author ? {
      '@type': 'Person',
      name: metadata.author,
    } : undefined,
    datePublished: metadata.publishDate?.toISOString(),
    articleBody: content,
  };
}

/**
 * Generate FAQPage schema
 */
function generateFaqPageSchema(content: string, metadata: any): any {
  // Extract FAQ items from content
  const faqItems = extractFaqItems(content);
  
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

/**
 * Generate Organization schema
 */
function generateOrganizationSchema(content: string, metadata: any): any {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: metadata.title || 'Organization',
    description: metadata.description || '',
    url: metadata.vertical || '',
  };
}

/**
 * Generate Product schema
 */
function generateProductSchema(content: string, metadata: any): any {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: metadata.title || 'Product',
    description: metadata.description || '',
    category: metadata.category || '',
  };
}

/**
 * Extract FAQ items from content
 */
function extractFaqItems(content: string): Array<{ question: string; answer: string }> {
  const faqItems: Array<{ question: string; answer: string }> = [];
  
  // Look for Q: A: patterns
  const qaPattern = /^Q:\s*(.+?)\s*A:\s*(.+)$/gms;
  let match;
  
  while ((match = qaPattern.exec(content)) !== null) {
    faqItems.push({
      question: match[1].trim(),
      answer: match[2].trim(),
    });
  }
  
  return faqItems;
}

/**
 * Create rule engine instance
 */
export function createRuleEngine(config: RuleConfig): RuleEngine {
  return new ContentRuleEngine(config);
}

/**
 * Get default rule configuration
 */
export function getDefaultRuleConfig(): RuleConfig {
  return {
    intensity: 2,
    enabledRules: ['tldr', 'faq', 'quote', 'jsonld'],
    customRules: [],
  };
}

/**
 * Validate rule configuration
 */
export function validateRuleConfig(config: RuleConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (config.intensity < 1 || config.intensity > 3) {
    errors.push('Intensity must be between 1 and 3');
  }
  
  if (!Array.isArray(config.enabledRules)) {
    errors.push('enabledRules must be an array');
  }
  
  if (config.customRules && !Array.isArray(config.customRules)) {
    errors.push('customRules must be an array');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

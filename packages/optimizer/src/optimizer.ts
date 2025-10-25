/**
 * Content optimization utilities
 * Transforms content with TL;DR, FAQ, quotes, and JSON-LD
 */

// Define Citation interface locally to avoid build order issues
export interface Citation {
  url: string;
  domain: string;
  confidence?: number;
  rank?: number;
}

export interface ContentMetadata {
  title?: string;
  description?: string;
  author?: string;
  publishDate?: Date;
  tags?: string[];
  category?: string;
  vertical?: string;
}

export interface OptimizationOptions {
  intensity: number; // 1-3
  generateTldr?: boolean;
  generateFaq?: boolean;
  extractQuotes?: boolean;
  generateJsonLd?: boolean;
  maxTldrLength?: number;
  maxFaqItems?: number;
  maxQuotes?: number;
}

export interface OptimizedContent {
  original: string;
  optimized: string;
  tldr?: string;
  faq?: FAQItem[];
  quotes?: Quote[];
  jsonLd?: JsonLdSchema[];
  diff: string;
  metadata: ContentMetadata;
  citations: Citation[];
}

export interface FAQItem {
  question: string;
  answer: string;
  confidence: number;
}

export interface Quote {
  text: string;
  author?: string;
  source?: string;
  confidence: number;
}

export interface JsonLdSchema {
  '@context': string;
  '@type': string;
  [key: string]: any;
}

export interface OptimizationRules {
  tldrRules: TldrRule[];
  faqRules: FaqRule[];
  quoteRules: QuoteRule[];
  jsonLdRules: JsonLdRule[];
}

export interface TldrRule {
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => string;
  priority: number;
}

export interface FaqRule {
  pattern: RegExp;
  questionExtractor: (match: RegExpMatchArray) => string;
  answerExtractor: (match: RegExpMatchArray) => string;
  priority: number;
}

export interface QuoteRule {
  pattern: RegExp;
  extractor: (match: RegExpMatchArray) => Quote;
  priority: number;
}

export interface JsonLdRule {
  type: string;
  generator: (content: string, metadata: ContentMetadata) => JsonLdSchema;
  priority: number;
}

/**
 * Optimize content with various enhancements
 */
export function optimizeContent(
  content: string,
  metadata: ContentMetadata,
  citations: Citation[],
  options: OptimizationOptions
): OptimizedContent {
  const rules = getOptimizationRules(options.intensity);
  let optimized = content;
  const changes: string[] = [];

  // Generate TL;DR
  if (options.generateTldr !== false) {
    const tldr = generateTldr(content, rules.tldrRules, options.maxTldrLength);
    if (tldr) {
      optimized = addTldrToContent(optimized, tldr);
      changes.push('Added TL;DR section');
    }
  }

  // Generate FAQ
  if (options.generateFaq !== false) {
    const faq = generateFaq(content, rules.faqRules, options.maxFaqItems);
    if (faq.length > 0) {
      optimized = addFaqToContent(optimized, faq);
      changes.push(`Added ${faq.length} FAQ items`);
    }
  }

  // Extract quotes
  if (options.extractQuotes !== false) {
    const quotes = extractQuotes(content, rules.quoteRules, options.maxQuotes);
    if (quotes.length > 0) {
      optimized = addQuotesToContent(optimized, quotes);
      changes.push(`Added ${quotes.length} quotes`);
    }
  }

  // Generate JSON-LD
  let jsonLd: JsonLdSchema[] = [];
  if (options.generateJsonLd !== false) {
    jsonLd = generateJsonLd(content, metadata, citations, rules.jsonLdRules);
    if (jsonLd.length > 0) {
      optimized = addJsonLdToContent(optimized, jsonLd);
      changes.push(`Added ${jsonLd.length} JSON-LD schemas`);
    }
  }

  return {
    original: content,
    optimized,
    tldr: generateTldr(content, rules.tldrRules, options.maxTldrLength),
    faq: generateFaq(content, rules.faqRules, options.maxFaqItems),
    quotes: extractQuotes(content, rules.quoteRules, options.maxQuotes),
    jsonLd,
    diff: generateUnifiedDiff(content, optimized),
    metadata,
    citations,
  };
}

/**
 * Get optimization rules based on intensity
 */
function getOptimizationRules(intensity: number): OptimizationRules {
  const baseRules = getBaseRules();
  
  if (intensity === 1) {
    return filterRulesByIntensity(baseRules, 1);
  } else if (intensity === 2) {
    return filterRulesByIntensity(baseRules, 2);
  } else {
    return baseRules; // intensity 3
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
    ],
  };
}

/**
 * Filter rules by intensity level
 */
function filterRulesByIntensity(rules: OptimizationRules, intensity: number): OptimizationRules {
  return {
    tldrRules: rules.tldrRules.filter(rule => rule.priority <= intensity),
    faqRules: rules.faqRules.filter(rule => rule.priority <= intensity),
    quoteRules: rules.quoteRules.filter(rule => rule.priority <= intensity),
    jsonLdRules: rules.jsonLdRules.filter(rule => rule.priority <= intensity),
  };
}

/**
 * Generate TL;DR from content
 */
function generateTldr(content: string, rules: TldrRule[], maxLength?: number): string | undefined {
  const headings: string[] = [];
  
  for (const rule of rules) {
    const matches = content.match(rule.pattern);
    if (matches) {
      for (const match of matches) {
        const heading = rule.extractor([match]);
        headings.push(heading);
      }
    }
  }
  
  if (headings.length === 0) {
    return undefined;
  }
  
  let tldr = headings.join(', ');
  
  if (maxLength && tldr.length > maxLength) {
    tldr = tldr.substring(0, maxLength) + '...';
  }
  
  return tldr;
}

/**
 * Generate FAQ from content
 */
function generateFaq(content: string, rules: FaqRule[], maxItems?: number): FAQItem[] {
  const faqItems: FAQItem[] = [];
  
  for (const rule of rules) {
    const matches = content.match(rule.pattern);
    if (matches) {
      for (const match of matches) {
        const question = rule.questionExtractor([match]);
        const answer = rule.answerExtractor([match]);
        
        faqItems.push({
          question,
          answer,
          confidence: 0.8,
        });
      }
    }
  }
  
  if (maxItems && faqItems.length > maxItems) {
    return faqItems.slice(0, maxItems);
  }
  
  return faqItems;
}

/**
 * Extract quotes from content
 */
function extractQuotes(content: string, rules: QuoteRule[], maxQuotes?: number): Quote[] {
  const quotes: Quote[] = [];
  
  for (const rule of rules) {
    const matches = content.match(rule.pattern);
    if (matches) {
      for (const match of matches) {
        const quote = rule.extractor([match]);
        quotes.push(quote);
      }
    }
  }
  
  if (maxQuotes && quotes.length > maxQuotes) {
    return quotes.slice(0, maxQuotes);
  }
  
  return quotes;
}

/**
 * Generate JSON-LD schemas
 */
function generateJsonLd(
  content: string,
  metadata: ContentMetadata,
  citations: Citation[],
  rules: JsonLdRule[]
): JsonLdSchema[] {
  const schemas: JsonLdSchema[] = [];
  
  for (const rule of rules) {
    try {
      const schema = rule.generator(content, metadata);
      schemas.push(schema);
    } catch (error) {
      console.warn(`Failed to generate ${rule.type} schema:`, error);
    }
  }
  
  return schemas;
}

/**
 * Generate Article schema
 */
function generateArticleSchema(content: string, metadata: ContentMetadata): JsonLdSchema {
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
function generateFaqPageSchema(content: string, metadata: ContentMetadata): JsonLdSchema {
  // This would extract FAQ items from content
  const faqItems: Array<{question: string; answer: string}> = []; // Placeholder
  
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
function generateOrganizationSchema(content: string, metadata: ContentMetadata): JsonLdSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: metadata.title || 'Organization',
    description: metadata.description || '',
    url: metadata.vertical || '',
  };
}

/**
 * Add TL;DR to content
 */
function addTldrToContent(content: string, tldr: string): string {
  const tldrSection = `\n\n## TL;DR\n${tldr}\n`;
  return content + tldrSection;
}

/**
 * Add FAQ to content
 */
function addFaqToContent(content: string, faq: FAQItem[]): string {
  if (faq.length === 0) return content;
  
  let faqSection = '\n\n## FAQ\n';
  faq.forEach((item, index) => {
    faqSection += `\n**Q${index + 1}:** ${item.question}\n\n**A${index + 1}:** ${item.answer}\n`;
  });
  
  return content + faqSection;
}

/**
 * Add quotes to content
 */
function addQuotesToContent(content: string, quotes: Quote[]): string {
  if (quotes.length === 0) return content;
  
  let quotesSection = '\n\n## Key Quotes\n';
  quotes.forEach((quote, index) => {
    quotesSection += `\n> "${quote.text}"${quote.author ? ` - ${quote.author}` : ''}\n`;
  });
  
  return content + quotesSection;
}

/**
 * Add JSON-LD to content
 */
function addJsonLdToContent(content: string, jsonLd: JsonLdSchema[]): string {
  if (jsonLd.length === 0) return content;
  
  const jsonLdScript = jsonLd.map(schema => 
    `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`
  ).join('\n\n');
  
  return content + `\n\n${jsonLdScript}`;
}

/**
 * Generate unified diff between original and optimized content
 */
function generateUnifiedDiff(original: string, optimized: string): string {
  const originalLines = original.split('\n');
  const optimizedLines = optimized.split('\n');
  
  let diff = '--- Original\n+++ Optimized\n';
  
  // Simple diff implementation
  const maxLines = Math.max(originalLines.length, optimizedLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const originalLine = originalLines[i] || '';
    const optimizedLine = optimizedLines[i] || '';
    
    if (originalLine === optimizedLine) {
      diff += ` ${originalLine}\n`;
    } else if (!originalLine) {
      diff += `+${optimizedLine}\n`;
    } else if (!optimizedLine) {
      diff += `-${originalLine}\n`;
    } else {
      diff += `-${originalLine}\n`;
      diff += `+${optimizedLine}\n`;
    }
  }
  
  return diff;
}

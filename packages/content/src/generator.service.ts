import { Injectable } from '@nestjs/common';
import { LLMRouterService, LLMConfigService } from '@ai-visibility/shared';

export interface ContentGenerationRequest {
  type: 'blog' | 'faq' | 'landing' | 'social';
  topic: string;
  brandName: string;
  industry?: string;
  tone?: 'professional' | 'casual' | 'friendly' | 'authoritative';
  length?: 'short' | 'medium' | 'long';
  keywords?: string[];
  includeCitations?: boolean;
  includeSchema?: boolean;
}

export interface GeneratedContent {
  id: string;
  type: string;
  title: string;
  content: string;
  metaDescription?: string;
  keywords: string[];
  citations?: string[];
  schema?: any;
  cost: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  createdAt: Date;
}

@Injectable()
export class ContentGeneratorService {
  constructor(
    private llmRouter: LLMRouterService,
    private llmConfig: LLMConfigService
  ) {}

  /**
   * Generate GEO-optimized content
   */
  async generateContent(
    workspaceId: string,
    request: ContentGenerationRequest
  ): Promise<GeneratedContent> {
    const prompt = this.buildPrompt(request);
    const config = await this.llmConfig.getWorkspaceLLMConfig(workspaceId);
    
    const response = await this.llmRouter.routeLLMRequest(
      workspaceId,
      prompt,
      {
        model: config.model,
        maxTokens: this.getMaxTokens(request.length),
        temperature: this.getTemperature(request.tone),
        brandName: request.brandName,
      }
    );

    const content = this.parseGeneratedContent(response.content, request);
    
    // Track usage
    await this.llmRouter.trackUsage(
      workspaceId,
      config.provider,
      config.model,
      response.tokens?.prompt || 0,
      response.tokens?.completion || 0,
      response.cost
    );

    return {
      id: this.generateId(),
      type: request.type,
      title: content.title,
      content: content.body,
      metaDescription: content.metaDescription,
      keywords: content.keywords,
      citations: content.citations,
      schema: request.includeSchema ? this.generateSchema(content, request) : undefined,
      cost: response.cost,
      tokens: response.tokens || { prompt: 0, completion: 0, total: 0 },
      createdAt: new Date(),
    };
  }

  /**
   * Build prompt for content generation
   */
  private buildPrompt(request: ContentGenerationRequest): string {
    const templates = {
      blog: this.getBlogTemplate(),
      faq: this.getFAQTemplate(),
      landing: this.getLandingTemplate(),
      social: this.getSocialTemplate(),
    };

    const template = templates[request.type];
    
    return template
      .replace('{{TOPIC}}', request.topic)
      .replace('{{BRAND}}', request.brandName)
      .replace('{{INDUSTRY}}', request.industry || 'business')
      .replace('{{TONE}}', request.tone || 'professional')
      .replace('{{LENGTH}}', request.length || 'medium')
      .replace('{{KEYWORDS}}', request.keywords?.join(', ') || '')
      .replace('{{CITATIONS}}', request.includeCitations ? 'Include relevant citations and sources.' : '');
  }

  /**
   * Parse generated content into structured format
   */
  private parseGeneratedContent(content: string, request: ContentGenerationRequest): {
    title: string;
    body: string;
    metaDescription: string;
    keywords: string[];
    citations: string[];
  } {
    // Extract title (usually first line or after #)
    const titleMatch = content.match(/^#\s*(.+)$/m) || content.match(/^(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : `${request.topic} - ${request.brandName}`;

    // Extract meta description (look for description: or similar)
    const descriptionMatch = content.match(/description:\s*(.+)$/im);
    const metaDescription = descriptionMatch ? descriptionMatch[1].trim() : 
      `${content.substring(0, 150)}...`;

    // Extract keywords
    const keywordsMatch = content.match(/keywords:\s*(.+)$/im);
    const keywords = keywordsMatch ? 
      keywordsMatch[1].split(',').map(k => k.trim()) : 
      request.keywords || [];

    // Extract citations
    const citations = this.extractCitations(content);

    // Clean up body content
    const body = content
      .replace(/^#\s*.+$/m, '') // Remove title
      .replace(/description:\s*.+$/im, '') // Remove description
      .replace(/keywords:\s*.+$/im, '') // Remove keywords
      .trim();

    return {
      title,
      body,
      metaDescription,
      keywords,
      citations,
    };
  }

  /**
   * Extract citations from content
   */
  private extractCitations(content: string): string[] {
    const citationPatterns = [
      /\[(\d+)\]/g, // [1], [2], etc.
      /\(([^)]+)\)/g, // (source), (reference)
      /https?:\/\/[^\s]+/g, // URLs
    ];

    const citations: string[] = [];
    
    for (const pattern of citationPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        citations.push(...matches);
      }
    }

    return [...new Set(citations)]; // Remove duplicates
  }

  /**
   * Generate JSON-LD schema for content
   */
  private generateSchema(content: any, request: ContentGenerationRequest): any {
    const baseSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: content.title,
      description: content.metaDescription,
      author: {
        '@type': 'Organization',
        name: request.brandName,
      },
      publisher: {
        '@type': 'Organization',
        name: request.brandName,
      },
      datePublished: new Date().toISOString(),
      keywords: content.keywords.join(', '),
    };

    // Add specific schema based on content type
    switch (request.type) {
      case 'faq':
        return {
          ...baseSchema,
          '@type': 'FAQPage',
          mainEntity: content.keywords.map(keyword => ({
            '@type': 'Question',
            name: `What is ${keyword}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: content.body,
            },
          })),
        };
      
      case 'landing':
        return {
          ...baseSchema,
          '@type': 'WebPage',
          about: {
            '@type': 'Thing',
            name: request.topic,
          },
        };
      
      default:
        return baseSchema;
    }
  }

  /**
   * Get content templates
   */
  private getBlogTemplate(): string {
    return `Write a comprehensive blog post about {{TOPIC}} for {{BRAND}}, a {{INDUSTRY}} company.

Requirements:
- Tone: {{TONE}}
- Length: {{LENGTH}}
- Include relevant keywords: {{KEYWORDS}}
- {{CITATIONS}}
- Optimize for AI search engines
- Include structured data markup suggestions
- Write in a way that AI engines will cite and reference

Format your response as:
# [Title]

Description: [Meta description]

Keywords: [Comma-separated keywords]

[Blog post content with proper headings, subheadings, and citations]`;
  }

  private getFAQTemplate(): string {
    return `Create a comprehensive FAQ section about {{TOPIC}} for {{BRAND}}, a {{INDUSTRY}} company.

Requirements:
- Tone: {{TONE}}
- Length: {{LENGTH}}
- Include relevant keywords: {{KEYWORDS}}
- {{CITATIONS}}
- Optimize for AI search engines
- Include structured data markup suggestions
- Write answers that AI engines will cite

Format your response as:
# {{TOPIC}} FAQ - {{BRAND}}

Description: [Meta description]

Keywords: [Comma-separated keywords]

[FAQ content with Q&A format]`;
  }

  private getLandingTemplate(): string {
    return `Create a landing page content about {{TOPIC}} for {{BRAND}}, a {{INDUSTRY}} company.

Requirements:
- Tone: {{TONE}}
- Length: {{LENGTH}}
- Include relevant keywords: {{KEYWORDS}}
- {{CITATIONS}}
- Optimize for AI search engines
- Include structured data markup suggestions
- Write compelling copy that AI engines will reference

Format your response as:
# {{TOPIC}} - {{BRAND}}

Description: [Meta description]

Keywords: [Comma-separated keywords]

[Landing page content with hero section, features, benefits, and CTA]`;
  }

  private getSocialTemplate(): string {
    return `Create social media content about {{TOPIC}} for {{BRAND}}, a {{INDUSTRY}} company.

Requirements:
- Tone: {{TONE}}
- Length: {{LENGTH}}
- Include relevant keywords: {{KEYWORDS}}
- {{CITATIONS}}
- Optimize for AI search engines
- Create engaging content that AI engines will reference

Format your response as:
# {{TOPIC}} Social Media Content - {{BRAND}}

Description: [Meta description]

Keywords: [Comma-separated keywords]

[Social media posts for different platforms]`;
  }

  /**
   * Helper methods
   */
  private getMaxTokens(length?: string): number {
    switch (length) {
      case 'short': return 500;
      case 'long': return 2000;
      case 'medium':
      default: return 1000;
    }
  }

  private getTemperature(tone?: string): number {
    switch (tone) {
      case 'casual': return 0.8;
      case 'friendly': return 0.7;
      case 'authoritative': return 0.3;
      case 'professional':
      default: return 0.5;
    }
  }

  private generateId(): string {
    return `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}


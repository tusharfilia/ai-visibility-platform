import { Injectable } from '@nestjs/common';
import { LLMRouterService } from '@ai-visibility/shared';

export interface PromptGenerationOptions {
  industry?: string;
  intent?: 'recommendation' | 'comparison' | 'review' | 'howto' | 'location' | 'general';
  tone?: 'professional' | 'casual' | 'friendly';
  length?: 'short' | 'medium' | 'long';
  includeLocation?: boolean;
  includeComparison?: boolean;
}

export interface GeneratedPrompt {
  text: string;
  intent: string;
  confidence: number;
  variations: string[];
}

@Injectable()
export class PromptGeneratorService {
  constructor(private llmRouter: LLMRouterService) {}

  /**
   * Generate candidate prompts for a specific industry and intent
   */
  async generatePrompts(
    workspaceId: string,
    options: PromptGenerationOptions = {}
  ): Promise<GeneratedPrompt[]> {
    const {
      industry = 'general',
      intent = 'general',
      tone = 'professional',
      length = 'medium',
      includeLocation = false,
      includeComparison = false
    } = options;

    try {
      const prompt = this.buildGenerationPrompt({
        industry,
        intent,
        tone,
        length,
        includeLocation,
        includeComparison
      });

      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt);
      const content = response.content || response.text || '';
      const generatedPrompts = this.parseGeneratedPrompts(content);

      return generatedPrompts;
    } catch (error) {
      console.error('Prompt generation failed:', error);
      throw new Error(`Failed to generate prompts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate variations of an existing prompt
   */
  async generateVariations(
    workspaceId: string,
    basePrompt: string,
    count: number = 5
  ): Promise<string[]> {
    const prompt = `Generate ${count} variations of this search query while keeping the same intent:
    
    Original: "${basePrompt}"
    
    Create variations that:
    - Use different wording but same meaning
    - Include synonyms and alternative phrases
    - Maintain the same search intent
    - Are natural and conversational
    
    Return as a JSON array of strings.`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt);
      const content = response.content || response.text || '[]';
      const variations = JSON.parse(content);
      
      return Array.isArray(variations) ? variations : [];
    } catch (error) {
      console.error('Variation generation failed:', error);
      return [];
    }
  }

  /**
   * Optimize prompts for AI visibility
   */
  async optimizePrompt(
    workspaceId: string,
    originalPrompt: string,
    targetIntent: string
  ): Promise<GeneratedPrompt> {
    const prompt = `Optimize this search query for better AI visibility and more comprehensive results:
    
    Original: "${originalPrompt}"
    Target Intent: ${targetIntent}
    
    Create an optimized version that:
    - Is more specific and actionable
    - Includes relevant keywords
    - Encourages detailed AI responses
    - Is likely to generate comprehensive answers
    - Maintains natural language flow
    
    Return a JSON object with:
    - optimized: The optimized prompt
    - reasoning: Brief explanation of changes
    - confidence: Confidence score (0-1)`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt);
      const content = response.content || response.text || '{}';
      const optimization = JSON.parse(content);
      
      return {
        text: optimization.optimized || originalPrompt,
        intent: targetIntent,
        confidence: optimization.confidence || 0.7,
        variations: await this.generateVariations(workspaceId, optimization.optimized || originalPrompt)
      };
    } catch (error) {
      console.error('Prompt optimization failed:', error);
      return {
        text: originalPrompt,
        intent: targetIntent,
        confidence: 0.5,
        variations: []
      };
    }
  }

  /**
   * Generate prompts for competitor analysis
   */
  async generateCompetitorPrompts(
    workspaceId: string,
    industry: string,
    competitorNames: string[]
  ): Promise<GeneratedPrompt[]> {
    const competitorList = competitorNames.join(', ');
    
    const prompt = `Generate search queries that would help analyze competitors in the ${industry} industry.
    
    Competitors: ${competitorList}
    
    Create queries that would reveal:
    - How competitors are positioned in AI search results
    - What customers say about competitors
    - Comparison opportunities
    - Market gaps and opportunities
    - Customer pain points competitors address
    
    Generate 15 queries that would be useful for competitive analysis.
    Return as a JSON array of objects with:
    - query: The search query
    - intent: The analysis intent (positioning, comparison, reviews, etc.)
    - confidence: Confidence score (0-1)`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt);
      const content = response.content || response.text || '[]';
      const competitorPrompts = JSON.parse(content);
      
      return competitorPrompts.map((p: any) => ({
        text: p.query,
        intent: p.intent || 'competitor_analysis',
        confidence: p.confidence || 0.7,
        variations: []
      }));
    } catch (error) {
      console.error('Competitor prompt generation failed:', error);
      return [];
    }
  }

  /**
   * Generate prompts for brand monitoring
   */
  async generateBrandMonitoringPrompts(
    workspaceId: string,
    brandName: string,
    industry: string
  ): Promise<GeneratedPrompt[]> {
    const prompt = `Generate search queries to monitor how "${brandName}" appears in AI search results for the ${industry} industry.
    
    Create queries that would reveal:
    - How the brand is mentioned in AI responses
    - What customers say about the brand
    - Brand positioning vs competitors
    - Brand reputation and sentiment
    - Brand visibility across different topics
    
    Generate 12 queries for brand monitoring.
    Return as a JSON array of objects with:
    - query: The search query
    - intent: The monitoring intent (mentions, sentiment, positioning, etc.)
    - confidence: Confidence score (0-1)`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt);
      const content = response.content || response.text || '[]';
      const brandPrompts = JSON.parse(content);
      
      return brandPrompts.map((p: any) => ({
        text: p.query,
        intent: p.intent || 'brand_monitoring',
        confidence: p.confidence || 0.7,
        variations: []
      }));
    } catch (error) {
      console.error('Brand monitoring prompt generation failed:', error);
      return [];
    }
  }

  /**
   * Build the generation prompt based on options
   */
  private buildGenerationPrompt(options: PromptGenerationOptions): string {
    const {
      industry,
      intent,
      tone,
      length,
      includeLocation,
      includeComparison
    } = options;

    let prompt = `Generate 15 search queries for the ${industry} industry that would lead to comprehensive AI-powered search results.

    Intent: ${intent}
    Tone: ${tone}
    Length: ${length}`;

    if (includeLocation) {
      prompt += '\nInclude location-based queries (e.g., "near me", "in [city]")';
    }

    if (includeComparison) {
      prompt += '\nInclude comparison queries (e.g., "X vs Y", "best X compared to Y")';
    }

    prompt += `\n\nFocus on queries that would:
    - Generate detailed AI responses
    - Include recommendations and comparisons
    - Cover different aspects of the industry
    - Be commonly searched by customers
    - Lead to comprehensive answers

    Return as a JSON array of objects with:
    - query: The search query
    - intent: The specific intent (recommendation, comparison, review, etc.)
    - confidence: Confidence score (0-1)`;

    return prompt;
  }

  /**
   * Parse generated prompts from LLM response
   */
  private parseGeneratedPrompts(response: string): GeneratedPrompt[] {
    try {
      const parsed = JSON.parse(response);
      
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          text: typeof item === 'string' ? item : item.query || item.text,
          intent: item.intent || 'general',
          confidence: item.confidence || 0.7,
          variations: []
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to parse generated prompts:', error);
      return [];
    }
  }

  /**
   * Validate prompt quality
   */
  validatePrompt(prompt: string): { valid: boolean; score: number; issues: string[] } {
    const issues: string[] = [];
    let score = 1.0;

    // Check length
    if (prompt.length < 10) {
      issues.push('Too short');
      score -= 0.3;
    } else if (prompt.length > 200) {
      issues.push('Too long');
      score -= 0.2;
    }

    // Check for common issues
    if (prompt.includes('??') || prompt.includes('!!')) {
      issues.push('Contains excessive punctuation');
      score -= 0.1;
    }

    if (prompt.toLowerCase().includes('please') || prompt.toLowerCase().includes('thank you')) {
      issues.push('Too polite for search query');
      score -= 0.1;
    }

    // Check for good characteristics
    if (prompt.includes('best') || prompt.includes('top') || prompt.includes('recommend')) {
      score += 0.1;
    }

    if (prompt.includes('vs') || prompt.includes('compare') || prompt.includes('difference')) {
      score += 0.1;
    }

    return {
      valid: score >= 0.5,
      score: Math.max(0, Math.min(1, score)),
      issues
    };
  }
}
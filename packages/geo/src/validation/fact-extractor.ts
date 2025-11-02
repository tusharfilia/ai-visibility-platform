import { Injectable } from '@nestjs/common';
import { LLMRouterService } from '@ai-visibility/shared/llm-router';

export interface ExtractedFact {
  type: 'address' | 'hours' | 'phone' | 'services' | 'description' | 'website' | 'email';
  value: string;
  confidence: number;
  context: string;
  source: string;
}

export interface FactValidationResult {
  fact: ExtractedFact;
  isValid: boolean;
  confidence: number;
  expectedValue?: string;
  discrepancy?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface HallucinationDetectionResult {
  hallucinations: FactValidationResult[];
  totalFacts: number;
  hallucinationRate: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

@Injectable()
export class FactExtractorService {
  constructor(private llmRouter: LLMRouterService) {}

  /**
   * Extract structured facts from AI response
   */
  async extractFacts(
    workspaceId: string,
    aiResponse: string,
    engineKey: string
  ): Promise<ExtractedFact[]> {
    try {
      const prompt = this.buildFactExtractionPrompt(aiResponse);
      
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt);
      const extractedFacts = this.parseExtractedFacts(response.content);
      
      return extractedFacts.map(fact => ({
        ...fact,
        source: engineKey,
        confidence: fact.confidence || 0.7
      }));
    } catch (error) {
      console.error('Fact extraction failed:', error);
      return [];
    }
  }

  /**
   * Extract facts from multiple AI responses
   */
  async extractFactsFromMultipleResponses(
    workspaceId: string,
    responses: Array<{ content: string; engine: string }>
  ): Promise<ExtractedFact[]> {
    const allFacts: ExtractedFact[] = [];
    
    for (const response of responses) {
      const facts = await this.extractFacts(
        workspaceId,
        response.content,
        response.engine
      );
      allFacts.push(...facts);
    }
    
    return this.deduplicateFacts(allFacts);
  }

  /**
   * Extract competitor mentions from AI response
   */
  async extractCompetitorMentions(
    workspaceId: string,
    aiResponse: string,
    competitors: string[]
  ): Promise<Array<{
    competitor: string;
    context: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
  }>> {
    try {
      const prompt = this.buildCompetitorExtractionPrompt(aiResponse, competitors);
      
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt);
      const mentions = this.parseCompetitorMentions(response.content);
      
      return mentions;
    } catch (error) {
      console.error('Competitor mention extraction failed:', error);
      return [];
    }
  }

  /**
   * Extract business information from website content
   */
  async extractBusinessInfo(
    workspaceId: string,
    websiteContent: string
  ): Promise<ExtractedFact[]> {
    try {
      const prompt = this.buildBusinessInfoExtractionPrompt(websiteContent);
      
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt);
      const businessInfo = this.parseBusinessInfo(response.content);
      
      return businessInfo;
    } catch (error) {
      console.error('Business info extraction failed:', error);
      return [];
    }
  }

  /**
   * Build fact extraction prompt
   */
  private buildFactExtractionPrompt(aiResponse: string): string {
    return `Extract structured business facts from this AI response. Look for:

1. Business address (street, city, state, zip)
2. Business hours (opening/closing times)
3. Phone number
4. Services offered
5. Business description
6. Website URL
7. Email address

AI Response: "${aiResponse}"

Return a JSON array of objects with:
- type: one of "address", "hours", "phone", "services", "description", "website", "email"
- value: the extracted value
- confidence: confidence score (0-1)
- context: the surrounding text where this fact was found

Example:
[
  {
    "type": "address",
    "value": "123 Main St, New York, NY 10001",
    "confidence": 0.9,
    "context": "Located at 123 Main St, New York, NY 10001"
  }
]`;
  }

  /**
   * Build competitor extraction prompt
   */
  private buildCompetitorExtractionPrompt(aiResponse: string, competitors: string[]): string {
    return `Extract mentions of these competitors from the AI response: ${competitors.join(', ')}

AI Response: "${aiResponse}"

Return a JSON array of objects with:
- competitor: the competitor name mentioned
- context: the surrounding text
- sentiment: "positive", "neutral", or "negative"
- confidence: confidence score (0-1)

Example:
[
  {
    "competitor": "Competitor A",
    "context": "Competitor A offers similar services",
    "sentiment": "neutral",
    "confidence": 0.8
  }
]`;
  }

  /**
   * Build business info extraction prompt
   */
  private buildBusinessInfoExtractionPrompt(websiteContent: string): string {
    return `Extract business information from this website content:

"${websiteContent}"

Return a JSON array of objects with:
- type: one of "address", "hours", "phone", "services", "description", "website", "email"
- value: the extracted value
- confidence: confidence score (0-1)
- context: the surrounding text where this fact was found

Focus on finding:
- Business address
- Contact information (phone, email)
- Business hours
- Services or products offered
- Business description

Example:
[
  {
    "type": "phone",
    "value": "(555) 123-4567",
    "confidence": 0.95,
    "context": "Call us at (555) 123-4567"
  }
]`;
  }

  /**
   * Parse extracted facts from LLM response
   */
  private parseExtractedFacts(response: string): ExtractedFact[] {
    try {
      const parsed = JSON.parse(response);
      
      if (Array.isArray(parsed)) {
        return parsed.map((fact: any) => ({
          type: fact.type,
          value: fact.value,
          confidence: fact.confidence || 0.7,
          context: fact.context || '',
          source: ''
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to parse extracted facts:', error);
      return [];
    }
  }

  /**
   * Parse competitor mentions from LLM response
   */
  private parseCompetitorMentions(response: string): Array<{
    competitor: string;
    context: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
  }> {
    try {
      const parsed = JSON.parse(response);
      
      if (Array.isArray(parsed)) {
        return parsed.map((mention: any) => ({
          competitor: mention.competitor,
          context: mention.context || '',
          sentiment: mention.sentiment || 'neutral',
          confidence: mention.confidence || 0.7
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to parse competitor mentions:', error);
      return [];
    }
  }

  /**
   * Parse business info from LLM response
   */
  private parseBusinessInfo(response: string): ExtractedFact[] {
    try {
      const parsed = JSON.parse(response);
      
      if (Array.isArray(parsed)) {
        return parsed.map((info: any) => ({
          type: info.type,
          value: info.value,
          confidence: info.confidence || 0.7,
          context: info.context || '',
          source: 'website'
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to parse business info:', error);
      return [];
    }
  }

  /**
   * Deduplicate facts based on type and value similarity
   */
  private deduplicateFacts(facts: ExtractedFact[]): ExtractedFact[] {
    const seen = new Map<string, ExtractedFact>();
    
    facts.forEach(fact => {
      const key = `${fact.type}:${fact.value.toLowerCase().trim()}`;
      
      if (!seen.has(key) || seen.get(key)!.confidence < fact.confidence) {
        seen.set(key, fact);
      }
    });
    
    return Array.from(seen.values());
  }

  /**
   * Validate fact format
   */
  validateFact(fact: ExtractedFact): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!fact.type || !['address', 'hours', 'phone', 'services', 'description', 'website', 'email'].includes(fact.type)) {
      errors.push('Invalid fact type');
    }
    
    if (!fact.value || fact.value.trim().length === 0) {
      errors.push('Empty fact value');
    }
    
    if (fact.confidence < 0 || fact.confidence > 1) {
      errors.push('Invalid confidence score');
    }
    
    // Type-specific validation
    if (fact.type === 'phone' && !this.isValidPhoneNumber(fact.value)) {
      errors.push('Invalid phone number format');
    }
    
    if (fact.type === 'email' && !this.isValidEmail(fact.value)) {
      errors.push('Invalid email format');
    }
    
    if (fact.type === 'website' && !this.isValidUrl(fact.value)) {
      errors.push('Invalid website URL');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if phone number is valid
   */
  private isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  /**
   * Check if email is valid
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if URL is valid
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
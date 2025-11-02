import { Injectable } from '@nestjs/common';
import { ExtractedFact, FactValidationResult } from './fact-extractor';

export interface WorkspaceProfile {
  id: string;
  workspaceId: string;
  businessName: string;
  address?: string;
  phone?: string;
  hours?: any;
  services: string[];
  description?: string;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationRule {
  factType: string;
  validator: (aiValue: string, expectedValue: string) => ValidationResult;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  discrepancy?: string;
  suggestion?: string;
}

@Injectable()
export class FactValidatorService {
  private validationRules: Map<string, ValidationRule> = new Map();

  constructor() {
    this.initializeValidationRules();
  }

  /**
   * Validate extracted facts against workspace profile
   */
  async validateFacts(
    facts: ExtractedFact[],
    profile: WorkspaceProfile
  ): Promise<FactValidationResult[]> {
    const results: FactValidationResult[] = [];

    for (const fact of facts) {
      const validationResult = await this.validateFact(fact, profile);
      results.push(validationResult);
    }

    return results;
  }

  /**
   * Validate a single fact against profile
   */
  async validateFact(
    fact: ExtractedFact,
    profile: WorkspaceProfile
  ): Promise<FactValidationResult> {
    const rule = this.validationRules.get(fact.type);
    
    if (!rule) {
      return {
        fact,
        isValid: true,
        confidence: 0.5,
        severity: 'low'
      };
    }

    const expectedValue = this.getExpectedValue(fact.type, profile);
    
    if (!expectedValue) {
      return {
        fact,
        isValid: true,
        confidence: 0.5,
        severity: 'low'
      };
    }

    const validation = rule.validator(fact.value, expectedValue);
    
    return {
      fact,
      isValid: validation.isValid,
      confidence: validation.confidence,
      expectedValue,
      discrepancy: validation.discrepancy,
      severity: rule.severity
    };
  }

  /**
   * Get expected value for fact type from profile
   */
  private getExpectedValue(factType: string, profile: WorkspaceProfile): string | null {
    switch (factType) {
      case 'address':
        return profile.address || null;
      case 'phone':
        return profile.phone || null;
      case 'hours':
        return profile.hours ? JSON.stringify(profile.hours) : null;
      case 'services':
        return profile.services.join(', ') || null;
      case 'description':
        return profile.description || null;
      case 'website':
        return null; // Not stored in profile
      case 'email':
        return null; // Not stored in profile
      default:
        return null;
    }
  }

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): void {
    // Address validation
    this.validationRules.set('address', {
      factType: 'address',
      validator: this.validateAddress.bind(this),
      severity: 'critical'
    });

    // Phone validation
    this.validationRules.set('phone', {
      factType: 'phone',
      validator: this.validatePhone.bind(this),
      severity: 'high'
    });

    // Hours validation
    this.validationRules.set('hours', {
      factType: 'hours',
      validator: this.validateHours.bind(this),
      severity: 'medium'
    });

    // Services validation
    this.validationRules.set('services', {
      factType: 'services',
      validator: this.validateServices.bind(this),
      severity: 'medium'
    });

    // Description validation
    this.validationRules.set('description', {
      factType: 'description',
      validator: this.validateDescription.bind(this),
      severity: 'low'
    });
  }

  /**
   * Validate address
   */
  private validateAddress(aiValue: string, expectedValue: string): ValidationResult {
    const aiNormalized = this.normalizeAddress(aiValue);
    const expectedNormalized = this.normalizeAddress(expectedValue);
    
    const similarity = this.calculateStringSimilarity(aiNormalized, expectedNormalized);
    
    if (similarity >= 0.8) {
      return {
        isValid: true,
        confidence: similarity,
        suggestion: 'Address matches closely'
      };
    } else if (similarity >= 0.6) {
      return {
        isValid: false,
        confidence: similarity,
        discrepancy: `Address differs: AI says "${aiValue}" but expected "${expectedValue}"`,
        suggestion: 'Address is similar but not exact - verify accuracy'
      };
    } else {
      return {
        isValid: false,
        confidence: similarity,
        discrepancy: `Address mismatch: AI says "${aiValue}" but expected "${expectedValue}"`,
        suggestion: 'Address is significantly different - this may be a hallucination'
      };
    }
  }

  /**
   * Validate phone number
   */
  private validatePhone(aiValue: string, expectedValue: string): ValidationResult {
    const aiNormalized = this.normalizePhone(aiValue);
    const expectedNormalized = this.normalizePhone(expectedValue);
    
    if (aiNormalized === expectedNormalized) {
      return {
        isValid: true,
        confidence: 1.0,
        suggestion: 'Phone number matches exactly'
      };
    } else {
      return {
        isValid: false,
        confidence: 0.0,
        discrepancy: `Phone mismatch: AI says "${aiValue}" but expected "${expectedValue}"`,
        suggestion: 'Phone number is incorrect - this is likely a hallucination'
      };
    }
  }

  /**
   * Validate business hours
   */
  private validateHours(aiValue: string, expectedValue: string): ValidationResult {
    try {
      const aiHours = JSON.parse(aiValue);
      const expectedHours = JSON.parse(expectedValue);
      
      const similarity = this.calculateHoursSimilarity(aiHours, expectedHours);
      
      if (similarity >= 0.8) {
        return {
          isValid: true,
          confidence: similarity,
          suggestion: 'Hours match closely'
        };
      } else {
        return {
          isValid: false,
          confidence: similarity,
          discrepancy: `Hours differ: AI says "${aiValue}" but expected "${expectedValue}"`,
          suggestion: 'Business hours are different - verify accuracy'
        };
      }
    } catch {
      return {
        isValid: false,
        confidence: 0.0,
        discrepancy: `Hours format error: AI says "${aiValue}" but expected "${expectedValue}"`,
        suggestion: 'Hours format is invalid'
      };
    }
  }

  /**
   * Validate services
   */
  private validateServices(aiValue: string, expectedValue: string): ValidationResult {
    const aiServices = aiValue.toLowerCase().split(',').map(s => s.trim());
    const expectedServices = expectedValue.toLowerCase().split(',').map(s => s.trim());
    
    const overlap = aiServices.filter(service => 
      expectedServices.some(expected => 
        this.calculateStringSimilarity(service, expected) >= 0.7
      )
    ).length;
    
    const similarity = overlap / Math.max(aiServices.length, expectedServices.length);
    
    if (similarity >= 0.7) {
      return {
        isValid: true,
        confidence: similarity,
        suggestion: 'Services match well'
      };
    } else {
      return {
        isValid: false,
        confidence: similarity,
        discrepancy: `Services differ: AI says "${aiValue}" but expected "${expectedValue}"`,
        suggestion: 'Services are different - verify accuracy'
      };
    }
  }

  /**
   * Validate description
   */
  private validateDescription(aiValue: string, expectedValue: string): ValidationResult {
    const similarity = this.calculateStringSimilarity(
      aiValue.toLowerCase(),
      expectedValue.toLowerCase()
    );
    
    if (similarity >= 0.6) {
      return {
        isValid: true,
        confidence: similarity,
        suggestion: 'Description matches reasonably well'
      };
    } else {
      return {
        isValid: false,
        confidence: similarity,
        discrepancy: `Description differs significantly`,
        suggestion: 'Description is quite different - verify accuracy'
      };
    }
  }

  /**
   * Normalize address for comparison
   */
  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize phone number for comparison
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/[\s\-\(\)]/g, '');
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );
    
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
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate hours similarity
   */
  private calculateHoursSimilarity(hours1: any, hours2: any): number {
    if (!hours1 || !hours2) return 0;
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    let matches = 0;
    
    for (const day of days) {
      if (hours1[day] && hours2[day]) {
        const similarity = this.calculateStringSimilarity(
          hours1[day].toLowerCase(),
          hours2[day].toLowerCase()
        );
        if (similarity >= 0.8) matches++;
      }
    }
    
    return matches / days.length;
  }

  /**
   * Get validation statistics
   */
  getValidationStats(results: FactValidationResult[]): {
    total: number;
    valid: number;
    invalid: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    averageConfidence: number;
  } {
    const stats = {
      total: results.length,
      valid: results.filter(r => r.isValid).length,
      invalid: results.filter(r => !r.isValid).length,
      critical: results.filter(r => r.severity === 'critical').length,
      high: results.filter(r => r.severity === 'high').length,
      medium: results.filter(r => r.severity === 'medium').length,
      low: results.filter(r => r.severity === 'low').length,
      averageConfidence: 0
    };
    
    if (results.length > 0) {
      stats.averageConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    }
    
    return stats;
  }
}
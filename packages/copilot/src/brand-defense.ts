/**
 * Brand defense module
 * Detects hallucinations and proposes corrective actions
 */

import { Alert, AlertType, CopilotActionType } from '@ai-visibility/shared';
import { ProposedAction } from './planner';

export interface BrandFacts {
  companyName: string;
  description: string;
  products: string[];
  services: string[];
  keyFeatures: string[];
  pricing: Record<string, any>;
  contactInfo: Record<string, any>;
  lastUpdated: Date;
}

export interface HallucinationDetection {
  detected: boolean;
  confidence: number;
  mismatches: Mismatch[];
  suggestedActions: ProposedAction[];
}

export interface Mismatch {
  claim: string;
  fact: string;
  severity: 'low' | 'medium' | 'high';
  context: string;
}

export interface BrandDefenseConfig {
  enableDetection: boolean;
  confidenceThreshold: number;
  autoCorrect: boolean;
  requireApproval: boolean;
}

/**
 * Detect hallucinations in AI responses
 */
export function detectHallucinations(
  answerText: string,
  brandFacts: BrandFacts,
  config: BrandDefenseConfig
): HallucinationDetection {
  if (!config.enableDetection) {
    return {
      detected: false,
      confidence: 0,
      mismatches: [],
      suggestedActions: [],
    };
  }

  const mismatches: Mismatch[] = [];
  const suggestedActions: ProposedAction[] = [];

  // Check company name accuracy
  const nameMismatch = checkCompanyName(answerText, brandFacts);
  if (nameMismatch) {
    mismatches.push(nameMismatch);
  }

  // Check product accuracy
  const productMismatches = checkProductAccuracy(answerText, brandFacts);
  mismatches.push(...productMismatches);

  // Check service accuracy
  const serviceMismatches = checkServiceAccuracy(answerText, brandFacts);
  mismatches.push(...serviceMismatches);

  // Check pricing accuracy
  const pricingMismatches = checkPricingAccuracy(answerText, brandFacts);
  mismatches.push(...pricingMismatches);

  // Check contact information
  const contactMismatches = checkContactInfo(answerText, brandFacts);
  mismatches.push(...contactMismatches);

  // Calculate overall confidence
  const confidence = calculateDetectionConfidence(mismatches);

  // Generate suggested actions
  if (mismatches.length > 0) {
    suggestedActions.push(...generateCorrectiveActions(mismatches, config));
  }

  return {
    detected: mismatches.length > 0 && confidence >= config.confidenceThreshold,
    confidence,
    mismatches,
    suggestedActions,
  };
}

/**
 * Check company name accuracy
 */
function checkCompanyName(answerText: string, brandFacts: BrandFacts): Mismatch | null {
  const companyName = brandFacts.companyName.toLowerCase();
  const text = answerText.toLowerCase();
  
  // Look for company name mentions
  const nameMentions = text.match(new RegExp(`\\b${companyName}\\b`, 'g'));
  if (!nameMentions) return null;
  
  // Check for variations or misspellings
  const variations = generateNameVariations(companyName);
  for (const variation of variations) {
    if (text.includes(variation) && variation !== companyName) {
      return {
        claim: `Company name mentioned as "${variation}"`,
        fact: `Correct company name is "${brandFacts.companyName}"`,
        severity: 'high',
        context: `Found in: ${extractContext(answerText, variation)}`,
      };
    }
  }
  
  return null;
}

/**
 * Check product accuracy
 */
function checkProductAccuracy(answerText: string, brandFacts: BrandFacts): Mismatch[] {
  const mismatches: Mismatch[] = [];
  const text = answerText.toLowerCase();
  
  for (const product of brandFacts.products) {
    const productLower = product.toLowerCase();
    
    // Check if product is mentioned
    if (text.includes(productLower)) {
      // Check for incorrect product descriptions
      const incorrectDescriptions = findIncorrectProductDescriptions(text, product, brandFacts);
      mismatches.push(...incorrectDescriptions);
    }
  }
  
  return mismatches;
}

/**
 * Check service accuracy
 */
function checkServiceAccuracy(answerText: string, brandFacts: BrandFacts): Mismatch[] {
  const mismatches: Mismatch[] = [];
  const text = answerText.toLowerCase();
  
  for (const service of brandFacts.services) {
    const serviceLower = service.toLowerCase();
    
    // Check if service is mentioned
    if (text.includes(serviceLower)) {
      // Check for incorrect service descriptions
      const incorrectDescriptions = findIncorrectServiceDescriptions(text, service, brandFacts);
      mismatches.push(...incorrectDescriptions);
    }
  }
  
  return mismatches;
}

/**
 * Check pricing accuracy
 */
function checkPricingAccuracy(answerText: string, brandFacts: BrandFacts): Mismatch[] {
  const mismatches: Mismatch[] = [];
  const text = answerText.toLowerCase();
  
  // Look for price mentions
  const pricePattern = /\$[\d,]+(?:\.\d{2})?/g;
  const priceMatches = text.match(pricePattern);
  
  if (priceMatches) {
    for (const priceMatch of priceMatches) {
      const price = parseFloat(priceMatch.replace(/[$,]/g, ''));
      
      // Check if price is significantly different from brand facts
      const factPrice = brandFacts.pricing.price;
      if (factPrice && Math.abs(price - factPrice) > factPrice * 0.2) { // 20% threshold
        mismatches.push({
          claim: `Price mentioned as ${priceMatch}`,
          fact: `Correct price is $${factPrice}`,
          severity: 'high',
          context: `Found in: ${extractContext(answerText, priceMatch)}`,
        });
      }
    }
  }
  
  return mismatches;
}

/**
 * Check contact information accuracy
 */
function checkContactInfo(answerText: string, brandFacts: BrandFacts): Mismatch[] {
  const mismatches: Mismatch[] = [];
  const text = answerText.toLowerCase();
  
  // Check email
  if (brandFacts.contactInfo.email) {
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = text.match(emailPattern);
    
    if (emailMatches) {
      for (const emailMatch of emailMatches) {
        if (emailMatch.toLowerCase() !== brandFacts.contactInfo.email.toLowerCase()) {
          mismatches.push({
            claim: `Email mentioned as ${emailMatch}`,
            fact: `Correct email is ${brandFacts.contactInfo.email}`,
            severity: 'medium',
            context: `Found in: ${extractContext(answerText, emailMatch)}`,
          });
        }
      }
    }
  }
  
  // Check phone
  if (brandFacts.contactInfo.phone) {
    const phonePattern = /\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/g;
    const phoneMatches = text.match(phonePattern);
    
    if (phoneMatches) {
      for (const phoneMatch of phoneMatches) {
        if (phoneMatch !== brandFacts.contactInfo.phone) {
          mismatches.push({
            claim: `Phone mentioned as ${phoneMatch}`,
            fact: `Correct phone is ${brandFacts.contactInfo.phone}`,
            severity: 'medium',
            context: `Found in: ${extractContext(answerText, phoneMatch)}`,
          });
        }
      }
    }
  }
  
  return mismatches;
}

/**
 * Generate name variations for detection
 */
function generateNameVariations(name: string): string[] {
  const variations: string[] = [];
  
  // Common misspellings
  const misspellings = [
    name.replace('a', 'e'),
    name.replace('e', 'a'),
    name.replace('i', 'y'),
    name.replace('o', 'u'),
  ];
  
  variations.push(...misspellings);
  
  // Abbreviations
  const words = name.split(' ');
  if (words.length > 1) {
    const abbreviation = words.map(w => w[0]).join('');
    variations.push(abbreviation);
  }
  
  return variations;
}

/**
 * Find incorrect product descriptions
 */
function findIncorrectProductDescriptions(
  text: string,
  product: string,
  brandFacts: BrandFacts
): Mismatch[] {
  const mismatches: Mismatch[] = [];
  
  // This would use more sophisticated NLP to detect incorrect descriptions
  // For now, we'll use simple keyword matching
  
  const incorrectKeywords = ['cheap', 'expensive', 'outdated', 'broken', 'unreliable'];
  for (const keyword of incorrectKeywords) {
    if (text.includes(keyword) && text.includes(product.toLowerCase())) {
      mismatches.push({
        claim: `Product described as "${keyword}"`,
        fact: `Product should be described accurately`,
        severity: 'medium',
        context: `Found in: ${extractContext(text, keyword)}`,
      });
    }
  }
  
  return mismatches;
}

/**
 * Find incorrect service descriptions
 */
function findIncorrectServiceDescriptions(
  text: string,
  service: string,
  brandFacts: BrandFacts
): Mismatch[] {
  const mismatches: Mismatch[] = [];
  
  // Similar to product descriptions
  const incorrectKeywords = ['unavailable', 'discontinued', 'not offered', 'not available'];
  for (const keyword of incorrectKeywords) {
    if (text.includes(keyword) && text.includes(service.toLowerCase())) {
      mismatches.push({
        claim: `Service described as "${keyword}"`,
        fact: `Service should be described accurately`,
        severity: 'medium',
        context: `Found in: ${extractContext(text, keyword)}`,
      });
    }
  }
  
  return mismatches;
}

/**
 * Calculate detection confidence
 */
function calculateDetectionConfidence(mismatches: Mismatch[]): number {
  if (mismatches.length === 0) return 0;
  
  const severityWeights = { low: 0.3, medium: 0.6, high: 0.9 };
  const totalWeight = mismatches.reduce((sum, mismatch) => sum + severityWeights[mismatch.severity], 0);
  
  return Math.min(1, totalWeight / mismatches.length);
}

/**
 * Generate corrective actions
 */
function generateCorrectiveActions(
  mismatches: Mismatch[],
  config: BrandDefenseConfig
): ProposedAction[] {
  const actions: ProposedAction[] = [];
  
  // Group mismatches by severity
  const highSeverity = mismatches.filter(m => m.severity === 'high');
  const mediumSeverity = mismatches.filter(m => m.severity === 'medium');
  
  if (highSeverity.length > 0) {
    actions.push({
      actionType: CopilotActionType.ADD_FAQ,
      targetUrl: 'https://example.com/faq',
      priority: 9,
      confidence: 0.9,
      reasoning: `High severity brand inaccuracies detected - adding FAQ to correct misinformation`,
      estimatedImpact: 25,
      requiredApproval: config.requireApproval,
    });
  }
  
  if (mediumSeverity.length > 0) {
    actions.push({
      actionType: CopilotActionType.ADD_CITATIONS,
      targetUrl: 'https://example.com/fact-check',
      priority: 7,
      confidence: 0.7,
      reasoning: `Medium severity brand inaccuracies detected - adding citations for fact-checking`,
      estimatedImpact: 15,
      requiredApproval: config.requireApproval,
    });
  }
  
  if (mismatches.length > 0) {
    actions.push({
      actionType: CopilotActionType.REVIEW_CAMPAIGN,
      targetUrl: 'https://example.com/campaign-review',
      priority: 8,
      confidence: 0.8,
      reasoning: `Brand inaccuracies detected - reviewing campaign for corrections`,
      estimatedImpact: 20,
      requiredApproval: config.requireApproval,
    });
  }
  
  return actions;
}

/**
 * Extract context around a match
 */
function extractContext(text: string, match: string, contextLength: number = 50): string {
  const index = text.toLowerCase().indexOf(match.toLowerCase());
  if (index === -1) return '';
  
  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + match.length + contextLength);
  
  return text.substring(start, end);
}

/**
 * Create brand defense alert
 */
export function createBrandDefenseAlert(
  workspaceId: string,
  detection: HallucinationDetection
): Alert {
  return {
    id: `alert_${Date.now()}`,
    workspaceId,
    type: AlertType.HALLUCINATION,
    payload: {
      detected: detection.detected,
      confidence: detection.confidence,
      mismatchCount: detection.mismatches.length,
      suggestedActions: detection.suggestedActions.length,
    },
    createdAt: new Date(),
  };
}

/**
 * Get brand defense summary
 */
export function getBrandDefenseSummary(detection: HallucinationDetection): string {
  if (!detection.detected) {
    return 'No brand inaccuracies detected';
  }
  
  const highSeverity = detection.mismatches.filter(m => m.severity === 'high').length;
  const mediumSeverity = detection.mismatches.filter(m => m.severity === 'medium').length;
  const lowSeverity = detection.mismatches.filter(m => m.severity === 'low').length;
  
  return `Brand inaccuracies detected: ${highSeverity} high, ${mediumSeverity} medium, ${lowSeverity} low severity. ${detection.suggestedActions.length} corrective actions proposed.`;
}

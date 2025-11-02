/**
 * Fact Extractor Service
 * Extracts structured facts from evidence text (address, hours, phone, services, pricing)
 */

import { Injectable } from '@nestjs/common';
import { CitationSourceType } from '../citations/citation-classifier.service';

export interface ExtractedFact {
  type: 'address' | 'hours' | 'phone' | 'services' | 'pricing' | 'features';
  value: string;
  confidence: number; // 0-1
  sourceNodeId: string;
  sourceType: CitationSourceType;
  normalizedValue?: string; // Normalized for comparison
}

@Injectable()
export class FactExtractorService {
  /**
   * Extract facts from evidence text
   */
  async extractFacts(
    evidenceText: string,
    sourceNodeId: string,
    sourceType: CitationSourceType
  ): Promise<ExtractedFact[]> {
    const facts: ExtractedFact[] = [];

    // Extract address
    const addresses = this.extractAddresses(evidenceText);
    facts.push(...addresses.map(addr => ({
      type: 'address' as const,
      value: addr.value,
      confidence: addr.confidence,
      sourceNodeId,
      sourceType,
      normalizedValue: this.normalizeAddress(addr.value),
    })));

    // Extract hours
    const hours = this.extractHours(evidenceText);
    facts.push(...hours.map(hrs => ({
      type: 'hours' as const,
      value: hrs.value,
      confidence: hrs.confidence,
      sourceNodeId,
      sourceType,
      normalizedValue: this.normalizeHours(hrs.value),
    })));

    // Extract phone
    const phones = this.extractPhones(evidenceText);
    facts.push(...phones.map(phone => ({
      type: 'phone' as const,
      value: phone.value,
      confidence: phone.confidence,
      sourceNodeId,
      sourceType,
      normalizedValue: this.normalizePhone(phone.value),
    })));

    // Extract services
    const services = this.extractServices(evidenceText);
    facts.push(...services.map(svc => ({
      type: 'services' as const,
      value: svc.value,
      confidence: svc.confidence,
      sourceNodeId,
      sourceType,
      normalizedValue: svc.value.toLowerCase().trim(),
    })));

    // Extract pricing
    const pricing = this.extractPricing(evidenceText);
    facts.push(...pricing.map(price => ({
      type: 'pricing' as const,
      value: price.value,
      confidence: price.confidence,
      sourceNodeId,
      sourceType,
      normalizedValue: this.normalizePricing(price.value),
    })));

    return facts;
  }

  /**
   * Extract addresses from text
   */
  private extractAddresses(text: string): Array<{ value: string; confidence: number }> {
    const addresses: Array<{ value: string; confidence: number }> = [];
    
    // Pattern 1: Street address with number
    const streetPattern = /\d+\s+[A-Za-z0-9\s,'-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Plaza|Pl)/gi;
    const streetMatches = text.match(streetPattern);
    if (streetMatches) {
      streetMatches.forEach(match => {
        // Try to extract full address (street + city + state + zip)
        const fullAddressPattern = new RegExp(
          match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^,]*[^.]*',
          'gi'
        );
        const fullMatch = text.match(fullAddressPattern);
        if (fullMatch && fullMatch[0]) {
          addresses.push({
            value: fullMatch[0].trim(),
            confidence: 0.9,
          });
        } else {
          addresses.push({
            value: match.trim(),
            confidence: 0.7,
          });
        }
      });
    }

    // Pattern 2: City, State ZIP
    const cityStatePattern = /[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?/g;
    const cityStateMatches = text.match(cityStatePattern);
    if (cityStateMatches) {
      cityStateMatches.forEach(match => {
        addresses.push({
          value: match.trim(),
          confidence: 0.8,
        });
      });
    }

    return addresses;
  }

  /**
   * Extract hours from text
   */
  private extractHours(text: string): Array<{ value: string; confidence: number }> {
    const hours: Array<{ value: string; confidence: number }> = [];
    
    // Pattern 1: "Monday-Friday: 9am-5pm" or "Mon-Fri: 9 AM - 5 PM"
    const dayRangePattern = /(?:Mon|Monday|Tue|Tuesday|Wed|Wednesday|Thu|Thursday|Fri|Friday|Sat|Saturday|Sun|Sunday)[\s-]*(?:to|-)?[\s]*(?:Mon|Monday|Tue|Tuesday|Wed|Wednesday|Thu|Thursday|Fri|Friday|Sat|Saturday|Sun|Sunday)?:?\s*(\d{1,2}):?(\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?\s*[-–—to]?\s*(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm|a\.m\.|p\.m\.)/gi;
    const dayMatches = text.matchAll(dayRangePattern);
    for (const match of dayMatches) {
      hours.push({
        value: match[0].trim(),
        confidence: 0.9,
      });
    }

    // Pattern 2: "9am-5pm" standalone
    const timeRangePattern = /\d{1,2}:?\d{0,2}\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?\s*[-–—to]?\s*\d{1,2}:?\d{0,2}\s*(AM|PM|am|pm|a\.m\.|p\.m\.)/gi;
    const timeMatches = text.match(timeRangePattern);
    if (timeMatches && timeMatches.length > 0) {
      timeMatches.forEach(match => {
        hours.push({
          value: match.trim(),
          confidence: 0.7,
        });
      });
    }

    // Pattern 3: "24/7" or "24 hours"
    const alwaysOpenPattern = /(?:24\/7|24 hours|always open|open 24|round the clock)/gi;
    if (alwaysOpenPattern.test(text)) {
      hours.push({
        value: '24/7',
        confidence: 0.9,
      });
    }

    return hours;
  }

  /**
   * Extract phone numbers from text
   */
  private extractPhones(text: string): Array<{ value: string; confidence: number }> {
    const phones: Array<{ value: string; confidence: number }> = [];
    
    // Pattern 1: US format (555) 123-4567 or 555-123-4567
    const usPhonePattern = /(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
    const usMatches = text.match(usPhonePattern);
    if (usMatches) {
      usMatches.forEach(match => {
        // Filter out false positives (like years, IDs)
        if (match.replace(/\D/g, '').length >= 10) {
          phones.push({
            value: match.trim(),
            confidence: 0.9,
          });
        }
      });
    }

    // Pattern 2: International formats
    const intlPattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
    const intlMatches = text.match(intlPattern);
    if (intlMatches) {
      intlMatches.forEach(match => {
        const digitsOnly = match.replace(/\D/g, '');
        if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
          phones.push({
            value: match.trim(),
            confidence: 0.7,
          });
        }
      });
    }

    return phones;
  }

  /**
   * Extract services from text
   */
  private extractServices(text: string): Array<{ value: string; confidence: number }> {
    const services: Array<{ value: string; confidence: number }> = [];
    
    // Common service keywords
    const serviceKeywords = [
      'consulting', 'development', 'design', 'marketing', 'support',
      'hosting', 'cloud', 'saas', 'software', 'platform', 'solution',
      'service', 'services', 'offering', 'offerings'
    ];

    // Look for lists or mentions of services
    const lowerText = text.toLowerCase();
    
    // Pattern: "Services: X, Y, Z" or "We offer X, Y, Z"
    const serviceListPattern = /(?:services?|offerings?|we offer|provides?)[:\s]+([^.\n]+)/gi;
    const listMatches = text.matchAll(serviceListPattern);
    for (const match of listMatches) {
      const servicesList = match[1].split(',').map(s => s.trim());
      servicesList.forEach(svc => {
        if (svc.length > 2 && svc.length < 100) {
          services.push({
            value: svc,
            confidence: 0.8,
          });
        }
      });
    }

    // Also check for individual service mentions
    serviceKeywords.forEach(keyword => {
      const keywordPattern = new RegExp(`\\b${keyword}\\b`, 'gi');
      if (keywordPattern.test(text)) {
        services.push({
          value: keyword,
          confidence: 0.6,
        });
      }
    });

    return services;
  }

  /**
   * Extract pricing from text
   */
  private extractPricing(text: string): Array<{ value: string; confidence: number }> {
    const pricing: Array<{ value: string; confidence: number }> = [];
    
    // Pattern 1: "$X" or "$X/month" or "$X/year"
    const pricePattern = /\$[\d,]+(?:\.\d{2})?(?:\s*(?:per|\/)\s*(?:month|year|mo|yr|hour|hr|day))?/gi;
    const priceMatches = text.match(pricePattern);
    if (priceMatches) {
      priceMatches.forEach(match => {
        pricing.push({
          value: match.trim(),
          confidence: 0.9,
        });
      });
    }

    // Pattern 2: "Starting at $X" or "From $X"
    const startingPricePattern = /(?:starting at|from|prices? start at)\s*\$[\d,]+(?:\.\d{2})?/gi;
    const startingMatches = text.match(startingPricePattern);
    if (startingMatches) {
      startingMatches.forEach(match => {
        pricing.push({
          value: match.trim(),
          confidence: 0.8,
        });
      });
    }

    return pricing;
  }

  /**
   * Normalize address for comparison
   */
  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/,/g, '')
      .replace(/\./g, '')
      .trim();
  }

  /**
   * Normalize hours for comparison
   */
  private normalizeHours(hours: string): string {
    return hours
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\./g, '')
      .replace(/(am|pm)/g, (m, period) => period.toLowerCase())
      .trim();
  }

  /**
   * Normalize phone for comparison
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Normalize pricing for comparison
   */
  private normalizePricing(pricing: string): string {
    return pricing
      .toLowerCase()
      .replace(/[$,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}


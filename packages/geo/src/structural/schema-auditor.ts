/**
 * Schema Auditor Service
 * Validates schema.org markup on pages
 */

import { Injectable } from '@nestjs/common';

export interface SchemaType {
  type: 'Organization' | 'LocalBusiness' | 'Product' | 'FAQ' | 'HowTo';
  found: boolean;
  valid: boolean;
  jsonLd?: any;
  microdata?: any;
}

export interface SchemaAuditResult {
  schemaTypes: SchemaType[];
  coverageScore: number; // 0-100
  validSchemas: number;
  invalidSchemas: number;
  recommendations: string[];
}

@Injectable()
export class SchemaAuditorService {
  /**
   * Audit page for schema.org markup
   */
  async auditPage(url: string): Promise<SchemaAuditResult> {
    try {
      // Fetch HTML content
      const html = await this.fetchPage(url);
      
      // Parse JSON-LD
      const jsonLdSchemas = this.parseJsonLd(html);
      
      // Parse microdata
      const microdataSchemas = this.parseMicrodata(html);
      
      // Detect schema types
      const detectedTypes = this.detectSchemaTypes(jsonLdSchemas, microdataSchemas);
      
      // Validate schemas
      const validatedTypes = detectedTypes.map(type => this.validateSchemaType(type));
      
      // Calculate coverage score
      const coverageScore = this.calculateCoverageScore(validatedTypes);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(validatedTypes);
      
      return {
        schemaTypes: validatedTypes,
        coverageScore,
        validSchemas: validatedTypes.filter(t => t.valid).length,
        invalidSchemas: validatedTypes.filter(t => !t.valid && t.found).length,
        recommendations,
      };
    } catch (error) {
      console.error(`Error auditing schema for ${url}:`, error);
      return {
        schemaTypes: [],
        coverageScore: 0,
        validSchemas: 0,
        invalidSchemas: 0,
        recommendations: ['Unable to audit schema - page may be inaccessible'],
      };
    }
  }

  /**
   * Detect schema types from parsed schemas
   */
  detectSchemaTypes(jsonLdSchemas: any[], microdataSchemas: any[]): SchemaType[] {
    const targetTypes: SchemaType['type'][] = ['Organization', 'LocalBusiness', 'Product', 'FAQ', 'HowTo'];
    const detected: SchemaType[] = [];

    for (const type of targetTypes) {
      const found = this.findSchemaType(jsonLdSchemas, microdataSchemas, type);
      detected.push({
        type,
        found: !!found,
        valid: false, // Will be validated later
        jsonLd: found?.jsonLd,
        microdata: found?.microdata,
      });
    }

    return detected;
  }

  /**
   * Validate schema type
   */
  validateSchemaType(schemaType: SchemaType): SchemaType {
    if (!schemaType.found) {
      return { ...schemaType, valid: false };
    }

    const schema = schemaType.jsonLd || schemaType.microdata;
    if (!schema) {
      return { ...schemaType, valid: false };
    }

    // Basic validation based on schema type
    const isValid = this.validateSchemaByType(schema, schemaType.type);
    
    return {
      ...schemaType,
      valid: isValid,
    };
  }

  /**
   * Fetch page HTML
   */
  private async fetchPage(url: string): Promise<string> {
    // In production, use proper HTTP client with timeout and error handling
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GEOAuditor/1.0)',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return await response.text();
    } catch (error) {
      console.warn(`Failed to fetch ${url}:`, error);
      throw error;
    }
  }

  /**
   * Parse JSON-LD scripts from HTML
   */
  private parseJsonLd(html: string): any[] {
    const schemas: any[] = [];
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
    
    let match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const json = JSON.parse(match[1]);
        if (json['@type'] || json['@graph']) {
          if (json['@graph']) {
            schemas.push(...json['@graph']);
          } else {
            schemas.push(json);
          }
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }

    return schemas;
  }

  /**
   * Parse microdata from HTML
   */
  private parseMicrodata(html: string): any[] {
    const schemas: any[] = [];
    // Simple microdata parsing (in production, use proper HTML parser)
    const itemscopeRegex = /<[^>]*itemscope[^>]*>/gi;
    
    let match;
    while ((match = itemscopeRegex.exec(html)) !== null) {
      const itemTypeMatch = match[0].match(/itemtype=["']([^"']+)["']/i);
      if (itemTypeMatch) {
        const itemType = itemTypeMatch[1].replace('http://schema.org/', '');
        schemas.push({
          '@type': itemType,
          source: 'microdata',
        });
      }
    }

    return schemas;
  }

  /**
   * Find specific schema type
   */
  private findSchemaType(jsonLdSchemas: any[], microdataSchemas: any[], type: string): { jsonLd?: any; microdata?: any } | null {
    // Check JSON-LD
    const jsonLd = jsonLdSchemas.find(s => {
      const schemaType = s['@type'] || s.type;
      return schemaType === type || schemaType?.endsWith(`/${type}`);
    });

    // Check microdata
    const microdata = microdataSchemas.find(s => {
      const schemaType = s['@type'];
      return schemaType === type || schemaType?.endsWith(`/${type}`);
    });

    if (jsonLd || microdata) {
      return { jsonLd, microdata };
    }

    return null;
  }

  /**
   * Validate schema by type
   */
  private validateSchemaByType(schema: any, expectedType: string): boolean {
    const schemaType = schema['@type'] || schema.type || '';
    
    // Check if type matches
    if (!schemaType.includes(expectedType)) {
      return false;
    }

    // Type-specific validation
    switch (expectedType) {
      case 'Organization':
        return this.validateOrganization(schema);
      case 'LocalBusiness':
        return this.validateLocalBusiness(schema);
      case 'Product':
        return this.validateProduct(schema);
      case 'FAQ':
        return this.validateFAQ(schema);
      case 'HowTo':
        return this.validateHowTo(schema);
      default:
        return true; // Basic validation passed
    }
  }

  /**
   * Validate Organization schema
   */
  private validateOrganization(schema: any): boolean {
    return !!(schema.name || schema['@name']);
  }

  /**
   * Validate LocalBusiness schema
   */
  private validateLocalBusiness(schema: any): boolean {
    return !!(schema.name || schema['@name']) && !!(schema.address || schema['@address']);
  }

  /**
   * Validate Product schema
   */
  private validateProduct(schema: any): boolean {
    return !!(schema.name || schema['@name']) && !!(schema.description || schema['@description']);
  }

  /**
   * Validate FAQ schema
   */
  private validateFAQ(schema: any): boolean {
    const questions = schema.mainEntity || schema['@mainEntity'] || [];
    return Array.isArray(questions) && questions.length > 0;
  }

  /**
   * Validate HowTo schema
   */
  private validateHowTo(schema: any): boolean {
    return !!(schema.step || schema['@step']) || !!(schema.steps || schema['@steps']);
  }

  /**
   * Calculate coverage score
   */
  private calculateCoverageScore(schemaTypes: SchemaType[]): number {
    const validCount = schemaTypes.filter(t => t.valid).length;
    const totalCount = schemaTypes.length;
    
    // Score based on how many schema types are present and valid
    const score = (validCount / totalCount) * 100;
    return Math.round(score);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(schemaTypes: SchemaType[]): string[] {
    const recommendations: string[] = [];
    
    for (const schemaType of schemaTypes) {
      if (!schemaType.found) {
        recommendations.push(`Add ${schemaType.type} schema markup`);
      } else if (!schemaType.valid) {
        recommendations.push(`Fix invalid ${schemaType.type} schema markup`);
      }
    }

    return recommendations;
  }
}



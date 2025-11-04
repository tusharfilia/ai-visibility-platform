import { Injectable } from '@nestjs/common';
import { FactExtractorService, ExtractedFact, FactValidationResult } from './fact-extractor';
import { FactValidatorService, WorkspaceProfile } from './fact-validator';

export interface HallucinationAlert {
  id: string;
  workspaceId: string;
  engineKey: string;
  promptId: string;
  factType: string;
  aiStatement: string;
  correctFact: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'corrected' | 'dismissed';
  confidence: number;
  context: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HallucinationDetectionOptions {
  minConfidence?: number;
  severityThreshold?: 'critical' | 'high' | 'medium' | 'low';
  includeCorrectFacts?: boolean;
}

@Injectable()
export class HallucinationDetectorService {
  constructor(
    private factExtractor: FactExtractorService,
    private factValidator: FactValidatorService
  ) {}

  /**
   * Detect hallucinations in AI response
   */
  async detectHallucinations(
    workspaceId: string,
    aiResponse: string,
    engineKey: string,
    promptId: string,
    profile: WorkspaceProfile,
    options: HallucinationDetectionOptions = {}
  ): Promise<HallucinationAlert[]> {
    try {
      // 1. Extract facts from AI response
      const extractedFacts = await this.factExtractor.extractFacts(
        workspaceId,
        aiResponse,
        engineKey
      );

      // 2. Validate facts against workspace profile
      const validationResults = await this.factValidator.validateFacts(
        extractedFacts,
        profile
      );

      // 3. Filter invalid facts based on options
      const invalidFacts = this.filterInvalidFacts(validationResults, options);

      // 4. Create hallucination alerts
      const alerts = await this.createHallucinationAlerts(
        workspaceId,
        engineKey,
        promptId,
        invalidFacts
      );

      return alerts;
    } catch (error) {
      console.error('Hallucination detection failed:', error);
      throw new Error(`Failed to detect hallucinations: ${error.message}`);
    }
  }

  /**
   * Detect hallucinations from multiple AI responses
   */
  async detectHallucinationsFromMultipleResponses(
    workspaceId: string,
    responses: Array<{
      content: string;
      engine: string;
      promptId: string;
    }>,
    profile: WorkspaceProfile,
    options: HallucinationDetectionOptions = {}
  ): Promise<HallucinationAlert[]> {
    const allAlerts: HallucinationAlert[] = [];

    for (const response of responses) {
      const alerts = await this.detectHallucinations(
        workspaceId,
        response.content,
        response.engine,
        response.promptId,
        profile,
        options
      );
      allAlerts.push(...alerts);
    }

    return this.deduplicateAlerts(allAlerts);
  }

  /**
   * Analyze hallucination patterns across engines
   */
  async analyzeHallucinationPatterns(
    workspaceId: string,
    alerts: HallucinationAlert[]
  ): Promise<{
    enginePatterns: Record<string, {
      totalAlerts: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      commonFactTypes: string[];
    }>;
    factTypePatterns: Record<string, {
      totalOccurrences: number;
      engines: string[];
      averageConfidence: number;
    }>;
    recommendations: string[];
  }> {
    const enginePatterns: Record<string, any> = {};
    const factTypePatterns: Record<string, any> = {};

    // Analyze by engine
    alerts.forEach(alert => {
      if (!enginePatterns[alert.engineKey]) {
        enginePatterns[alert.engineKey] = {
          totalAlerts: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          commonFactTypes: []
        };
      }

      const pattern = enginePatterns[alert.engineKey];
      pattern.totalAlerts++;
      pattern[`${alert.severity}Count`]++;
      
      if (!pattern.commonFactTypes.includes(alert.factType)) {
        pattern.commonFactTypes.push(alert.factType);
      }
    });

    // Analyze by fact type
    alerts.forEach(alert => {
      if (!factTypePatterns[alert.factType]) {
        factTypePatterns[alert.factType] = {
          totalOccurrences: 0,
          engines: [],
          averageConfidence: 0,
          confidences: []
        };
      }

      const pattern = factTypePatterns[alert.factType];
      pattern.totalOccurrences++;
      pattern.confidences.push(alert.confidence);
      
      if (!pattern.engines.includes(alert.engineKey)) {
        pattern.engines.push(alert.engineKey);
      }
    });

    // Calculate average confidence for each fact type
    Object.keys(factTypePatterns).forEach(factType => {
      const pattern = factTypePatterns[factType];
      pattern.averageConfidence = pattern.confidences.reduce((a: number, b: number) => a + b, 0) / pattern.confidences.length;
      delete pattern.confidences;
    });

    // Generate recommendations
    const recommendations = this.generateRecommendations(enginePatterns, factTypePatterns);

    return {
      enginePatterns,
      factTypePatterns,
      recommendations
    };
  }

  /**
   * Get hallucination statistics
   */
  getHallucinationStats(alerts: HallucinationAlert[]): {
    total: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    byEngine: Record<string, number>;
    byFactType: Record<string, number>;
    averageConfidence: number;
    criticalRate: number;
  } {
    const stats = {
      total: alerts.length,
      bySeverity: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byEngine: {} as Record<string, number>,
      byFactType: {} as Record<string, number>,
      averageConfidence: 0,
      criticalRate: 0
    };

    let totalConfidence = 0;
    let criticalCount = 0;

    alerts.forEach(alert => {
      // By severity
      stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
      
      // By status
      stats.byStatus[alert.status] = (stats.byStatus[alert.status] || 0) + 1;
      
      // By engine
      stats.byEngine[alert.engineKey] = (stats.byEngine[alert.engineKey] || 0) + 1;
      
      // By fact type
      stats.byFactType[alert.factType] = (stats.byFactType[alert.factType] || 0) + 1;
      
      // Confidence
      totalConfidence += alert.confidence;
      
      // Critical count
      if (alert.severity === 'critical') {
        criticalCount++;
      }
    });

    if (alerts.length > 0) {
      stats.averageConfidence = totalConfidence / alerts.length;
      stats.criticalRate = criticalCount / alerts.length;
    }

    return stats;
  }

  /**
   * Filter invalid facts based on options
   */
  private filterInvalidFacts(
    validationResults: FactValidationResult[],
    options: HallucinationDetectionOptions
  ): FactValidationResult[] {
    let filtered = validationResults.filter(result => !result.isValid);

    // Filter by minimum confidence
    if (options.minConfidence !== undefined) {
      filtered = filtered.filter(result => result.confidence >= options.minConfidence);
    }

    // Filter by severity threshold
    if (options.severityThreshold) {
      const severityOrder = ['low', 'medium', 'high', 'critical'];
      const thresholdIndex = severityOrder.indexOf(options.severityThreshold);
      filtered = filtered.filter(result => {
        const resultIndex = severityOrder.indexOf(result.severity);
        return resultIndex >= thresholdIndex;
      });
    }

    return filtered;
  }

  /**
   * Create hallucination alerts from validation results
   */
  private async createHallucinationAlerts(
    workspaceId: string,
    engineKey: string,
    promptId: string,
    invalidFacts: FactValidationResult[]
  ): Promise<HallucinationAlert[]> {
    const alerts: HallucinationAlert[] = [];

    for (const result of invalidFacts) {
      const alert: HallucinationAlert = {
        id: this.generateId(),
        workspaceId,
        engineKey,
        promptId,
        factType: result.fact.type,
        aiStatement: result.fact.value,
        correctFact: result.expectedValue || '',
        severity: result.severity,
        status: 'open',
        confidence: result.confidence,
        context: result.fact.context,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      alerts.push(alert);
    }

    return alerts;
  }

  /**
   * Deduplicate alerts based on fact type and content similarity
   */
  private deduplicateAlerts(alerts: HallucinationAlert[]): HallucinationAlert[] {
    const seen = new Map<string, HallucinationAlert>();
    
    alerts.forEach(alert => {
      const key = `${alert.factType}:${alert.aiStatement.toLowerCase().trim()}`;
      
      if (!seen.has(key) || seen.get(key)!.confidence < alert.confidence) {
        seen.set(key, alert);
      }
    });
    
    return Array.from(seen.values());
  }

  /**
   * Generate recommendations based on patterns
   */
  private generateRecommendations(
    enginePatterns: Record<string, any>,
    factTypePatterns: Record<string, any>
  ): string[] {
    const recommendations: string[] = [];

    // Engine-specific recommendations
    Object.entries(enginePatterns).forEach(([engine, pattern]) => {
      if (pattern.criticalCount > 0) {
        recommendations.push(`${engine} has ${pattern.criticalCount} critical hallucinations - prioritize corrections`);
      }
      
      if (pattern.totalAlerts > 10) {
        recommendations.push(`${engine} has high hallucination rate (${pattern.totalAlerts} alerts) - consider fact-checking`);
      }
    });

    // Fact type recommendations
    Object.entries(factTypePatterns).forEach(([factType, pattern]) => {
      if (pattern.totalOccurrences > 5) {
        recommendations.push(`${factType} facts are frequently hallucinated - verify workspace profile accuracy`);
      }
      
      if (pattern.averageConfidence < 0.5) {
        recommendations.push(`${factType} hallucinations have low confidence - may be false positives`);
      }
    });

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('No significant hallucination patterns detected');
    }

    return recommendations;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `hall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
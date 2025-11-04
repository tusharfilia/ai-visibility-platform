import { Injectable } from '@nestjs/common';
import { HallucinationDetectorService } from '@ai-visibility/geo/validation/hallucination-detector.service';
import { FactExtractorService } from '@ai-visibility/geo/validation/fact-extractor.service';
import { FactValidatorService } from '@ai-visibility/geo/validation/fact-validator.service';

@Injectable()
export class HallucinationsApiService {
  constructor(
    private hallucinationDetector: HallucinationDetectorService,
    private factExtractor: FactExtractorService,
    private factValidator: FactValidatorService
  ) {}

  /**
   * Wrapper for hallucination detection with API-specific logic
   */
  async detectHallucinationsForApi(
    workspaceId: string,
    aiResponse: string,
    engineKey: string,
    promptId: string,
    profile: any,
    options: any = {}
  ) {
    return this.hallucinationDetector.detectHallucinations(
      workspaceId,
      aiResponse,
      engineKey,
      promptId,
      profile,
      options
    );
  }

  /**
   * Wrapper for multiple responses detection with API-specific logic
   */
  async detectHallucinationsFromMultipleForApi(
    workspaceId: string,
    responses: any[],
    profile: any,
    options: any = {}
  ) {
    return this.hallucinationDetector.detectHallucinationsFromMultipleResponses(
      workspaceId,
      responses,
      profile,
      options
    );
  }

  /**
   * Wrapper for pattern analysis with API-specific logic
   */
  async analyzePatternsForApi(
    workspaceId: string,
    alerts: any[]
  ) {
    return this.hallucinationDetector.analyzeHallucinationPatterns(
      workspaceId,
      alerts
    );
  }

  /**
   * Wrapper for fact extraction with API-specific logic
   */
  async extractFactsForApi(
    workspaceId: string,
    aiResponse: string,
    engineKey: string
  ) {
    return this.factExtractor.extractFacts(
      workspaceId,
      aiResponse,
      engineKey
    );
  }

  /**
   * Wrapper for fact validation with API-specific logic
   */
  async validateFactsForApi(
    facts: any[],
    profile: any
  ) {
    return this.factValidator.validateFacts(facts, profile);
  }

  /**
   * Wrapper for competitor mention extraction with API-specific logic
   */
  async extractCompetitorMentionsForApi(
    workspaceId: string,
    aiResponse: string,
    competitors: string[]
  ) {
    return this.factExtractor.extractCompetitorMentions(
      workspaceId,
      aiResponse,
      competitors
    );
  }
}
import { Injectable } from '@nestjs/common';

export type EngineKey = 'PERPLEXITY' | 'CHATGPT' | 'GEMINI' | 'BRAVE' | 'AIO' | 'CLAUDE' | 'COPILOT';

export interface EngineBias {
  engine: EngineKey;
  description: string;
  sourcePreferences: {
    licensedPublishers: number; // Multiplier (e.g., 3.0 = 3x weight)
    curatedSources: number;
    directories: number;
    reddit: number;
    userGenerated: number;
    blogs: number;
    news: number;
  };
  contentPreferences: {
    structuredData: number;
    schemaMarkup: number;
    freshness: number;
    authority: number;
    citations: number;
  };
  behaviorTraits: {
    prefersRecent: boolean;
    prefersAuthoritative: boolean;
    prefersCitations: boolean;
    prefersStructured: boolean;
    hallucinationRisk: 'low' | 'medium' | 'high';
  };
  weightingFactors: {
    entityStrength: number;
    citationDepth: number;
    structuralClarity: number;
    updateCadence: number;
    trustSignals: number;
  };
}

export interface EngineSimulationResult {
  engine: EngineKey;
  visibilityScore: number;
  confidence: number;
  reasoning: string;
  keyFactors: string[];
  recommendations: string[];
}

@Injectable()
export class EngineBiasSimulatorService {
  private readonly engineBiases: Map<EngineKey, EngineBias>;

  constructor() {
    this.engineBiases = new Map();
    this.initializeEngineBiases();
  }

  /**
   * Simulate how an engine would evaluate a business
   */
  simulateEngineEvaluation(
    engine: EngineKey,
    context: {
      entityStrength: number;
      citationDepth: number;
      structuralClarity: number;
      updateCadence: number;
      trustSignals: number;
      licensedCitations: number;
      directoryCitations: number;
      redditMentions: number;
      schemaScore: number;
      freshnessScore: number;
    }
  ): EngineSimulationResult {
    const bias = this.engineBiases.get(engine);
    if (!bias) {
      throw new Error(`Unknown engine: ${engine}`);
    }

    // Calculate engine-specific weighted score
    const weightedScore = 
      context.entityStrength * bias.weightingFactors.entityStrength +
      context.citationDepth * bias.weightingFactors.citationDepth +
      context.structuralClarity * bias.weightingFactors.structuralClarity +
      context.updateCadence * bias.weightingFactors.updateCadence +
      context.trustSignals * bias.weightingFactors.trustSignals;

    // Apply source preference multipliers
    const sourceBonus = 
      context.licensedCitations * bias.sourcePreferences.licensedPublishers * 2 +
      context.directoryCitations * bias.sourcePreferences.directories * 1.5 +
      context.redditMentions * bias.sourcePreferences.reddit * (engine === 'PERPLEXITY' ? 1.5 : 0.8);

    // Apply content preference multipliers
    const contentBonus = 
      context.schemaScore * bias.contentPreferences.schemaMarkup * 0.5 +
      context.freshnessScore * bias.contentPreferences.freshness * 0.3;

    const finalScore = Math.min(100, Math.max(0, weightedScore + sourceBonus + contentBonus));
    const confidence = this.calculateConfidence(context, bias);

    // Generate reasoning
    const reasoning = this.generateReasoning(engine, context, bias, finalScore);
    const keyFactors = this.identifyKeyFactors(engine, context, bias);
    const recommendations = this.generateEngineRecommendations(engine, context, bias);

    return {
      engine,
      visibilityScore: Math.round(finalScore),
      confidence,
      reasoning,
      keyFactors,
      recommendations,
    };
  }

  /**
   * Get engine bias configuration
   */
  getEngineBias(engine: EngineKey): EngineBias | undefined {
    return this.engineBiases.get(engine);
  }

  /**
   * Compare visibility across engines
   */
  compareEngines(
    context: {
      entityStrength: number;
      citationDepth: number;
      structuralClarity: number;
      updateCadence: number;
      trustSignals: number;
      licensedCitations: number;
      directoryCitations: number;
      redditMentions: number;
      schemaScore: number;
      freshnessScore: number;
    },
    engines: EngineKey[] = ['PERPLEXITY', 'CHATGPT', 'GEMINI', 'BRAVE', 'AIO']
  ): EngineSimulationResult[] {
    return engines.map(engine => this.simulateEngineEvaluation(engine, context));
  }

  /**
   * Initialize engine bias configurations
   */
  private initializeEngineBiases(): void {
    // ChatGPT - Prefers licensed publishers, high-authority sites, structured data
    this.engineBiases.set('CHATGPT', {
      engine: 'CHATGPT',
      description: 'Prefers licensed publishers, high-authority sites, structured data',
      sourcePreferences: {
        licensedPublishers: 3.0,
        curatedSources: 2.0,
        directories: 1.5,
        reddit: 0.8,
        userGenerated: 0.5,
        blogs: 1.2,
        news: 2.5,
      },
      contentPreferences: {
        structuredData: 1.5,
        schemaMarkup: 1.8,
        freshness: 1.2,
        authority: 2.0,
        citations: 1.5,
      },
      behaviorTraits: {
        prefersRecent: true,
        prefersAuthoritative: true,
        prefersCitations: true,
        prefersStructured: true,
        hallucinationRisk: 'low',
      },
      weightingFactors: {
        entityStrength: 0.30,
        citationDepth: 0.25,
        structuralClarity: 0.25,
        updateCadence: 0.10,
        trustSignals: 0.10,
      },
    });

    // Perplexity - Prefers Reddit, blogs, real-world experience, citation-heavy
    this.engineBiases.set('PERPLEXITY', {
      engine: 'PERPLEXITY',
      description: 'Prefers Reddit, blogs, real-world experience, citation-heavy content',
      sourcePreferences: {
        licensedPublishers: 2.0,
        curatedSources: 1.5,
        directories: 1.2,
        reddit: 2.5,
        userGenerated: 1.8,
        blogs: 2.0,
        news: 1.5,
      },
      contentPreferences: {
        structuredData: 1.0,
        schemaMarkup: 1.2,
        freshness: 1.5,
        authority: 1.3,
        citations: 2.0,
      },
      behaviorTraits: {
        prefersRecent: true,
        prefersAuthoritative: false,
        prefersCitations: true,
        prefersStructured: false,
        hallucinationRisk: 'medium',
      },
      weightingFactors: {
        entityStrength: 0.20,
        citationDepth: 0.35,
        structuralClarity: 0.15,
        updateCadence: 0.20,
        trustSignals: 0.10,
      },
    });

    // Gemini - Prefers structured facts, Google Knowledge Graph, schema data
    this.engineBiases.set('GEMINI', {
      engine: 'GEMINI',
      description: 'Prefers structured facts, Google Knowledge Graph, schema data',
      sourcePreferences: {
        licensedPublishers: 2.5,
        curatedSources: 2.0,
        directories: 2.0,
        reddit: 0.8,
        userGenerated: 0.6,
        blogs: 1.0,
        news: 2.0,
      },
      contentPreferences: {
        structuredData: 2.0,
        schemaMarkup: 2.5,
        freshness: 1.3,
        authority: 1.8,
        citations: 1.5,
      },
      behaviorTraits: {
        prefersRecent: true,
        prefersAuthoritative: true,
        prefersCitations: true,
        prefersStructured: true,
        hallucinationRisk: 'low',
      },
      weightingFactors: {
        entityStrength: 0.25,
        citationDepth: 0.20,
        structuralClarity: 0.35,
        updateCadence: 0.10,
        trustSignals: 0.10,
      },
    });

    // Brave - Prefers diverse sources, citations, reviews
    this.engineBiases.set('BRAVE', {
      engine: 'BRAVE',
      description: 'Prefers diverse sources, citations, reviews',
      sourcePreferences: {
        licensedPublishers: 2.0,
        curatedSources: 1.8,
        directories: 1.8,
        reddit: 1.5,
        userGenerated: 1.5,
        blogs: 1.8,
        news: 1.8,
      },
      contentPreferences: {
        structuredData: 1.3,
        schemaMarkup: 1.5,
        freshness: 1.4,
        authority: 1.5,
        citations: 1.8,
      },
      behaviorTraits: {
        prefersRecent: true,
        prefersAuthoritative: true,
        prefersCitations: true,
        prefersStructured: true,
        hallucinationRisk: 'medium',
      },
      weightingFactors: {
        entityStrength: 0.25,
        citationDepth: 0.30,
        structuralClarity: 0.20,
        updateCadence: 0.15,
        trustSignals: 0.10,
      },
    });

    // AIO (Google AI Overviews) - Prefers Google-curated sources, featured snippets
    this.engineBiases.set('AIO', {
      engine: 'AIO',
      description: 'Prefers Google-curated sources, featured snippets',
      sourcePreferences: {
        licensedPublishers: 2.5,
        curatedSources: 2.5,
        directories: 2.0,
        reddit: 1.0,
        userGenerated: 0.8,
        blogs: 1.5,
        news: 2.5,
      },
      contentPreferences: {
        structuredData: 1.8,
        schemaMarkup: 2.0,
        freshness: 1.5,
        authority: 2.0,
        citations: 1.8,
      },
      behaviorTraits: {
        prefersRecent: true,
        prefersAuthoritative: true,
        prefersCitations: true,
        prefersStructured: true,
        hallucinationRisk: 'low',
      },
      weightingFactors: {
        entityStrength: 0.25,
        citationDepth: 0.25,
        structuralClarity: 0.30,
        updateCadence: 0.10,
        trustSignals: 0.10,
      },
    });

    // Claude - Prefers long-form reasoning, balanced sources
    this.engineBiases.set('CLAUDE', {
      engine: 'CLAUDE',
      description: 'Prefers long-form reasoning, balanced sources',
      sourcePreferences: {
        licensedPublishers: 2.2,
        curatedSources: 1.8,
        directories: 1.5,
        reddit: 1.2,
        userGenerated: 1.0,
        blogs: 1.5,
        news: 2.0,
      },
      contentPreferences: {
        structuredData: 1.5,
        schemaMarkup: 1.6,
        freshness: 1.3,
        authority: 1.7,
        citations: 1.6,
      },
      behaviorTraits: {
        prefersRecent: true,
        prefersAuthoritative: true,
        prefersCitations: true,
        prefersStructured: true,
        hallucinationRisk: 'low',
      },
      weightingFactors: {
        entityStrength: 0.28,
        citationDepth: 0.25,
        structuralClarity: 0.22,
        updateCadence: 0.15,
        trustSignals: 0.10,
      },
    });

    // Copilot - Prefers Bing schema, reviews, citations
    this.engineBiases.set('COPILOT', {
      engine: 'COPILOT',
      description: 'Prefers Bing schema, reviews, citations',
      sourcePreferences: {
        licensedPublishers: 2.3,
        curatedSources: 2.0,
        directories: 2.2,
        reddit: 1.2,
        userGenerated: 1.3,
        blogs: 1.5,
        news: 2.2,
      },
      contentPreferences: {
        structuredData: 1.8,
        schemaMarkup: 2.2,
        freshness: 1.4,
        authority: 1.9,
        citations: 1.9,
      },
      behaviorTraits: {
        prefersRecent: true,
        prefersAuthoritative: true,
        prefersCitations: true,
        prefersStructured: true,
        hallucinationRisk: 'low',
      },
      weightingFactors: {
        entityStrength: 0.26,
        citationDepth: 0.24,
        structuralClarity: 0.28,
        updateCadence: 0.12,
        trustSignals: 0.10,
      },
    });
  }

  /**
   * Calculate confidence score based on context and bias
   */
  private calculateConfidence(
    context: {
      entityStrength: number;
      citationDepth: number;
      structuralClarity: number;
      licensedCitations: number;
      schemaScore: number;
    },
    bias: EngineBias
  ): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence with more citations
    if (context.citationDepth > 50) confidence += 0.2;
    if (context.licensedCitations > 0) confidence += 0.15;

    // Higher confidence with better structure
    if (context.structuralClarity > 70) confidence += 0.1;
    if (context.schemaScore > 80) confidence += 0.1;

    // Higher confidence with stronger entity
    if (context.entityStrength > 60) confidence += 0.05;

    return Math.min(1.0, confidence);
  }

  /**
   * Generate reasoning for engine evaluation
   */
  private generateReasoning(
    engine: EngineKey,
    context: any,
    bias: EngineBias,
    score: number
  ): string {
    const factors: string[] = [];

    if (context.licensedCitations > 0) {
      factors.push(`${context.licensedCitations} licensed publisher citation(s)`);
    }
    if (context.schemaScore > 70) {
      factors.push('strong schema markup');
    }
    if (context.citationDepth > 50) {
      factors.push('good citation depth');
    }
    if (context.entityStrength > 60) {
      factors.push('strong entity recognition');
    }

    if (factors.length === 0) {
      return `${engine} evaluation: Low visibility due to limited citations and weak entity signals.`;
    }

    return `${engine} evaluation: ${score}/100. Key factors: ${factors.join(', ')}. ${bias.description}.`;
  }

  /**
   * Identify key factors for engine
   */
  private identifyKeyFactors(
    engine: EngineKey,
    context: any,
    bias: EngineBias
  ): string[] {
    const factors: string[] = [];

    if (bias.behaviorTraits.prefersAuthoritative && context.licensedCitations > 0) {
      factors.push('Licensed publisher citations');
    }
    if (bias.behaviorTraits.prefersStructured && context.schemaScore > 70) {
      factors.push('Schema markup');
    }
    if (bias.behaviorTraits.prefersCitations && context.citationDepth > 50) {
      factors.push('Citation depth');
    }
    if (bias.sourcePreferences.reddit > 1.5 && context.redditMentions > 0) {
      factors.push('Reddit mentions');
    }
    if (bias.contentPreferences.freshness > 1.3 && context.freshnessScore > 70) {
      factors.push('Content freshness');
    }

    return factors.length > 0 ? factors : ['General visibility factors'];
  }

  /**
   * Generate engine-specific recommendations
   */
  private generateEngineRecommendations(
    engine: EngineKey,
    context: any,
    bias: EngineBias
  ): string[] {
    const recommendations: string[] = [];

    if (context.licensedCitations === 0 && bias.sourcePreferences.licensedPublishers > 2.0) {
      recommendations.push(`Secure citations from licensed publishers (${engine} heavily weights these)`);
    }

    if (context.schemaScore < 70 && bias.contentPreferences.schemaMarkup > 1.5) {
      recommendations.push(`Improve schema.org markup (${engine} prefers structured data)`);
    }

    if (context.citationDepth < 50 && bias.behaviorTraits.prefersCitations) {
      recommendations.push(`Build more citations (${engine} values citation-heavy content)`);
    }

    if (context.redditMentions === 0 && bias.sourcePreferences.reddit > 2.0) {
      recommendations.push(`Build Reddit presence (${engine} values Reddit discussions)`);
    }

    if (context.freshnessScore < 60 && bias.contentPreferences.freshness > 1.3) {
      recommendations.push(`Update content more frequently (${engine} prefers fresh content)`);
    }

    if (recommendations.length === 0) {
      recommendations.push(`Maintain current optimization strategy for ${engine}`);
    }

    return recommendations;
  }
}


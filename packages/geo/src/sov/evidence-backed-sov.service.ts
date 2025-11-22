import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { EvidenceCollectorService, ShareOfVoiceEvidence } from '../evidence/evidence-collector.service';
import { DiagnosticIntelligenceService } from '../diagnostics/diagnostic-intelligence.service';
import {
  DiagnosticInsight,
  DiagnosticRecommendation,
} from '../types/diagnostic.types';

export interface EvidenceBackedShareOfVoice {
  entity: string;
  totalMentions: number;
  sharePercentage: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
  perEngine: {
    engine: string;
    mentions: number;
    sharePercentage: number;
    evidence: ShareOfVoiceEvidence[];
  }[];
  perPrompt: {
    prompt: string;
    mentions: number;
    position: number; // Average position
    engines: string[]; // Which engines mentioned
    evidence: ShareOfVoiceEvidence[];
  }[];
  evidence: {
    totalEvidencePoints: number;
    confidence: number;
    missingData: string[];
  };
}

@Injectable()
export class EvidenceBackedShareOfVoiceService {
  private readonly logger = new Logger(EvidenceBackedShareOfVoiceService.name);

  private dbPool: Pool;

  constructor(
    private readonly evidenceCollector: EvidenceCollectorService,
    private readonly diagnosticIntelligence: DiagnosticIntelligenceService,
  ) {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Calculate evidence-backed Share of Voice
   */
  async calculateEvidenceBackedSOV(
    workspaceId: string,
    entities: string[]
  ): Promise<EvidenceBackedShareOfVoice[]> {
    const results: EvidenceBackedShareOfVoice[] = [];

    for (const entity of entities) {
      // Get all mentions for this entity
      const mentionsResult = await this.dbPool.query<{
        promptText: string;
        engine: string;
        sentiment: string;
        position: number;
      }>(
        `SELECT
           p."text" AS "promptText",
           e."key" AS "engine",
           m."sentiment",
           ROW_NUMBER() OVER (PARTITION BY pr.id, e.id ORDER BY a."createdAt", m."position") AS "position"
         FROM "mentions" m
         JOIN "answers" a ON a.id = m."answerId"
         JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
         JOIN "prompts" p ON p.id = pr."promptId"
         JOIN "engines" e ON e.id = pr."engineId"
         WHERE pr."workspaceId" = $1
           AND LOWER(m."brand") = LOWER($2)
           AND pr."status" = 'SUCCESS'
           AND 'demo' = ANY(p."tags")`,
        [workspaceId, entity]
      );

      const mentions = mentionsResult.rows;

      // Collect evidence
      const evidence = await this.evidenceCollector.collectShareOfVoiceEvidence(workspaceId, entity);

      // Calculate totals
      const totalMentions = mentions.length;
      const sentiment = {
        positive: mentions.filter(m => m.sentiment === 'POS').length,
        neutral: mentions.filter(m => m.sentiment === 'NEU').length,
        negative: mentions.filter(m => m.sentiment === 'NEG').length,
      };

      // Calculate per-engine breakdown
      const engineMap = new Map<string, { mentions: number; evidence: ShareOfVoiceEvidence[] }>();
      for (const mention of mentions) {
        const existing = engineMap.get(mention.engine) || { mentions: 0, evidence: [] };
        existing.mentions += 1;
        engineMap.set(mention.engine, existing);
      }

      // Add evidence to engine breakdown
      for (const ev of evidence) {
        const engineData = engineMap.get(ev.engine);
        if (engineData) {
          engineData.evidence.push(ev);
        }
      }

      const perEngine = Array.from(engineMap.entries()).map(([engine, data]) => ({
        engine,
        mentions: data.mentions,
        sharePercentage: 0, // Will be calculated after we know total
        evidence: data.evidence,
      }));

      // Calculate per-prompt breakdown
      const promptMap = new Map<string, {
        mentions: number;
        positions: number[];
        engines: Set<string>;
        evidence: ShareOfVoiceEvidence[];
      }>();

      for (const mention of mentions) {
        const existing = promptMap.get(mention.promptText) || {
          mentions: 0,
          positions: [],
          engines: new Set<string>(),
          evidence: [],
        };
        existing.mentions += 1;
        existing.positions.push(mention.position);
        existing.engines.add(mention.engine);
        promptMap.set(mention.promptText, existing);
      }

      // Add evidence to prompt breakdown
      for (const ev of evidence) {
        const promptData = promptMap.get(ev.prompt);
        if (promptData) {
          promptData.evidence.push(ev);
        }
      }

      const perPrompt = Array.from(promptMap.entries()).map(([prompt, data]) => ({
        prompt,
        mentions: data.mentions,
        position: Math.round(data.positions.reduce((a, b) => a + b, 0) / data.positions.length),
        engines: Array.from(data.engines),
        evidence: data.evidence,
      }));

      // Calculate share percentage (need total mentions across all entities)
      const allMentionsResult = await this.dbPool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count
         FROM "mentions" m
         JOIN "answers" a ON a.id = m."answerId"
         JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
         JOIN "prompts" p ON p.id = pr."promptId"
         WHERE pr."workspaceId" = $1
           AND pr."status" = 'SUCCESS'
           AND 'demo' = ANY(p."tags")`,
        [workspaceId]
      );

      const totalMentionsAll = allMentionsResult.rows[0]?.count || 1;
      const sharePercentage = totalMentions > 0 ? Math.round((totalMentions / totalMentionsAll) * 100) : 0;

      // Calculate per-engine share percentages
      for (const engineData of perEngine) {
        const engineTotalResult = await this.dbPool.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count
           FROM "mentions" m
           JOIN "answers" a ON a.id = m."answerId"
           JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
           JOIN "engines" e ON e.id = pr."engineId"
           JOIN "prompts" p ON p.id = pr."promptId"
           WHERE pr."workspaceId" = $1
             AND e."key" = $2
             AND pr."status" = 'SUCCESS'
             AND 'demo' = ANY(p."tags")`,
          [workspaceId, engineData.engine]
        );

        const engineTotalMentions = engineTotalResult.rows[0]?.count || 1;
        engineData.sharePercentage = engineData.mentions > 0
          ? Math.round((engineData.mentions / engineTotalMentions) * 100)
          : 0;
      }

      // Calculate evidence quality
      const totalEvidencePoints = evidence.length;
      const confidence = Math.min(1.0, totalEvidencePoints / 20); // More evidence = higher confidence
      const missingData: string[] = [];

      if (totalEvidencePoints < 5) {
        missingData.push('Limited evidence collected');
      }
      if (perEngine.length < 3) {
        missingData.push(`Only ${perEngine.length} engines have data`);
      }
      if (perPrompt.length < 3) {
        missingData.push(`Only ${perPrompt.length} prompts have data`);
      }

      results.push({
        entity,
        totalMentions,
        sharePercentage,
        sentiment,
        perEngine,
        perPrompt,
        evidence: {
          totalEvidencePoints,
          confidence,
          missingData,
        },
      });
    }

    // Sort by share percentage descending
    results.sort((a, b) => b.sharePercentage - a.sharePercentage);

    return results;
  }

  /**
   * Get detailed evidence for a specific entity-prompt-engine combination
   */
  async getDetailedEvidence(
    workspaceId: string,
    entity: string,
    prompt?: string,
    engine?: string
  ): Promise<ShareOfVoiceEvidence[]> {
    return this.evidenceCollector.collectShareOfVoiceEvidence(workspaceId, entity);
  }

  /**
   * Generate diagnostic intelligence for Share of Voice
   */
  async generateSOVDiagnostics(
    workspaceId: string,
    sovData: EvidenceBackedShareOfVoice[],
    brandName: string,
    competitors?: string[]
  ): Promise<{
    insights: DiagnosticInsight[];
    recommendations: DiagnosticRecommendation[];
  }> {
    const insights: DiagnosticInsight[] = [];
    const brandSOV = sovData.find(s => s.entity.toLowerCase() === brandName.toLowerCase());
    
    if (!brandSOV) {
      return { insights, recommendations: [] };
    }

    // Analyze share percentage
    if (brandSOV.sharePercentage < 30) {
      insights.push({
        type: 'weakness',
        category: 'visibility',
        title: 'Low Share of Voice',
        description: `Your share of voice is ${brandSOV.sharePercentage}%, below optimal threshold`,
        reasoning: 'Low share of voice means competitors are appearing more frequently in AI responses, reducing your visibility',
        impact: 'high',
        confidence: 0.9,
        evidence: [`Share: ${brandSOV.sharePercentage}%`, `Total mentions: ${brandSOV.totalMentions}`],
      });
    } else if (brandSOV.sharePercentage >= 50) {
      insights.push({
        type: 'strength',
        category: 'visibility',
        title: 'Strong Share of Voice',
        description: `Your share of voice is ${brandSOV.sharePercentage}%, indicating strong visibility`,
        reasoning: 'High share of voice means you appear frequently in AI responses, improving recommendation likelihood',
        impact: 'high',
        confidence: 0.9,
        evidence: [`Share: ${brandSOV.sharePercentage}%`, `Total mentions: ${brandSOV.totalMentions}`],
      });
    }

    // Analyze engine distribution
    const enginesWithLowVisibility = brandSOV.perEngine.filter(e => e.sharePercentage < 20);
    if (enginesWithLowVisibility.length > 0) {
      insights.push({
        type: 'weakness',
        category: 'visibility',
        title: 'Low Visibility on Some Engines',
        description: `Low share of voice on ${enginesWithLowVisibility.length} engine(s)`,
        reasoning: 'Uneven engine distribution reduces overall visibility and recommendation opportunities',
        impact: 'medium',
        confidence: 0.8,
        evidence: enginesWithLowVisibility.map(e => `${e.engine}: ${e.sharePercentage}%`),
        affectedEngines: enginesWithLowVisibility.map(e => e.engine),
      });
    }

    // Analyze sentiment
    const totalSentiment = brandSOV.sentiment.positive + brandSOV.sentiment.neutral + brandSOV.sentiment.negative;
    if (totalSentiment > 0) {
      const positiveRatio = brandSOV.sentiment.positive / totalSentiment;
      if (positiveRatio < 0.5) {
        insights.push({
          type: 'weakness',
          category: 'trust',
          title: 'Low Positive Sentiment',
          description: `Only ${(positiveRatio * 100).toFixed(0)}% of mentions are positive`,
          reasoning: 'Low positive sentiment may reduce trust signals and recommendation frequency',
          impact: 'medium',
          confidence: 0.7,
          evidence: [
            `Positive: ${brandSOV.sentiment.positive}`,
            `Neutral: ${brandSOV.sentiment.neutral}`,
            `Negative: ${brandSOV.sentiment.negative}`,
          ],
        });
      }
    }

    // Analyze prompt distribution
    const promptsWithNoVisibility = brandSOV.perPrompt.filter(p => p.mentions === 0);
    if (promptsWithNoVisibility.length > 0) {
      insights.push({
        type: 'opportunity',
        category: 'visibility',
        title: 'Missing Visibility on High-Value Prompts',
        description: `Not appearing in ${promptsWithNoVisibility.length} prompt(s)`,
        reasoning: 'Missing visibility on prompts represents opportunities to improve share of voice',
        impact: 'high',
        confidence: 0.8,
        evidence: promptsWithNoVisibility.map(p => p.prompt),
      });
    }

    // Compare with competitors
    if (competitors && competitors.length > 0) {
      const competitorSOVs = sovData.filter(s => 
        competitors.some(c => s.entity.toLowerCase().includes(c.toLowerCase()))
      );
      const higherSOVCompetitors = competitorSOVs.filter(c => c.sharePercentage > brandSOV.sharePercentage);
      
      if (higherSOVCompetitors.length > 0) {
        insights.push({
          type: 'threat',
          category: 'competition',
          title: 'Competitors Have Higher Share of Voice',
          description: `${higherSOVCompetitors.length} competitor(s) have higher share of voice`,
          reasoning: 'Competitors with higher share of voice are more likely to be recommended by AI engines',
          impact: 'high',
          confidence: 0.9,
          evidence: higherSOVCompetitors.map(c => `${c.entity}: ${c.sharePercentage}% vs your ${brandSOV.sharePercentage}%`),
          relatedCompetitors: higherSOVCompetitors.map(c => c.entity),
        });
      }
    }

    // Generate recommendations
    const recommendations = await this.diagnosticIntelligence.generateRecommendations(workspaceId, insights, {
      category: 'share_of_voice',
      currentScore: brandSOV.sharePercentage,
      maxScore: 100,
    });

    // Add SOV-specific recommendations
    if (brandSOV.sharePercentage < 30) {
      recommendations.push({
        id: `sov-improvement-${Date.now()}`,
        title: 'Increase Share of Voice',
        description: `Improve share of voice from ${brandSOV.sharePercentage}% to target 40%+`,
        category: 'content',
        priority: 'high',
        difficulty: 'medium',
        expectedImpact: {
          visibilityGain: Math.max(10, 40 - brandSOV.sharePercentage),
          description: `Expected ${Math.max(10, 40 - brandSOV.sharePercentage)}% increase in share of voice`,
        },
        steps: [
          'Optimize content for high-value prompts where you\'re missing',
          'Build more authoritative citations',
          'Improve schema markup for better entity recognition',
          'Create content addressing competitor-controlled prompts',
        ],
        relatedInsights: insights.filter(i => i.type === 'weakness' || i.type === 'opportunity').map((_, idx) => `insight-${idx}`),
        estimatedTime: '4-8 weeks',
        evidence: [`Current share: ${brandSOV.sharePercentage}%`, `Target: 40%+`],
      });
    }

    return { insights, recommendations };
  }
}


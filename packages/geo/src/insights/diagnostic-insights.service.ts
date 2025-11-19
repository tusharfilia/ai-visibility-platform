import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { SchemaAuditorService } from '../structural/schema-auditor';
import { StructuralScoringService } from '../structural/structural-scoring.service';
import { TrustSignalAggregator } from '../trust/trust-signal-aggregator.service';
import { ShareOfVoiceCalculatorService } from '../sov/share-of-voice-calculator.service';

export interface DiagnosticInsight {
  type: 'visibility_blocker' | 'trust_gap' | 'schema_gap' | 'listing_inconsistency' | 
        'reputation_weakness' | 'content_gap' | 'competitor_advantage' | 
        'hallucination_risk' | 'missing_fact';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence: string[];
  impact: {
    score: number; // 0-100
    engines: string[]; // Which engines are affected
    estimatedImpact?: string; // Human-readable impact estimate
  };
  recommendations: string[];
  actionable: boolean;
}

export interface DiagnosticInsightsResult {
  insights: DiagnosticInsight[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  topIssues: DiagnosticInsight[];
  byCategory: {
    visibility: DiagnosticInsight[];
    trust: DiagnosticInsight[];
    structure: DiagnosticInsight[];
    content: DiagnosticInsight[];
    competitive: DiagnosticInsight[];
  };
}

@Injectable()
export class DiagnosticInsightsService {
  private dbPool: Pool;

  constructor(
    private schemaAuditor: SchemaAuditorService,
    private structuralScoring: StructuralScoringService,
    private trustAggregator: TrustSignalAggregator,
    private sovCalculator: ShareOfVoiceCalculatorService
  ) {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Generate comprehensive diagnostic insights
   */
  async generateInsights(
    workspaceId: string,
    brandName: string,
    domain?: string,
    competitors: string[] = []
  ): Promise<DiagnosticInsightsResult> {
    const insights: DiagnosticInsight[] = [];

    // Run all diagnostic checks in parallel
    const [
      visibilityBlockers,
      trustGaps,
      schemaGaps,
      listingInconsistencies,
      reputationWeaknesses,
      contentGaps,
      competitorAdvantages,
      hallucinationRisks,
      missingFacts,
    ] = await Promise.all([
      this.detectVisibilityBlockers(workspaceId, brandName),
      this.detectTrustGaps(workspaceId),
      this.detectSchemaGaps(workspaceId, domain),
      this.detectListingInconsistencies(workspaceId),
      this.detectReputationWeaknesses(workspaceId, brandName),
      this.detectContentGaps(workspaceId, brandName),
      this.detectCompetitorAdvantages(workspaceId, brandName, competitors),
      this.detectHallucinationRisks(workspaceId, brandName),
      this.detectMissingFacts(workspaceId, brandName),
    ]);

    insights.push(
      ...visibilityBlockers,
      ...trustGaps,
      ...schemaGaps,
      ...listingInconsistencies,
      ...reputationWeaknesses,
      ...contentGaps,
      ...competitorAdvantages,
      ...hallucinationRisks,
      ...missingFacts
    );

    // Sort by severity and impact
    insights.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.impact.score - a.impact.score;
    });

    // Calculate summary
    const summary = {
      critical: insights.filter(i => i.severity === 'critical').length,
      high: insights.filter(i => i.severity === 'high').length,
      medium: insights.filter(i => i.severity === 'medium').length,
      low: insights.filter(i => i.severity === 'low').length,
      total: insights.length,
    };

    // Top issues (top 10)
    const topIssues = insights.slice(0, 10);

    // Group by category
    const byCategory = {
      visibility: insights.filter(i => i.type === 'visibility_blocker'),
      trust: insights.filter(i => i.type === 'trust_gap' || i.type === 'reputation_weakness'),
      structure: insights.filter(i => i.type === 'schema_gap' || i.type === 'listing_inconsistency'),
      content: insights.filter(i => i.type === 'content_gap' || i.type === 'missing_fact'),
      competitive: insights.filter(i => i.type === 'competitor_advantage'),
    };

    return {
      insights,
      summary,
      topIssues,
      byCategory,
    };
  }

  /**
   * Detect visibility blockers
   */
  private async detectVisibilityBlockers(
    workspaceId: string,
    brandName: string
  ): Promise<DiagnosticInsight[]> {
    const insights: DiagnosticInsight[] = [];

    // Check engine coverage
    const engineQuery = `
      SELECT DISTINCT e."key" AS "engine"
      FROM "prompt_runs" pr
      JOIN "engines" e ON e.id = pr."engineId"
      JOIN "answers" a ON a."promptRunId" = pr.id
      JOIN "mentions" m ON m."answerId" = a.id
      WHERE pr."workspaceId" = $1
        AND pr."status" = 'SUCCESS'
        AND LOWER(m."brand") = LOWER($2)
    `;

    const engineResult = await this.dbPool.query(engineQuery, [workspaceId, brandName]);
    const enginesWithMentions = new Set(engineResult.rows.map((r: any) => r.engine));
    const allEngines = ['PERPLEXITY', 'BRAVE', 'AIO'];
    const missingEngines = allEngines.filter(e => !enginesWithMentions.has(e));

    if (missingEngines.length > 0) {
      insights.push({
        type: 'visibility_blocker',
        severity: missingEngines.length === allEngines.length ? 'critical' : 'high',
        title: `Missing visibility in ${missingEngines.length} AI engine(s)`,
        description: `Your business is not appearing in ${missingEngines.join(', ')} search results, limiting your AI visibility.`,
        evidence: [
          `No mentions found in ${missingEngines.join(', ')}`,
          `Only visible in ${enginesWithMentions.size} of ${allEngines.length} engines`,
        ],
        impact: {
          score: missingEngines.length * 25, // 25 points per missing engine
          engines: missingEngines,
          estimatedImpact: `Missing ${missingEngines.length * 33}% of potential AI search visibility`,
        },
        recommendations: [
          `Optimize content for ${missingEngines.join(' and ')}`,
          `Build citations from sources preferred by ${missingEngines.join(', ')}`,
          `Ensure schema markup is complete for better engine recognition`,
        ],
        actionable: true,
      });
    }

    // Check mention frequency
    const mentionQuery = `
      SELECT COUNT(*)::int AS "count"
      FROM "mentions" m
      JOIN "answers" a ON a.id = m."answerId"
      JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
      WHERE pr."workspaceId" = $1
        AND LOWER(m."brand") = LOWER($2)
    `;

    const mentionResult = await this.dbPool.query(mentionQuery, [workspaceId, brandName]);
    const mentionCount = mentionResult.rows[0]?.count || 0;

    if (mentionCount === 0) {
      insights.push({
        type: 'visibility_blocker',
        severity: 'critical',
        title: 'No mentions found in AI search results',
        description: 'Your business is not appearing in any AI-generated search answers, indicating a critical visibility issue.',
        evidence: [
          'Zero mentions across all analyzed prompts',
          'No citations found',
        ],
        impact: {
          score: 100,
          engines: allEngines,
          estimatedImpact: 'Complete lack of AI visibility - 0% share of voice',
        },
        recommendations: [
          'Build authoritative citations from licensed publishers',
          'Optimize website content for AI discovery',
          'Ensure proper schema.org markup',
          'Create content that answers common customer questions',
        ],
        actionable: true,
      });
    } else if (mentionCount < 5) {
      insights.push({
        type: 'visibility_blocker',
        severity: 'high',
        title: 'Very low mention frequency',
        description: `Only ${mentionCount} mention(s) found across all analyzed prompts, indicating limited AI visibility.`,
        evidence: [
          `Only ${mentionCount} mention(s) in search results`,
          'Low share of voice compared to competitors',
        ],
        impact: {
          score: 70,
          engines: allEngines,
          estimatedImpact: 'Significantly below average visibility',
        },
        recommendations: [
          'Increase citation building efforts',
          'Improve content quality and relevance',
          'Target high-intent search queries',
        ],
        actionable: true,
      });
    }

    return insights;
  }

  /**
   * Detect trust gaps
   */
  private async detectTrustGaps(workspaceId: string): Promise<DiagnosticInsight[]> {
    const insights: DiagnosticInsight[] = [];

    // Check verified status
    const profileQuery = 'SELECT "verified" FROM "workspace_profiles" WHERE "workspaceId" = $1';
    const profileResult = await this.dbPool.query(profileQuery, [workspaceId]);
    const profile = profileResult.rows[0];

    if (!profile?.verified) {
      insights.push({
        type: 'trust_gap',
        severity: 'high',
        title: 'Unverified business profile',
        description: 'Your business profile is not verified, which can reduce trust signals for AI engines.',
        evidence: [
          'Workspace profile not verified',
          'Missing verification badges',
        ],
        impact: {
          score: 60,
          engines: ['PERPLEXITY', 'BRAVE', 'AIO'],
          estimatedImpact: 'Reduced trust signals may lower AI engine confidence',
        },
        recommendations: [
          'Complete business verification process',
          'Claim and verify directory listings',
          'Add trust badges and certifications',
        ],
        actionable: true,
      });
    }

    // Check licensed publisher citations
    const licensedQuery = `
      SELECT COUNT(*)::int AS "count"
      FROM "citations" c
      JOIN "answers" a ON a.id = c."answerId"
      JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
      WHERE pr."workspaceId" = $1
        AND c."isLicensed" = true
    `;

    const licensedResult = await this.dbPool.query(licensedQuery, [workspaceId]);
    const licensedCount = licensedResult.rows[0]?.count || 0;

    if (licensedCount === 0) {
      insights.push({
        type: 'trust_gap',
        severity: 'high',
        title: 'No licensed publisher citations',
        description: 'No citations from licensed publishers (News Corp, FT, etc.) found, which are highly trusted by AI engines.',
        evidence: [
          'Zero licensed publisher citations',
          'Missing high-authority backlinks',
        ],
        impact: {
          score: 75,
          engines: ['CHATGPT', 'PERPLEXITY', 'GEMINI'],
          estimatedImpact: 'Missing highest-trust citation sources',
        },
        recommendations: [
          'Secure press mentions from licensed publishers',
          'Build relationships with authoritative news sources',
          'Create newsworthy content for press coverage',
        ],
        actionable: true,
      });
    }

    return insights;
  }

  /**
   * Detect schema gaps
   */
  private async detectSchemaGaps(
    workspaceId: string,
    domain?: string
  ): Promise<DiagnosticInsight[]> {
    const insights: DiagnosticInsight[] = [];

    if (!domain) {
      return insights;
    }

    try {
      const schemaAudit = await this.schemaAuditor.auditPage(domain);
      
      if (schemaAudit.coverageScore < 50) {
        insights.push({
          type: 'schema_gap',
          severity: schemaAudit.coverageScore < 20 ? 'critical' : 'high',
          title: 'Incomplete or missing schema.org markup',
          description: `Schema coverage score is ${schemaAudit.coverageScore}/100, limiting AI engine understanding of your business.`,
          evidence: [
            `Schema coverage: ${schemaAudit.coverageScore}/100`,
            ...schemaAudit.recommendations.slice(0, 3),
          ],
          impact: {
            score: 100 - schemaAudit.coverageScore,
            engines: ['GEMINI', 'AIO', 'BRAVE'],
            estimatedImpact: 'AI engines may not properly understand business structure',
          },
          recommendations: schemaAudit.recommendations.slice(0, 5),
          actionable: true,
        });
      }

      // Check for specific missing schema types
      const missingTypes: string[] = [];
      if (!schemaAudit.schemaTypes.find((s: any) => s.type?.includes('Organization'))) {
        missingTypes.push('Organization');
      }
      if (!schemaAudit.schemaTypes.find((s: any) => s.type?.includes('LocalBusiness'))) {
        missingTypes.push('LocalBusiness');
      }

      if (missingTypes.length > 0) {
        insights.push({
          type: 'schema_gap',
          severity: 'medium',
          title: `Missing critical schema types: ${missingTypes.join(', ')}`,
          description: `Your website is missing ${missingTypes.join(' and ')} schema markup, which helps AI engines understand your business.`,
          evidence: [
            `Missing schema types: ${missingTypes.join(', ')}`,
            'Schema coverage could be improved',
          ],
          impact: {
            score: missingTypes.length * 20,
            engines: ['GEMINI', 'AIO'],
            estimatedImpact: 'Reduced entity recognition accuracy',
          },
          recommendations: [
            `Add ${missingTypes.join(' and ')} schema markup`,
            'Use structured data testing tool to validate',
            'Ensure schema is properly formatted JSON-LD',
          ],
          actionable: true,
        });
      }
    } catch (error) {
      // Schema audit failed, but don't create insight for technical errors
      console.warn('Schema audit failed:', error);
    }

    return insights;
  }

  /**
   * Detect listing inconsistencies
   */
  private async detectListingInconsistencies(workspaceId: string): Promise<DiagnosticInsight[]> {
    const insights: DiagnosticInsight[] = [];

    // Check for inconsistent NAP (Name, Address, Phone) across citations
    const napQuery = `
      SELECT 
        c."domain",
        COUNT(DISTINCT c."url")::int AS "citationCount"
      FROM "citations" c
      JOIN "answers" a ON a.id = c."answerId"
      JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
      WHERE pr."workspaceId" = $1
        AND c."directoryType" IS NOT NULL
      GROUP BY c."domain"
      HAVING COUNT(DISTINCT c."url") > 1
    `;

    const napResult = await this.dbPool.query(napQuery, [workspaceId]);
    
    if (napResult.rows.length > 0) {
      insights.push({
        type: 'listing_inconsistency',
        severity: 'medium',
        title: 'Potential listing inconsistencies detected',
        description: 'Multiple citations from the same directory domain found, which may indicate inconsistent business information.',
        evidence: [
          `${napResult.rows.length} directory domain(s) with multiple citations`,
          'Possible NAP (Name, Address, Phone) inconsistencies',
        ],
        impact: {
          score: 50,
          engines: ['BRAVE', 'AIO'],
          estimatedImpact: 'Inconsistent data may reduce entity trust',
        },
        recommendations: [
          'Audit all directory listings for consistency',
          'Ensure NAP information matches across all platforms',
          'Use a directory management tool to sync listings',
        ],
        actionable: true,
      });
    }

    return insights;
  }

  /**
   * Detect reputation weaknesses
   */
  private async detectReputationWeaknesses(
    workspaceId: string,
    brandName: string
  ): Promise<DiagnosticInsight[]> {
    const insights: DiagnosticInsight[] = [];

    // Check sentiment distribution
    const sentimentQuery = `
      SELECT 
        m."sentiment",
        COUNT(*)::int AS "count"
      FROM "mentions" m
      JOIN "answers" a ON a.id = m."answerId"
      JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
      WHERE pr."workspaceId" = $1
        AND LOWER(m."brand") = LOWER($2)
      GROUP BY m."sentiment"
    `;

    const sentimentResult = await this.dbPool.query(sentimentQuery, [workspaceId, brandName]);
    const sentimentMap = new Map<string, number>();
    let total = 0;

    for (const row of sentimentResult.rows) {
      sentimentMap.set(row.sentiment, row.count);
      total += row.count;
    }

    if (total > 0) {
      const positive = sentimentMap.get('POS') || 0;
      const negative = sentimentMap.get('NEG') || 0;
      const positiveRatio = positive / total;
      const negativeRatio = negative / total;

      if (negativeRatio > 0.3) {
        insights.push({
          type: 'reputation_weakness',
          severity: negativeRatio > 0.5 ? 'critical' : 'high',
          title: 'High negative sentiment in AI mentions',
          description: `${(negativeRatio * 100).toFixed(1)}% of mentions are negative, which can harm AI visibility and trust.`,
          evidence: [
            `${negative} negative mentions out of ${total} total`,
            `Only ${(positiveRatio * 100).toFixed(1)}% positive sentiment`,
          ],
          impact: {
            score: negativeRatio * 100,
            engines: ['PERPLEXITY', 'BRAVE', 'AIO'],
            estimatedImpact: 'Negative sentiment may reduce AI engine recommendations',
          },
          recommendations: [
            'Address negative feedback and reviews',
            'Improve customer service and product quality',
            'Build positive citations and testimonials',
            'Monitor and respond to reputation issues',
          ],
          actionable: true,
        });
      }

      if (positiveRatio < 0.3 && total > 5) {
        insights.push({
          type: 'reputation_weakness',
          severity: 'medium',
          title: 'Low positive sentiment ratio',
          description: `Only ${(positiveRatio * 100).toFixed(1)}% of mentions are positive, indicating room for reputation improvement.`,
          evidence: [
            `Low positive sentiment: ${(positiveRatio * 100).toFixed(1)}%`,
            `${positive} positive out of ${total} total mentions`,
          ],
          impact: {
            score: (1 - positiveRatio) * 60,
            engines: ['PERPLEXITY', 'BRAVE'],
            estimatedImpact: 'Neutral/negative sentiment may limit recommendations',
          },
          recommendations: [
            'Focus on generating positive reviews and testimonials',
            'Highlight customer success stories',
            'Improve product/service quality',
          ],
          actionable: true,
        });
      }
    }

    return insights;
  }

  /**
   * Detect content gaps
   */
  private async detectContentGaps(
    workspaceId: string,
    brandName: string
  ): Promise<DiagnosticInsight[]> {
    const insights: DiagnosticInsight[] = [];

    // Check for FAQ schema (indicates content completeness)
    // This would require domain access, so we'll use a simpler check
    const citationQuery = `
      SELECT COUNT(DISTINCT c."domain")::int AS "domainCount"
      FROM "citations" c
      JOIN "answers" a ON a.id = c."answerId"
      JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
      WHERE pr."workspaceId" = $1
    `;

    const citationResult = await this.dbPool.query(citationQuery, [workspaceId]);
    const domainCount = citationResult.rows[0]?.domainCount || 0;

    if (domainCount < 3) {
      insights.push({
        type: 'content_gap',
        severity: 'high',
        title: 'Limited citation diversity',
        description: `Only ${domainCount} unique domain(s) cited, indicating limited content coverage and authority.`,
        evidence: [
          `Only ${domainCount} unique citation domain(s)`,
          'Low content diversity in citations',
        ],
        impact: {
          score: (3 - domainCount) * 25,
          engines: ['PERPLEXITY', 'BRAVE', 'AIO'],
          estimatedImpact: 'Limited content sources may reduce AI confidence',
        },
        recommendations: [
          'Create content on multiple platforms',
          'Build citations from diverse authoritative sources',
          'Publish on industry blogs and directories',
        ],
        actionable: true,
      });
    }

    return insights;
  }

  /**
   * Detect competitor advantages
   */
  private async detectCompetitorAdvantages(
    workspaceId: string,
    brandName: string,
    competitors: string[]
  ): Promise<DiagnosticInsight[]> {
    const insights: DiagnosticInsight[] = [];

    if (competitors.length === 0) {
      return insights;
    }

    // Calculate SOV comparison
    const sovResult = await this.sovCalculator.calculateShareOfVoice(workspaceId, brandName, competitors);
    
    const brandSOV = sovResult.overall.brandSOV;
    const topCompetitor = sovResult.overall.competitorSOV[0];

    if (topCompetitor && topCompetitor.sov > brandSOV) {
      const gap = topCompetitor.sov - brandSOV;
      insights.push({
        type: 'competitor_advantage',
        severity: gap > 20 ? 'high' : 'medium',
        title: `${topCompetitor.brand} leads in share of voice`,
        description: `${topCompetitor.brand} has ${gap.toFixed(1)}% higher share of voice than ${brandName}, indicating stronger AI visibility.`,
        evidence: [
          `${topCompetitor.brand}: ${topCompetitor.sov.toFixed(1)}% SOV`,
          `${brandName}: ${brandSOV.toFixed(1)}% SOV`,
          `Gap: ${gap.toFixed(1)} percentage points`,
        ],
        impact: {
          score: gap * 2,
          engines: ['PERPLEXITY', 'BRAVE', 'AIO'],
          estimatedImpact: `Competitor has ${gap.toFixed(1)}% advantage in AI visibility`,
        },
        recommendations: [
          `Analyze ${topCompetitor.brand}'s citation strategy`,
          'Build more authoritative citations',
          'Improve content quality and relevance',
          'Target high-intent queries where competitor appears',
        ],
        actionable: true,
      });
    }

    return insights;
  }

  /**
   * Detect hallucination risks
   */
  private async detectHallucinationRisks(
    workspaceId: string,
    brandName: string
  ): Promise<DiagnosticInsight[]> {
    const insights: DiagnosticInsight[] = [];

    // Check for low citation count (more likely to hallucinate)
    const citationQuery = `
      SELECT COUNT(*)::int AS "count"
      FROM "citations" c
      JOIN "answers" a ON a.id = c."answerId"
      JOIN "prompt_runs" pr ON pr.id = a."promptRunId"
      WHERE pr."workspaceId" = $1
    `;

    const citationResult = await this.dbPool.query(citationQuery, [workspaceId]);
    const citationCount = citationResult.rows[0]?.count || 0;

    if (citationCount < 5) {
      insights.push({
        type: 'hallucination_risk',
        severity: 'medium',
        title: 'Low citation count increases hallucination risk',
        description: `Only ${citationCount} citation(s) found. Low citation density increases the risk of AI engines hallucinating or making up information about your business.`,
        evidence: [
          `Only ${citationCount} citation(s) across all answers`,
          'Limited source material for AI engines',
        ],
        impact: {
          score: (5 - citationCount) * 15,
          engines: ['CHATGPT', 'PERPLEXITY', 'GEMINI'],
          estimatedImpact: 'Higher risk of inaccurate or fabricated information',
        },
        recommendations: [
          'Build more authoritative citations',
          'Create comprehensive content about your business',
          'Ensure key facts are well-documented online',
          'Publish on trusted, crawlable platforms',
        ],
        actionable: true,
      });
    }

    return insights;
  }

  /**
   * Detect missing facts
   */
  private async detectMissingFacts(
    workspaceId: string,
    brandName: string
  ): Promise<DiagnosticInsight[]> {
    const insights: DiagnosticInsight[] = [];

    // Check profile completeness
    const profileQuery = `
      SELECT 
        "businessName",
        "description",
        "address",
        "services"
      FROM "workspace_profiles"
      WHERE "workspaceId" = $1
    `;

    const profileResult = await this.dbPool.query(profileQuery, [workspaceId]);
    const profile = profileResult.rows[0];

    const missingFields: string[] = [];
    if (!profile?.businessName) missingFields.push('Business name');
    if (!profile?.description || profile.description.length < 50) missingFields.push('Description');
    if (!profile?.address) missingFields.push('Address');
    if (!profile?.services || (Array.isArray(profile.services) && profile.services.length === 0)) {
      missingFields.push('Services');
    }

    if (missingFields.length > 0) {
      insights.push({
        type: 'missing_fact',
        severity: missingFields.length > 2 ? 'high' : 'medium',
        title: `Missing business information: ${missingFields.join(', ')}`,
        description: `Your business profile is missing ${missingFields.join(', ').toLowerCase()}, which AI engines need to understand your business.`,
        evidence: [
          `Missing fields: ${missingFields.join(', ')}`,
          'Incomplete business profile',
        ],
        impact: {
          score: missingFields.length * 20,
          engines: ['GEMINI', 'AIO', 'PERPLEXITY'],
          estimatedImpact: 'AI engines may not have complete business information',
        },
        recommendations: [
          `Complete your business profile with ${missingFields.join(', ').toLowerCase()}`,
          'Ensure all key business facts are documented',
          'Add structured data to your website',
        ],
        actionable: true,
      });
    }

    return insights;
  }
}


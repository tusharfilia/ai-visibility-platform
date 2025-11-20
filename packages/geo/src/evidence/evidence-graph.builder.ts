/**
 * Evidence Graph Builder Service
 * Aggregates citations and mentions into an entity evidence graph with credibility, freshness, and verification
 */

import { Injectable, Optional, Inject } from '@nestjs/common';
import { CitationClassifierService, CitationSourceType } from '../citations/citation-classifier.service';
import { FactExtractorService, ExtractedFact } from './fact-extractor.service';
import { Pool } from 'pg';

// Token to distinguish evidence package's FactExtractorService from validation package's
export const EVIDENCE_FACT_EXTRACTOR_TOKEN = Symbol('EvidenceFactExtractorService');

export interface EvidenceNode {
  id: string;
  type: 'citation' | 'reddit_mention' | 'directory_listing' | 'licensed_content' | 'curated_content';
  source: string;
  sourceDomain: string;
  sourceType: CitationSourceType;
  citationUrl?: string;
  evidenceText: string;
  authority: number;
  freshness: Date;
  verified: boolean;
  workspaceId: string;
  entityType: string;
}

export interface EvidenceEdge {
  from: string;
  to: string;
  relationship: 'cites' | 'confirms' | 'contradicts' | 'supports';
  credibility: number;
  evidenceCount: number;
}

export interface EntityEvidenceGraph {
  entity: {
    workspaceId: string;
    entityType: string;
    name?: string;
  };
  evidenceNodes: EvidenceNode[];
  edges: EvidenceEdge[];
  consensusScore: number;
  metadata: {
    totalEvidence: number;
    licensedPublisherCount: number;
    redditMentionCount: number;
    directoryCount: number;
    curatedCount: number;
    averageAuthority: number;
    averageFreshness: number;
    verifiedCount: number;
    lastUpdated: Date;
  };
}

export interface FactConsensusScore {
  factType: string;
  consensus: number; // 0-100
  agreementCount: number;
  contradictionCount: number;
  independentSources: number;
  facts: ExtractedFact[];
  mostCommonValue?: string;
  validation: {
    validated: boolean;
    validationScore: number; // 0-100
    crossEngineConsensus: number; // 0-100
    trustedSourceCount: number;
    conflictingSourceCount: number;
  };
}

@Injectable()
export class EvidenceGraphBuilderService {
  constructor(
    private classifier: CitationClassifierService,
    @Inject(EVIDENCE_FACT_EXTRACTOR_TOKEN) private factExtractor: FactExtractorService,
    @Optional() private dbPool?: Pool
  ) {
    if (!this.dbPool) {
      this.dbPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });
    }
  }

  /**
   * Build evidence graph for a workspace entity
   */
  async buildEvidenceGraph(workspaceId: string): Promise<EntityEvidenceGraph> {
    try {
      // Get workspace profile (optional - use empty object if not found)
      let profile: any = {};
      try {
        const profileResult = await this.dbPool!.query(
          'SELECT * FROM "workspace_profiles" WHERE "workspaceId" = $1',
          [workspaceId]
        );
        profile = profileResult.rows[0] || {};
      } catch (error) {
        // Table might not exist or no profile found - continue with empty profile
        console.warn(`Workspace profile not accessible: ${(error as Error).message}`);
        profile = {};
      }

      // Get all citations for this workspace
      const citations = await this.getCitations(workspaceId);
      
      // Get all mentions
      const mentions = await this.getMentions(workspaceId);

      // Aggregate evidence from citations and mentions
      const evidenceNodes = await this.aggregateEvidence(citations, mentions, workspaceId, 'workspace');

      // Calculate consensus score
      const consensusScore = await this.calculateConsensusScore(evidenceNodes);

      // Build edges (relationships between evidence nodes)
      const edges = await this.buildEdges(evidenceNodes);

      // Link entity to evidence
      const entityEvidence = await this.linkEntityToEvidence(
        { workspaceId, entityType: 'workspace', name: profile.businessName },
        evidenceNodes
      );

      // Calculate metadata
      const metadata = this.calculateMetadata(evidenceNodes);

      return {
        entity: {
          workspaceId,
          entityType: 'workspace',
          name: profile.businessName,
        },
        evidenceNodes,
        edges,
        consensusScore,
        metadata,
      };

    } catch (error) {
      console.error('Error building evidence graph:', error);
      throw new Error(`Failed to build evidence graph: ${error.message}`);
    }
  }

  /**
   * Aggregate evidence from citations and mentions
   */
  async aggregateEvidence(
    citations: any[],
    mentions: any[],
    workspaceId: string,
    entityType: string
  ): Promise<EvidenceNode[]> {
    const evidenceNodes: EvidenceNode[] = [];
    const nodeMap = new Map<string, EvidenceNode>();

    // Process citations
    for (const citation of citations) {
      const classification = await this.classifier.classifyCitation(citation);
      
      // Get or create evidence node for this citation
      const nodeKey = `${citation.domain}_${classification.sourceType}`;
      
      if (!nodeMap.has(nodeKey)) {
        const authorityScore = citation.authorityScore || await this.calculateAuthorityScore(citation, classification);
        const freshness = citation.freshness || new Date();

        const node: EvidenceNode = {
          id: `evidence_${citation.id}`,
          type: this.mapSourceTypeToEvidenceType(classification.sourceType),
          source: citation.domain,
          sourceDomain: citation.domain,
          sourceType: classification.sourceType,
          citationUrl: citation.url,
          evidenceText: citation.url, // In production, extract actual text from citation
          authority: authorityScore,
          freshness: freshness instanceof Date ? freshness : new Date(freshness),
          verified: classification.isLicensed || false,
          workspaceId,
          entityType,
        };

        nodeMap.set(nodeKey, node);
        evidenceNodes.push(node);
      } else {
        // Update existing node (merge evidence)
        const existing = nodeMap.get(nodeKey);
        existing.evidenceText += `; ${citation.url}`;
        existing.authority = Math.max(existing.authority, citation.authorityScore || 0);
      }
    }

    // Process mentions (treat as additional evidence)
    for (const mention of mentions) {
      const node: EvidenceNode = {
        id: `mention_${mention.id}`,
        type: 'curated_content',
        source: 'ai_response',
        sourceDomain: 'ai_response',
        sourceType: 'user_generated',
        evidenceText: mention.snippet || '',
        authority: 0.5, // Mentions have lower authority than citations
        freshness: new Date(),
        verified: false,
        workspaceId,
        entityType,
      };

      evidenceNodes.push(node);
    }

    return evidenceNodes;
  }

  /**
   * Calculate consensus score across evidence nodes
   */
  async calculateConsensusScore(evidenceNodes: EvidenceNode[]): Promise<number> {
    if (evidenceNodes.length === 0) {
      return 0;
    }

    // Group evidence by source type
    const sourceGroups = new Map<CitationSourceType, EvidenceNode[]>();
    
    for (const node of evidenceNodes) {
      if (!sourceGroups.has(node.sourceType)) {
        sourceGroups.set(node.sourceType, []);
      }
      sourceGroups.get(node.sourceType).push(node);
    }

    // Calculate consensus: number of independent source types / total possible sources
    const independentSources = sourceGroups.size;
    const totalPossibleSources = 5; // licensed_publisher, curated, directory, reddit, user_generated
    const consensusScore = (independentSources / totalPossibleSources) * 100;

    // Boost consensus if we have licensed publishers
    const licensedCount = (sourceGroups.get('licensed_publisher') || []).length;
    if (licensedCount > 0) {
      return Math.min(100, consensusScore + (licensedCount * 10));
    }

    return Math.round(consensusScore);
  }

  /**
   * Calculate fact-level consensus scores
   * Tracks agreements/contradictions for specific facts (address, hours, phone, etc.)
   */
  async calculateFactLevelConsensus(
    workspaceId: string,
    factType?: 'address' | 'hours' | 'phone' | 'services' | 'pricing' | 'features'
  ): Promise<FactConsensusScore[]> {
    try {
      // Build evidence graph
      const evidenceGraph = await this.buildEvidenceGraph(workspaceId);
      const evidenceNodes = evidenceGraph.evidenceNodes;

      // Extract facts from all evidence nodes
      const allFacts: ExtractedFact[] = [];
      for (const node of evidenceNodes) {
        const facts = await this.factExtractor.extractFacts(
          node.evidenceText,
          node.id,
          node.sourceType
        );
        allFacts.push(...facts);
      }

      // Filter by fact type if specified
      const relevantFacts = factType
        ? allFacts.filter(f => f.type === factType)
        : allFacts;

      // Group facts by type
      const factsByType = new Map<string, ExtractedFact[]>();
      for (const fact of relevantFacts) {
        if (!factsByType.has(fact.type)) {
          factsByType.set(fact.type, []);
        }
        factsByType.get(fact.type).push(fact);
      }

      // Calculate consensus per fact type
      const consensusScores: FactConsensusScore[] = [];
      
      for (const [type, facts] of factsByType) {
        if (facts.length === 0) continue;

        // Group facts by normalized value to identify agreements
        const valueGroups = new Map<string, ExtractedFact[]>();
        for (const fact of facts) {
          const normalizedValue = fact.normalizedValue || fact.value.toLowerCase().trim();
          if (!valueGroups.has(normalizedValue)) {
            valueGroups.set(normalizedValue, []);
          }
          valueGroups.get(normalizedValue).push(fact);
        }

        // Identify most common value
        let mostCommonValue: string | undefined;
        let maxCount = 0;
        for (const [value, group] of valueGroups) {
          if (group.length > maxCount) {
            maxCount = group.length;
            mostCommonValue = value;
          }
        }

        // Count agreements (facts matching most common value)
        const agreementCount = maxCount;

        // Count contradictions (facts with different values from different independent sources)
        // A contradiction is when two different values come from different source types
        const sourceTypeMap = new Map<string, Set<CitationSourceType>>();
        for (const [value, group] of valueGroups) {
          if (!sourceTypeMap.has(value)) {
            sourceTypeMap.set(value, new Set());
          }
          group.forEach(fact => {
            sourceTypeMap.get(value).add(fact.sourceType);
          });
        }

        let contradictionCount = 0;
        const values = Array.from(valueGroups.keys());
        for (let i = 0; i < values.length; i++) {
          for (let j = i + 1; j < values.length; j++) {
            const value1 = values[i];
            const value2 = values[j];
            const sources1 = sourceTypeMap.get(value1);
            const sources2 = sourceTypeMap.get(value2);

            // If different values have different independent sources, it's a contradiction
            const hasOverlap = Array.from(sources1).some(s => sources2.has(s));
            if (!hasOverlap && sources1.size > 0 && sources2.size > 0) {
              contradictionCount += Math.min(valueGroups.get(value1).length, valueGroups.get(value2).length);
            }
          }
        }

        // Count independent sources
        const independentSources = new Set(facts.map(f => f.sourceType)).size;

        // Calculate consensus: agreements / (agreements + contradictions + neutral)
        const neutralCount = Math.max(0, facts.length - agreementCount - contradictionCount);
        const total = agreementCount + contradictionCount + neutralCount;
        const consensus = total > 0
          ? Math.round((agreementCount / total) * 100)
          : 0;

        // Enhanced validation: track trusted sources and cross-engine consensus
        const trustedSourceTypes: CitationSourceType[] = ['licensed_publisher', 'curated', 'directory'];
        const trustedFacts = facts.filter(f => trustedSourceTypes.includes(f.sourceType));
        const trustedSourceCount = trustedFacts.length;
        const conflictingSourceCount = contradictionCount;

        // Calculate validation score based on trusted sources agreeing
        const trustedAgreements = trustedFacts.filter(f => 
          f.normalizedValue === mostCommonValue || f.value.toLowerCase().trim() === mostCommonValue
        ).length;
        const validationScore = trustedSourceCount > 0
          ? Math.round((trustedAgreements / trustedSourceCount) * 100)
          : consensus; // Fallback to general consensus if no trusted sources

        // Cross-engine consensus: how many different engines/sources agree
        const crossEngineConsensus = this.calculateCrossEngineConsensus(facts, mostCommonValue);

        // Fact is validated if trusted sources agree and consensus is high
        const validated = validationScore >= 70 && consensus >= 60 && contradictionCount === 0;

        consensusScores.push({
          factType: type,
          consensus,
          agreementCount,
          contradictionCount,
          independentSources,
          facts,
          mostCommonValue: mostCommonValue ? facts.find(f => f.normalizedValue === mostCommonValue)?.value : undefined,
          validation: {
            validated,
            validationScore,
            crossEngineConsensus,
            trustedSourceCount,
            conflictingSourceCount,
          },
        });
      }

      return consensusScores;
    } catch (error) {
      console.error(`Error calculating fact-level consensus for ${workspaceId}:`, error);
      throw new Error(`Failed to calculate fact-level consensus: ${error.message}`);
    }
  }

  /**
   * Build edges between evidence nodes
   */
  async buildEdges(evidenceNodes: EvidenceNode[]): Promise<EvidenceEdge[]> {
    const edges: EvidenceEdge[] = [];
    const edgeMap = new Map<string, EvidenceEdge>();

    // For each pair of evidence nodes, check if they support or contradict each other
    for (let i = 0; i < evidenceNodes.length; i++) {
      for (let j = i + 1; j < evidenceNodes.length; j++) {
        const node1 = evidenceNodes[i];
        const node2 = evidenceNodes[j];

        // Skip if same source
        if (node1.sourceDomain === node2.sourceDomain) {
          continue;
        }

        // Determine relationship
        const relationship = this.determineRelationship(node1, node2);
        
        if (relationship === 'confirms' || relationship === 'supports') {
          const edgeKey = `${node1.id}_${relationship}_${node2.id}`;
          
          if (!edgeMap.has(edgeKey)) {
            const credibility = (node1.authority + node2.authority) / 2;
            
            const edge: EvidenceEdge = {
              from: node1.id,
              to: node2.id,
              relationship,
              credibility,
              evidenceCount: 1,
            };

            edgeMap.set(edgeKey, edge);
            edges.push(edge);
          } else {
            // Strengthen existing edge
            const existing = edgeMap.get(edgeKey);
            existing.evidenceCount++;
            existing.credibility = Math.min(1.0, existing.credibility + 0.1);
          }
        }
      }
    }

    return edges;
  }

  /**
   * Link entity to evidence
   */
  async linkEntityToEvidence(
    entity: { workspaceId: string; entityType: string; name?: string },
    evidenceNodes: EvidenceNode[]
  ): Promise<EntityEvidenceGraph> {
    // This is a helper that returns the full graph structure
    // The main buildEvidenceGraph already does this, so this is for additional linking logic if needed
    
    return {
      entity,
      evidenceNodes,
      edges: [],
      consensusScore: 0,
      metadata: this.calculateMetadata(evidenceNodes),
    };
  }

  /**
   * Calculate metadata from evidence nodes
   */
  private calculateMetadata(evidenceNodes: EvidenceNode[]): EntityEvidenceGraph['metadata'] {
    const licensedPublisherCount = evidenceNodes.filter(n => n.sourceType === 'licensed_publisher').length;
    const redditMentionCount = evidenceNodes.filter(n => n.sourceType === 'reddit').length;
    const directoryCount = evidenceNodes.filter(n => n.sourceType === 'directory').length;
    const curatedCount = evidenceNodes.filter(n => n.sourceType === 'curated').length;
    
    const authorities = evidenceNodes.map(n => n.authority);
    const averageAuthority = authorities.length > 0
      ? authorities.reduce((sum, a) => sum + a, 0) / authorities.length
      : 0;

    const now = Date.now();
    const freshnessScores = evidenceNodes.map(n => {
      const ageInDays = (now - n.freshness.getTime()) / (1000 * 60 * 60 * 24);
      return Math.max(0, 1 - (ageInDays / 365)); // Decay over 1 year
    });
    const averageFreshness = freshnessScores.length > 0
      ? freshnessScores.reduce((sum, f) => sum + f, 0) / freshnessScores.length
      : 0;

    const verifiedCount = evidenceNodes.filter(n => n.verified).length;

    return {
      totalEvidence: evidenceNodes.length,
      licensedPublisherCount,
      redditMentionCount,
      directoryCount,
      curatedCount,
      averageAuthority: Math.round(averageAuthority * 100) / 100,
      averageFreshness: Math.round(averageFreshness * 100) / 100,
      verifiedCount,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get citations for workspace
   */
  private async getCitations(workspaceId: string): Promise<any[]> {
    // Get citations via Answer -> PromptRun -> Workspace chain
    const result = await this.dbPool!.query(`
      SELECT c.*, pr."workspaceId"
      FROM "Citation" c
      INNER JOIN "Answer" a ON c."answerId" = a.id
      INNER JOIN "PromptRun" pr ON a."promptRunId" = pr.id
      WHERE pr."workspaceId" = $1
      ORDER BY c."rank" ASC NULLS LAST
    `, [workspaceId]);

    return result.rows;
  }

  /**
   * Get mentions for workspace
   */
  private async getMentions(workspaceId: string): Promise<any[]> {
    const result = await this.dbPool!.query(`
      SELECT m.*, pr."workspaceId"
      FROM "Mention" m
      INNER JOIN "Answer" a ON m."answerId" = a.id
      INNER JOIN "PromptRun" pr ON a."promptRunId" = pr.id
      WHERE pr."workspaceId" = $1
    `, [workspaceId]);

    return result.rows;
  }

  /**
   * Calculate authority score for citation
   */
  private async calculateAuthorityScore(citation: any, classification: any): Promise<number> {
    let baseAuthority = 0.5;

    // Licensed publishers get highest authority
    if (classification.isLicensed) {
      baseAuthority = 0.9;
    }
    // Curated sources (Wikipedia, academic) get high authority
    else if (classification.sourceType === 'curated') {
      baseAuthority = 0.8;
    }
    // Directories get medium-high authority
    else if (classification.sourceType === 'directory') {
      baseAuthority = 0.7;
    }
    // Reddit gets medium authority
    else if (classification.sourceType === 'reddit') {
      baseAuthority = 0.6;
    }
    // User-generated gets lower authority
    else {
      baseAuthority = 0.4;
    }

    // Adjust by rank if available
    if (citation.rank !== null && citation.rank !== undefined) {
      const rankBoost = Math.max(0, (10 - citation.rank) / 10) * 0.2;
      baseAuthority = Math.min(1.0, baseAuthority + rankBoost);
    }

    // Adjust by confidence if available
    if (citation.confidence !== null && citation.confidence !== undefined) {
      baseAuthority = (baseAuthority + citation.confidence) / 2;
    }

    return Math.round(baseAuthority * 100) / 100;
  }

  /**
   * Map source type to evidence type
   */
  private mapSourceTypeToEvidenceType(sourceType: CitationSourceType): EvidenceNode['type'] {
    const mapping: Record<CitationSourceType, EvidenceNode['type']> = {
      'licensed_publisher': 'licensed_content',
      'curated': 'curated_content',
      'directory': 'directory_listing',
      'reddit': 'reddit_mention',
      'user_generated': 'curated_content',
    };

    return mapping[sourceType] || 'curated_content';
  }

  /**
   * Calculate cross-engine consensus for facts
   * Measures how many different engines/sources agree on a fact value
   */
  private calculateCrossEngineConsensus(
    facts: ExtractedFact[],
    mostCommonValue?: string
  ): number {
    if (!mostCommonValue || facts.length === 0) {
      return 0;
    }

    // Group facts by source type (representing different engines/sources)
    const sourceTypeGroups = new Map<CitationSourceType, ExtractedFact[]>();
    for (const fact of facts) {
      if (!sourceTypeGroups.has(fact.sourceType)) {
        sourceTypeGroups.set(fact.sourceType, []);
      }
      sourceTypeGroups.get(fact.sourceType)!.push(fact);
    }

    // Count how many source types agree with the most common value
    let agreeingSources = 0;
    for (const [sourceType, groupFacts] of sourceTypeGroups) {
      const matchingFacts = groupFacts.filter(f => 
        (f.normalizedValue || f.value.toLowerCase().trim()) === mostCommonValue
      );
      if (matchingFacts.length > 0) {
        agreeingSources++;
      }
    }

    // Consensus = percentage of source types that agree
    const totalSourceTypes = sourceTypeGroups.size;
    return totalSourceTypes > 0
      ? Math.round((agreeingSources / totalSourceTypes) * 100)
      : 0;
  }

  /**
   * Validate facts against workspace profile
   * Checks if extracted facts match known business information
   */
  async validateFactsAgainstProfile(
    workspaceId: string,
    facts: ExtractedFact[]
  ): Promise<Map<string, { validated: boolean; confidence: number; profileValue?: string }>> {
    const validationMap = new Map<string, { validated: boolean; confidence: number; profileValue?: string }>();

    try {
      // Get workspace profile
      const profileResult = await this.dbPool!.query(
        'SELECT * FROM "workspace_profiles" WHERE "workspaceId" = $1',
        [workspaceId]
      );
      const profile = profileResult.rows[0];

      if (!profile) {
        // No profile to validate against
        for (const fact of facts) {
          validationMap.set(fact.sourceNodeId, { validated: false, confidence: 0 });
        }
        return validationMap;
      }

      // Validate each fact against profile
      for (const fact of facts) {
        let validated = false;
        let confidence = 0;
        let profileValue: string | undefined;

        switch (fact.type) {
          case 'address':
            if (profile.address) {
              const normalizedProfile = this.normalizeAddress(profile.address);
              const normalizedFact = fact.normalizedValue || this.normalizeAddress(fact.value);
              validated = normalizedProfile === normalizedFact;
              confidence = validated ? 0.9 : 0.3;
              profileValue = profile.address;
            }
            break;
          case 'phone':
            if (profile.phone) {
              const normalizedProfile = this.normalizePhone(profile.phone);
              const normalizedFact = fact.normalizedValue || this.normalizePhone(fact.value);
              validated = normalizedProfile === normalizedFact;
              confidence = validated ? 0.9 : 0.3;
              profileValue = profile.phone;
            }
            break;
          case 'services':
            if (profile.services && Array.isArray(profile.services)) {
              const factValue = fact.value.toLowerCase().trim();
              const matches = profile.services.some((svc: string) => 
                svc.toLowerCase().includes(factValue) || factValue.includes(svc.toLowerCase())
              );
              validated = matches;
              confidence = matches ? 0.8 : 0.4;
              profileValue = profile.services.join(', ');
            }
            break;
        }

        validationMap.set(fact.sourceNodeId, { validated, confidence, profileValue });
      }
    } catch (error) {
      console.warn('Failed to validate facts against profile:', error);
      // Return unvalidated facts
      for (const fact of facts) {
        validationMap.set(fact.sourceNodeId, { validated: false, confidence: 0 });
      }
    }

    return validationMap;
  }

  /**
   * Normalize address for comparison
   */
  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize phone for comparison
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/[^\d]/g, '');
  }

  /**
   * Determine relationship between two evidence nodes
   */
  private determineRelationship(node1: EvidenceNode, node2: EvidenceNode): EvidenceEdge['relationship'] {
    // If both are from high-authority sources, they likely confirm each other
    if (node1.authority > 0.7 && node2.authority > 0.7) {
      return 'confirms';
    }

    // If both mention the same entity, they support each other
    if (node1.sourceType === node2.sourceType || 
        (node1.authority > 0.5 && node2.authority > 0.5)) {
      return 'supports';
    }

    // Default to supports (optimistic assumption)
    return 'supports';
  }
}


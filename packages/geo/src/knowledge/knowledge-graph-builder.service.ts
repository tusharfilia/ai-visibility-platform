import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EntityNode {
  id: string;
  type: 'brand' | 'product' | 'service' | 'person' | 'organization' | 'location' | 'concept';
  name: string;
  description?: string;
  properties: Record<string, any>;
  confidence: number;
  lastUpdated: Date;
}

export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: 'mentions' | 'competes_with' | 'partners_with' | 'located_in' | 'offers' | 'uses' | 'related_to';
  strength: number;
  context?: string;
  evidence: string[];
  lastUpdated: Date;
}

export interface KnowledgeGraph {
  entities: EntityNode[];
  relationships: Relationship[];
  metadata: {
    totalEntities: number;
    totalRelationships: number;
    lastUpdated: Date;
    confidence: number;
  };
}

export interface GraphAnalysis {
  centrality: {
    brand: number;
    competitors: string[];
    keyEntities: EntityNode[];
  };
  clusters: {
    id: string;
    entities: string[];
    theme: string;
    strength: number;
  }[];
  insights: {
    type: 'opportunity' | 'threat' | 'neutral';
    description: string;
    confidence: number;
    actionable: boolean;
  }[];
}

@Injectable()
export class KnowledgeGraphBuilder {
  private readonly entityTypes = [
    'brand', 'product', 'service', 'person', 'organization', 'location', 'concept'
  ];

  private readonly relationshipTypes = [
    'mentions', 'competes_with', 'partners_with', 'located_in', 'offers', 'uses', 'related_to'
  ];

  constructor(private configService: ConfigService) {}

  /**
   * Build knowledge graph from AI responses and business data
   */
  async buildKnowledgeGraph(
    workspaceId: string,
    brandName: string,
    aiResponses: any[],
    businessData: any
  ): Promise<KnowledgeGraph> {
    const startTime = Date.now();

    try {
      console.log(`Building knowledge graph for ${brandName}...`);

      // Extract entities from AI responses
      const entities = await this.extractEntities(aiResponses, brandName);
      
      // Extract relationships
      const relationships = await this.extractRelationships(aiResponses, entities);
      
      // Enhance with business data
      const enhancedEntities = await this.enhanceWithBusinessData(entities, businessData);
      
      // Calculate confidence scores
      const validatedEntities = await this.validateEntities(enhancedEntities);
      const validatedRelationships = await this.validateRelationships(relationships, validatedEntities);

      const processingTime = Date.now() - startTime;
      console.log(`Knowledge graph built in ${processingTime}ms`);

      return {
        entities: validatedEntities,
        relationships: validatedRelationships,
        metadata: {
          totalEntities: validatedEntities.length,
          totalRelationships: validatedRelationships.length,
          lastUpdated: new Date(),
          confidence: this.calculateOverallConfidence(validatedEntities, validatedRelationships),
        },
      };

    } catch (error) {
      console.error('Error building knowledge graph:', error);
      throw new Error(`Failed to build knowledge graph: ${error.message}`);
    }
  }

  /**
   * Analyze knowledge graph for insights
   */
  async analyzeKnowledgeGraph(graph: KnowledgeGraph, brandName: string): Promise<GraphAnalysis> {
    try {
      // Calculate centrality metrics
      const centrality = await this.calculateCentrality(graph, brandName);
      
      // Identify clusters
      const clusters = await this.identifyClusters(graph);
      
      // Generate insights
      const insights = await this.generateInsights(graph, brandName, centrality, clusters);

      return {
        centrality,
        clusters,
        insights,
      };

    } catch (error) {
      console.error('Error analyzing knowledge graph:', error);
      throw new Error(`Failed to analyze knowledge graph: ${error.message}`);
    }
  }

  /**
   * Extract entities from AI responses
   */
  private async extractEntities(aiResponses: any[], brandName: string): Promise<EntityNode[]> {
    const entities: EntityNode[] = [];
    const entityMap = new Map<string, EntityNode>();

    // Add primary brand entity
    const brandEntity: EntityNode = {
      id: `brand_${brandName.toLowerCase().replace(/\s+/g, '_')}`,
      type: 'brand',
      name: brandName,
      description: 'Primary brand entity',
      properties: {
        isPrimary: true,
        industry: 'unknown',
        founded: null,
        headquarters: null,
      },
      confidence: 1.0,
      lastUpdated: new Date(),
    };
    entityMap.set(brandName.toLowerCase(), brandEntity);

    // Extract entities from each AI response
    for (const response of aiResponses) {
      const extractedEntities = await this.extractEntitiesFromText(response.text, brandName);
      
      for (const entity of extractedEntities) {
        const key = entity.name.toLowerCase();
        
        if (entityMap.has(key)) {
          // Merge with existing entity
          const existing = entityMap.get(key);
          existing.confidence = Math.max(existing.confidence, entity.confidence);
          existing.properties = { ...existing.properties, ...entity.properties };
          existing.lastUpdated = new Date();
        } else {
          entityMap.set(key, entity);
        }
      }
    }

    return Array.from(entityMap.values());
  }

  /**
   * Extract entities from text using NLP techniques
   */
  private async extractEntitiesFromText(text: string, brandName: string): Promise<EntityNode[]> {
    const entities: EntityNode[] = [];
    
    // Simple entity extraction (in production, use proper NLP)
    const words = text.toLowerCase().split(/\s+/);
    const brandWords = brandName.toLowerCase().split(/\s+/);
    
    // Extract potential entities
    const potentialEntities = this.findPotentialEntities(text);
    
    for (const entity of potentialEntities) {
      const entityType = this.classifyEntityType(entity.name, entity.context);
      const confidence = this.calculateEntityConfidence(entity.name, entity.context, brandName);
      
      if (confidence > 0.3) { // Only include entities with reasonable confidence
        entities.push({
          id: `entity_${entity.name.toLowerCase().replace(/\s+/g, '_')}`,
          type: entityType,
          name: entity.name,
          description: entity.context,
          properties: {
            mentions: entity.mentions || 1,
            context: entity.context,
          },
          confidence,
          lastUpdated: new Date(),
        });
      }
    }

    return entities;
  }

  /**
   * Extract relationships between entities
   */
  private async extractRelationships(aiResponses: any[], entities: EntityNode[]): Promise<Relationship[]> {
    const relationships: Relationship[] = [];
    const relationshipMap = new Map<string, Relationship>();

    for (const response of aiResponses) {
      const extractedRelationships = await this.extractRelationshipsFromText(response.text, entities);
      
      for (const rel of extractedRelationships) {
        const key = `${rel.source}_${rel.type}_${rel.target}`;
        
        if (relationshipMap.has(key)) {
          // Strengthen existing relationship
          const existing = relationshipMap.get(key);
          existing.strength = Math.min(existing.strength + 0.1, 1.0);
          existing.evidence.push(...rel.evidence);
          existing.lastUpdated = new Date();
        } else {
          relationshipMap.set(key, rel);
        }
      }
    }

    return Array.from(relationshipMap.values());
  }

  /**
   * Extract relationships from text
   */
  private async extractRelationshipsFromText(text: string, entities: EntityNode[]): Promise<Relationship[]> {
    const relationships: Relationship[] = [];
    const textLower = text.toLowerCase();
    
    // Find entity mentions in text
    const entityMentions = entities.map(entity => ({
      entity,
      positions: this.findAllPositions(textLower, entity.name.toLowerCase()),
    }));

    // Look for relationship patterns
    for (let i = 0; i < entityMentions.length; i++) {
      for (let j = i + 1; j < entityMentions.length; j++) {
        const entity1 = entityMentions[i].entity;
        const entity2 = entityMentions[j].entity;
        
        // Check if entities are mentioned close to each other
        const relationship = this.findRelationshipBetweenEntities(
          entity1, entity2, text, entityMentions[i].positions, entityMentions[j].positions
        );
        
        if (relationship) {
          relationships.push(relationship);
        }
      }
    }

    return relationships;
  }

  /**
   * Enhance entities with business data
   */
  private async enhanceWithBusinessData(entities: EntityNode[], businessData: any): Promise<EntityNode[]> {
    return entities.map(entity => {
      if (entity.type === 'brand' && businessData) {
        return {
          ...entity,
          properties: {
            ...entity.properties,
            industry: businessData.industry || entity.properties.industry,
            founded: businessData.founded || entity.properties.founded,
            headquarters: businessData.headquarters || entity.properties.headquarters,
            website: businessData.website || entity.properties.website,
            description: businessData.description || entity.description,
          },
          confidence: Math.min(entity.confidence + 0.2, 1.0),
        };
      }
      return entity;
    });
  }

  /**
   * Validate entities and remove low-confidence ones
   */
  private async validateEntities(entities: EntityNode[]): Promise<EntityNode[]> {
    return entities.filter(entity => entity.confidence > 0.4);
  }

  /**
   * Validate relationships
   */
  private async validateRelationships(relationships: Relationship[], entities: EntityNode[]): Promise<Relationship[]> {
    const entityIds = new Set(entities.map(e => e.id));
    
    return relationships.filter(rel => 
      entityIds.has(rel.source) && 
      entityIds.has(rel.target) && 
      rel.strength > 0.3
    );
  }

  /**
   * Calculate overall graph confidence
   */
  private calculateOverallConfidence(entities: EntityNode[], relationships: Relationship[]): number {
    const entityConfidence = entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;
    const relationshipConfidence = relationships.reduce((sum, r) => sum + r.strength, 0) / relationships.length;
    
    return (entityConfidence + relationshipConfidence) / 2;
  }

  /**
   * Calculate centrality metrics
   */
  private async calculateCentrality(graph: KnowledgeGraph, brandName: string): Promise<any> {
    const brandEntity = graph.entities.find(e => e.name.toLowerCase() === brandName.toLowerCase());
    
    if (!brandEntity) {
      return {
        brand: 0,
        competitors: [],
        keyEntities: [],
      };
    }

    // Calculate brand centrality (simplified)
    const brandConnections = graph.relationships.filter(r => 
      r.source === brandEntity.id || r.target === brandEntity.id
    ).length;
    
    const totalConnections = graph.relationships.length;
    const brandCentrality = totalConnections > 0 ? brandConnections / totalConnections : 0;

    // Find competitors
    const competitors = graph.entities
      .filter(e => e.type === 'brand' && e.name.toLowerCase() !== brandName.toLowerCase())
      .map(e => e.name);

    // Find key entities (most connected)
    const entityConnections = new Map<string, number>();
    for (const rel of graph.relationships) {
      entityConnections.set(rel.source, (entityConnections.get(rel.source) || 0) + 1);
      entityConnections.set(rel.target, (entityConnections.get(rel.target) || 0) + 1);
    }

    const keyEntities = Array.from(entityConnections.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([entityId, _]) => graph.entities.find(e => e.id === entityId))
      .filter(Boolean);

    return {
      brand: Math.round(brandCentrality * 100) / 100,
      competitors,
      keyEntities,
    };
  }

  /**
   * Identify entity clusters
   */
  private async identifyClusters(graph: KnowledgeGraph): Promise<any[]> {
    const clusters: any[] = [];
    
    // Simple clustering based on entity types
    const typeGroups = new Map<string, string[]>();
    
    for (const entity of graph.entities) {
      if (!typeGroups.has(entity.type)) {
        typeGroups.set(entity.type, []);
      }
      typeGroups.get(entity.type).push(entity.id);
    }

    for (const [type, entityIds] of typeGroups) {
      if (entityIds.length > 1) {
        clusters.push({
          id: `cluster_${type}`,
          entities: entityIds,
          theme: `${type} entities`,
          strength: entityIds.length / graph.entities.length,
        });
      }
    }

    return clusters;
  }

  /**
   * Generate actionable insights
   */
  private async generateInsights(
    graph: KnowledgeGraph, 
    brandName: string, 
    centrality: any, 
    clusters: any[]
  ): Promise<any[]> {
    const insights: any[] = [];

    // Brand centrality insight
    if (centrality.brand < 0.3) {
      insights.push({
        type: 'opportunity',
        description: 'Brand has low centrality in the knowledge graph. Consider increasing mentions and relationships.',
        confidence: 0.8,
        actionable: true,
      });
    }

    // Competitor insights
    if (centrality.competitors.length > 0) {
      insights.push({
        type: 'neutral',
        description: `Found ${centrality.competitors.length} competitor entities in the knowledge graph.`,
        confidence: 0.9,
        actionable: false,
      });
    }

    // Cluster insights
    for (const cluster of clusters) {
      if (cluster.strength > 0.5) {
        insights.push({
          type: 'opportunity',
          description: `Strong ${cluster.theme} cluster identified. Consider leveraging this theme for optimization.`,
          confidence: 0.7,
          actionable: true,
        });
      }
    }

    return insights;
  }

  /**
   * Helper methods
   */
  private findPotentialEntities(text: string): any[] {
    // Simple entity extraction (in production, use proper NLP)
    const entities: any[] = [];
    const words = text.split(/\s+/);
    
    // Look for capitalized words (potential entities)
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (word.length > 2 && word[0] === word[0].toUpperCase()) {
        entities.push({
          name: word,
          context: this.getContextAroundWord(text, i),
          mentions: 1,
        });
      }
    }

    return entities;
  }

  private classifyEntityType(name: string, context: string): EntityNode['type'] {
    const nameLower = name.toLowerCase();
    const contextLower = context.toLowerCase();

    if (contextLower.includes('company') || contextLower.includes('corporation')) {
      return 'organization';
    }
    if (contextLower.includes('product') || contextLower.includes('service')) {
      return 'product';
    }
    if (contextLower.includes('person') || contextLower.includes('founder')) {
      return 'person';
    }
    if (contextLower.includes('location') || contextLower.includes('city')) {
      return 'location';
    }

    return 'concept';
  }

  private calculateEntityConfidence(name: string, context: string, brandName: string): number {
    let confidence = 0.5;

    // Boost confidence for brand-related entities
    if (name.toLowerCase().includes(brandName.toLowerCase())) {
      confidence += 0.3;
    }

    // Boost confidence for entities with rich context
    if (context.length > 20) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  private findAllPositions(text: string, searchTerm: string): number[] {
    const positions: number[] = [];
    let index = text.indexOf(searchTerm);
    
    while (index !== -1) {
      positions.push(index);
      index = text.indexOf(searchTerm, index + 1);
    }
    
    return positions;
  }

  private findRelationshipBetweenEntities(
    entity1: EntityNode,
    entity2: EntityNode,
    text: string,
    positions1: number[],
    positions2: number[]
  ): Relationship | null {
    // Check if entities are mentioned close to each other (within 50 characters)
    for (const pos1 of positions1) {
      for (const pos2 of positions2) {
        if (Math.abs(pos1 - pos2) < 50) {
          const relationshipType = this.determineRelationshipType(entity1, entity2, text);
          if (relationshipType) {
            return {
              id: `rel_${entity1.id}_${relationshipType}_${entity2.id}`,
              source: entity1.id,
              target: entity2.id,
              type: relationshipType,
              strength: 0.7,
              context: text.substring(Math.min(pos1, pos2), Math.max(pos1, pos2) + 50),
              evidence: [text.substring(Math.min(pos1, pos2), Math.max(pos1, pos2) + 50)],
              lastUpdated: new Date(),
            };
          }
        }
      }
    }

    return null;
  }

  private determineRelationshipType(entity1: EntityNode, entity2: EntityNode, context: string): Relationship['type'] | null {
    const contextLower = context.toLowerCase();

    if (contextLower.includes('competitor') || contextLower.includes('competes')) {
      return 'competes_with';
    }
    if (contextLower.includes('partner') || contextLower.includes('collaborates')) {
      return 'partners_with';
    }
    if (contextLower.includes('uses') || contextLower.includes('utilizes')) {
      return 'uses';
    }
    if (contextLower.includes('offers') || contextLower.includes('provides')) {
      return 'offers';
    }

    return 'related_to';
  }

  private getContextAroundWord(text: string, wordIndex: number): string {
    const words = text.split(/\s+/);
    const start = Math.max(0, wordIndex - 3);
    const end = Math.min(words.length, wordIndex + 4);
    return words.slice(start, end).join(' ');
  }
}

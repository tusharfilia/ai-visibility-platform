import { Injectable } from '@nestjs/common';
import { LLMRouterService, LLMConfigService } from '@ai-visibility/shared';

export interface PromptCluster {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  prompts: string[];
  centroid: number[];
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscoveredPrompt {
  text: string;
  source: 'trends' | 'generated' | 'manual';
  industry?: string;
  intent?: string;
  popularity?: number;
}

@Injectable()
export class PromptDiscoveryService {
  constructor(
    private llmRouter: LLMRouterService,
    private llmConfig: LLMConfigService
  ) {}

  /**
   * Discover trending prompts for a workspace
   */
  async discoverPrompts(
    workspaceId: string,
    industry: string,
    maxPrompts: number = 50
  ): Promise<DiscoveredPrompt[]> {
    const prompts: DiscoveredPrompt[] = [];

    try {
      // 1. Fetch trending searches from Google Trends (mock implementation)
      const trendingPrompts = await this.fetchTrendingSearches(industry);
      prompts.push(...trendingPrompts.map(p => ({ ...p, source: 'trends' as const })));

      // 2. Generate candidate prompts using LLM
      const generatedPrompts = await this.generateCandidatePrompts(workspaceId, industry);
      prompts.push(...generatedPrompts.map(p => ({ ...p, source: 'generated' as const })));

      // 3. Deduplicate and filter
      const uniquePrompts = this.deduplicatePrompts(prompts);
      
      return uniquePrompts.slice(0, maxPrompts);
    } catch (error) {
      console.error('Prompt discovery failed:', error);
      throw new Error(`Failed to discover prompts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Cluster prompts by intent using embeddings
   */
  async clusterPrompts(
    workspaceId: string,
    prompts: DiscoveredPrompt[]
  ): Promise<PromptCluster[]> {
    try {
      // 1. Generate embeddings for each prompt
      const embeddings = await this.generateEmbeddings(prompts.map(p => p.text));

      // 2. Run clustering algorithm
      const clusters = await this.performClustering(prompts, embeddings);

      // 3. Auto-label clusters using LLM
      const labeledClusters = await this.labelClusters(workspaceId, clusters);

      // 4. Store clusters in database
      const savedClusters = await this.saveClusters(workspaceId, labeledClusters);

      return savedClusters;
    } catch (error) {
      console.error('Prompt clustering failed:', error);
      throw new Error(`Failed to cluster prompts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Refresh existing clusters with new prompts
   */
  async refreshClusters(workspaceId: string): Promise<PromptCluster[]> {
    try {
      // Get existing clusters
      const existingClusters = await this.getExistingClusters(workspaceId);
      
      // Discover new prompts
      const newPrompts = await this.discoverPrompts(workspaceId, 'general');
      
      // Add new prompts to existing clusters or create new ones
      const updatedClusters = await this.updateClusters(existingClusters, newPrompts);
      
      return updatedClusters;
    } catch (error) {
      console.error('Cluster refresh failed:', error);
      throw new Error(`Failed to refresh clusters: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fetch trending searches (mock implementation)
   */
  private async fetchTrendingSearches(industry: string): Promise<DiscoveredPrompt[]> {
    // Mock trending searches - in real implementation, integrate with Google Trends API
    const mockTrends = {
      'restaurants': [
        'best restaurants near me',
        'restaurant reviews',
        'fine dining recommendations',
        'cheap eats',
        'restaurant reservations'
      ],
      'technology': [
        'best laptops 2024',
        'AI tools comparison',
        'software reviews',
        'tech news',
        'gadget recommendations'
      ],
      'healthcare': [
        'best doctors near me',
        'health insurance',
        'medical advice',
        'hospital reviews',
        'healthcare providers'
      ],
      'general': [
        'best products',
        'top recommendations',
        'reviews and ratings',
        'comparison guide',
        'expert opinions'
      ]
    };

    const trends = (mockTrends as Record<string, string[]>)[industry] || mockTrends['general'];
    
    return trends.map((text: string) => ({
      text,
      source: 'trends' as const,
      industry,
      popularity: Math.random() * 100,
      intent: this.detectIntent(text)
    }));
  }

  /**
   * Generate candidate prompts using LLM
   */
  private async generateCandidatePrompts(
    workspaceId: string,
    industry: string
  ): Promise<DiscoveredPrompt[]> {
    const prompt = `Generate 20 search queries that people might use to find ${industry} businesses or services. 
    Focus on queries that would lead to AI-powered search results. Include:
    - Comparison queries (best X vs Y)
    - Recommendation queries (best X near me)
    - Problem-solving queries (how to choose X)
    - Review queries (X reviews and ratings)
    
    Return as a JSON array of strings.`;

    try {
      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt);
      const content = response.content || response.text || '';
      const generatedPrompts = JSON.parse(content);
      
      return generatedPrompts.map((text: string) => ({
        text,
        source: 'generated' as const,
        industry,
        intent: this.detectIntent(text)
      }));
    } catch (error) {
      console.error('LLM prompt generation failed:', error);
      return [];
    }
  }

  /**
   * Generate embeddings for prompts
   */
  private async generateEmbeddings(prompts: string[]): Promise<number[][]> {
    // Mock implementation - in real implementation, use OpenAI embeddings API
    return prompts.map(() => 
      Array.from({ length: 1536 }, () => Math.random() * 2 - 1)
    );
  }

  /**
   * Perform clustering using DBSCAN algorithm
   */
  private async performClustering(
    prompts: DiscoveredPrompt[],
    embeddings: number[][]
  ): Promise<Array<{ prompts: DiscoveredPrompt[]; centroid: number[] }>> {
    // Simple mock clustering - in real implementation, use proper DBSCAN
    const clusters: Array<{ prompts: DiscoveredPrompt[]; centroid: number[] }> = [];
    
    // Group by intent for simplicity
    const intentGroups = new Map<string, DiscoveredPrompt[]>();
    
    prompts.forEach(prompt => {
      const intent = prompt.intent || 'general';
      if (!intentGroups.has(intent)) {
        intentGroups.set(intent, []);
      }
      intentGroups.get(intent)!.push(prompt);
    });

    // Create clusters from intent groups
    intentGroups.forEach((groupPrompts, intent) => {
      if (groupPrompts.length >= 2) { // Minimum cluster size
        const centroid = this.calculateCentroid(
          groupPrompts.map((_, index) => embeddings[index])
        );
        
        clusters.push({
          prompts: groupPrompts,
          centroid
        });
      }
    });

    return clusters;
  }

  /**
   * Label clusters using LLM
   */
  private async labelClusters(
    workspaceId: string,
    clusters: Array<{ prompts: DiscoveredPrompt[]; centroid: number[] }>
  ): Promise<Array<{ name: string; description: string; prompts: DiscoveredPrompt[]; centroid: number[] }>> {
    const labeledClusters = [];

    for (const cluster of clusters) {
      const promptTexts = cluster.prompts.map(p => p.text).join(', ');
      
      const labelingPrompt = `Analyze these search queries and provide a cluster name and description:
      
      Queries: ${promptTexts}
      
      Return a JSON object with:
      - name: A short, descriptive name for this cluster
      - description: A brief description of what these queries are about
      
      Example: {"name": "Restaurant Recommendations", "description": "Queries about finding and choosing restaurants"}`;

      try {
        const response = await this.llmRouter.routeLLMRequest(workspaceId, labelingPrompt);
        const content = response.content || response.text || '{}';
        const labels = JSON.parse(content);
        
        labeledClusters.push({
          name: labels.name,
          description: labels.description,
          prompts: cluster.prompts,
          centroid: cluster.centroid
        });
      } catch (error) {
        console.error('Cluster labeling failed:', error);
        // Fallback to simple naming
        labeledClusters.push({
          name: `Cluster ${labeledClusters.length + 1}`,
          description: 'Generated prompt cluster',
          prompts: cluster.prompts,
          centroid: cluster.centroid
        });
      }
    }

    return labeledClusters;
  }

  /**
   * Save clusters to database
   */
  private async saveClusters(
    workspaceId: string,
    clusters: Array<{ name: string; description: string; prompts: DiscoveredPrompt[]; centroid: number[] }>
  ): Promise<PromptCluster[]> {
    // Mock implementation - in real implementation, save to database
    const savedClusters: PromptCluster[] = [];

    for (const cluster of clusters) {
      const clusterData: PromptCluster = {
        id: this.generateId(),
        workspaceId,
        name: cluster.name,
        description: cluster.description,
        prompts: cluster.prompts.map(p => p.text),
        centroid: cluster.centroid,
        size: cluster.prompts.length,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      savedClusters.push(clusterData);
    }

    return savedClusters;
  }

  /**
   * Get existing clusters for workspace
   */
  async getExistingClusters(workspaceId: string): Promise<PromptCluster[]> {
    // Mock implementation - in real implementation, query database
    return [];
  }

  /**
   * Update existing clusters with new prompts
   */
  private async updateClusters(
    existing: PromptCluster[],
    newPrompts: DiscoveredPrompt[]
  ): Promise<PromptCluster[]> {
    // Mock implementation - in real implementation, update clusters
    return existing;
  }

  /**
   * Deduplicate prompts
   */
  private deduplicatePrompts(prompts: DiscoveredPrompt[]): DiscoveredPrompt[] {
    const seen = new Set<string>();
    return prompts.filter(prompt => {
      const normalized = prompt.text.toLowerCase().trim();
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }

  /**
   * Detect intent from prompt text
   */
  private detectIntent(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('best') || lowerText.includes('top') || lowerText.includes('recommend')) {
      return 'recommendation';
    }
    if (lowerText.includes('vs') || lowerText.includes('compare') || lowerText.includes('difference')) {
      return 'comparison';
    }
    if (lowerText.includes('review') || lowerText.includes('rating') || lowerText.includes('opinion')) {
      return 'review';
    }
    if (lowerText.includes('how to') || lowerText.includes('guide') || lowerText.includes('tutorial')) {
      return 'howto';
    }
    if (lowerText.includes('near me') || lowerText.includes('local') || lowerText.includes('location')) {
      return 'location';
    }
    
    return 'general';
  }

  /**
   * Calculate centroid of embeddings
   */
  private calculateCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) return [];
    
    const dimensions = embeddings[0].length;
    const centroid = new Array(dimensions).fill(0);
    
    embeddings.forEach(embedding => {
      embedding.forEach((value, index) => {
        centroid[index] += value;
      });
    });
    
    return centroid.map(sum => sum / embeddings.length);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
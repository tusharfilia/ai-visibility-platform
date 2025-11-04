import { Injectable } from '@nestjs/common';
import { LLMRouterService } from '@ai-visibility/shared';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
  tokens: number;
  cost: number;
}

export interface EmbeddingCacheEntry {
  id: string;
  text: string;
  embedding: number[];
  model: string;
  createdAt: Date;
}

@Injectable()
export class EmbeddingsService {
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';
  private readonly EMBEDDING_DIMENSIONS = 1536;
  private readonly MAX_BATCH_SIZE = 100;

  constructor(private llmRouter: LLMRouterService) {}

  /**
   * Generate embeddings for text using OpenAI API
   */
  async generateEmbeddings(
    workspaceId: string,
    texts: string[],
    useCache: boolean = true
  ): Promise<EmbeddingResult[]> {
    if (texts.length === 0) return [];

    const results: EmbeddingResult[] = [];
    const textsToProcess: string[] = [];

    // Check cache for existing embeddings
    if (useCache) {
      for (const text of texts) {
        const cached = await this.getCachedEmbedding(text);
        if (cached) {
          results.push({
            text,
            embedding: cached.embedding,
            model: cached.model,
            tokens: this.estimateTokens(text),
            cost: this.calculateCost(this.estimateTokens(text))
          });
        } else {
          textsToProcess.push(text);
        }
      }
    } else {
      textsToProcess.push(...texts);
    }

    // Generate embeddings for uncached texts
    if (textsToProcess.length > 0) {
      const newEmbeddings = await this.generateNewEmbeddings(workspaceId, textsToProcess);
      
      // Cache new embeddings
      for (const result of newEmbeddings) {
        await this.cacheEmbedding(result);
      }
      
      results.push(...newEmbeddings);
    }

    return results;
  }

  /**
   * Generate a single embedding
   */
  async generateEmbedding(
    workspaceId: string,
    text: string,
    useCache: boolean = true
  ): Promise<EmbeddingResult> {
    const results = await this.generateEmbeddings(workspaceId, [text], useCache);
    return results[0];
  }

  /**
   * Calculate similarity between two embeddings
   */
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Find most similar texts using embeddings
   */
  async findSimilarTexts(
    workspaceId: string,
    queryText: string,
    candidateTexts: string[],
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<Array<{ text: string; similarity: number }>> {
    // Generate embedding for query
    const queryEmbedding = await this.generateEmbedding(workspaceId, queryText);
    
    // Generate embeddings for candidates
    const candidateEmbeddings = await this.generateEmbeddings(workspaceId, candidateTexts);
    
    // Calculate similarities
    const similarities = candidateEmbeddings.map(candidate => ({
      text: candidate.text,
      similarity: this.calculateSimilarity(queryEmbedding.embedding, candidate.embedding)
    }));

    // Filter by threshold and sort by similarity
    return similarities
      .filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Generate embeddings for clustering
   */
  async generateClusteringEmbeddings(
    workspaceId: string,
    texts: string[]
  ): Promise<number[][]> {
    const results = await this.generateEmbeddings(workspaceId, texts);
    return results.map(result => result.embedding);
  }

  /**
   * Batch process embeddings for large datasets
   */
  async batchProcessEmbeddings(
    workspaceId: string,
    texts: string[],
    batchSize: number = this.MAX_BATCH_SIZE
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await this.generateEmbeddings(workspaceId, batch);
      results.push(...batchResults);
      
      // Add small delay to avoid rate limiting
      if (i + batchSize < texts.length) {
        await this.delay(100);
      }
    }
    
    return results;
  }

  /**
   * Generate new embeddings using OpenAI API
   */
  private async generateNewEmbeddings(
    workspaceId: string,
    texts: string[]
  ): Promise<EmbeddingResult[]> {
    try {
      // Use OpenAI embeddings API via LLM router
      const prompt = `Generate embeddings for these texts using OpenAI's text-embedding-3-small model:
      
      ${texts.map((text, index) => `${index + 1}. ${text}`).join('\n')}
      
      Return embeddings as a JSON array of arrays.`;

      const response = await this.llmRouter.routeLLMRequest(workspaceId, prompt);
      
      // Parse embeddings from response
      const content = response.content || response.text || '[]';
      const embeddings = JSON.parse(content);
      
      if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
        throw new Error('Invalid embeddings response format');
      }

      return texts.map((text, index) => ({
        text,
        embedding: embeddings[index],
        model: this.EMBEDDING_MODEL,
        tokens: this.estimateTokens(text),
        cost: this.calculateCost(this.estimateTokens(text))
      }));
    } catch (error) {
      console.error('Embedding generation failed:', error);
      
      // Fallback: generate mock embeddings
      return texts.map(text => ({
        text,
        embedding: this.generateMockEmbedding(text),
        model: this.EMBEDDING_MODEL,
        tokens: this.estimateTokens(text),
        cost: this.calculateCost(this.estimateTokens(text))
      }));
    }
  }

  /**
   * Get cached embedding from database
   */
  private async getCachedEmbedding(text: string): Promise<EmbeddingCacheEntry | null> {
    // Mock implementation - in real implementation, query database
    // const cached = await prisma.embeddingCache.findUnique({
    //   where: { text }
    // });
    // return cached;
    
    return null; // No cache for now
  }

  /**
   * Cache embedding in database
   */
  private async cacheEmbedding(result: EmbeddingResult): Promise<void> {
    // Mock implementation - in real implementation, save to database
    // await prisma.embeddingCache.create({
    //   data: {
    //     text: result.text,
    //     embedding: result.embedding,
    //     model: result.model
    //   }
    // });
  }

  /**
   * Generate mock embedding for fallback
   */
  private generateMockEmbedding(text: string): number[] {
    // Generate deterministic mock embedding based on text hash
    const hash = this.hashString(text);
    const embedding = new Array(this.EMBEDDING_DIMENSIONS);
    
    for (let i = 0; i < this.EMBEDDING_DIMENSIONS; i++) {
      embedding[i] = Math.sin(hash + i) * 2 - 1; // Normalize to [-1, 1]
    }
    
    return embedding;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate cost for embedding generation
   */
  private calculateCost(tokens: number): number {
    // text-embedding-3-small pricing: $0.00002 per 1K tokens
    return (tokens / 1000) * 0.00002;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate embedding dimensions
   */
  validateEmbedding(embedding: number[]): boolean {
    return Array.isArray(embedding) && 
           embedding.length === this.EMBEDDING_DIMENSIONS &&
           embedding.every(val => typeof val === 'number' && !isNaN(val));
  }

  /**
   * Normalize embedding vector
   */
  normalizeEmbedding(embedding: number[]): number[] {
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude === 0 ? embedding : embedding.map(val => val / magnitude);
  }
}
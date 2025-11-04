import { Injectable } from '@nestjs/common';
import { PromptDiscoveryService } from '@ai-visibility/prompts/discovery.service';
import { PromptGeneratorService } from '@ai-visibility/prompts/prompt-generator';
import { EmbeddingsService } from '@ai-visibility/prompts/embeddings.service';
import { ClusteringService } from '@ai-visibility/prompts/clustering.service';

@Injectable()
export class DiscoveryApiService {
  constructor(
    private discoveryService: PromptDiscoveryService,
    private promptGenerator: PromptGeneratorService,
    private embeddingsService: EmbeddingsService,
    private clusteringService: ClusteringService
  ) {}

  /**
   * Wrapper for prompt discovery with API-specific logic
   */
  async discoverPromptsForApi(
    workspaceId: string,
    industry: string,
    options: any = {}
  ) {
    return this.discoveryService.discoverPrompts(workspaceId, industry, options.maxPrompts);
  }

  /**
   * Wrapper for prompt generation with API-specific logic
   */
  async generatePromptsForApi(
    workspaceId: string,
    options: any = {}
  ) {
    return this.promptGenerator.generatePrompts(workspaceId, options);
  }

  /**
   * Wrapper for embeddings with API-specific logic
   */
  async generateEmbeddingsForApi(
    workspaceId: string,
    texts: string[]
  ) {
    return this.embeddingsService.generateEmbeddings(workspaceId, texts);
  }

  /**
   * Wrapper for clustering with API-specific logic
   */
  async clusterPromptsForApi(
    prompts: Array<{ text: string; embedding: number[] }>,
    options: any = {}
  ) {
    return this.clusteringService.clusterPrompts(prompts, options);
  }
}
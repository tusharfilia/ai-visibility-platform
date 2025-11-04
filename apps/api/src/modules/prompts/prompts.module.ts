import { Module } from '@nestjs/common';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryApiService } from './discovery.service';
import { PromptDiscoveryService } from '@ai-visibility/prompts/discovery.service';
import { PromptGeneratorService } from '@ai-visibility/prompts/prompt-generator';
import { EmbeddingsService } from '@ai-visibility/prompts/embeddings.service';
import { ClusteringService } from '@ai-visibility/prompts/clustering.service';
import { LLMRouterService, LLMConfigService } from '@ai-visibility/shared';

@Module({
  providers: [
    PromptsService,
    DiscoveryApiService,
    PromptDiscoveryService,
    PromptGeneratorService,
    EmbeddingsService,
    ClusteringService,
    LLMRouterService,
    LLMConfigService,
  ],
  controllers: [PromptsController, DiscoveryController],
  exports: [PromptDiscoveryService, PromptGeneratorService, EmbeddingsService, ClusteringService],
})
export class PromptsModule {}

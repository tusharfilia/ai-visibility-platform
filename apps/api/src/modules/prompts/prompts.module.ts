import { Module } from '@nestjs/common';
import { PromptsController } from './prompts.controller';
import { PromptsService } from './prompts.service';

@Module({
  providers: [PromptsService],
  controllers: [PromptsController],
})
export class PromptsModule {}

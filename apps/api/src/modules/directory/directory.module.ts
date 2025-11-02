import { Module } from '@nestjs/common';
import { DirectoryPresenceController } from './presence.controller';
import { DirectoryPresenceAnalyzerService } from '@ai-visibility/geo';

@Module({
  providers: [DirectoryPresenceAnalyzerService],
  controllers: [DirectoryPresenceController],
  exports: [DirectoryPresenceAnalyzerService],
})
export class DirectoryModule {}



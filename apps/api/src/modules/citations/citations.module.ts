import { Module } from '@nestjs/common';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesApiService } from './opportunities.service';
import { CitationOpportunityService, DomainAnalyzerService, ImpactCalculatorService } from '@ai-visibility/geo';

@Module({
  controllers: [OpportunitiesController],
  providers: [
    OpportunitiesApiService,
    CitationOpportunityService,
    DomainAnalyzerService,
    ImpactCalculatorService,
  ],
  exports: [
    CitationOpportunityService,
    DomainAnalyzerService,
    ImpactCalculatorService,
  ],
})
export class CitationsModule {}

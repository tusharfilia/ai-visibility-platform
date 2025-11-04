import { Module } from '@nestjs/common';
import { EnterpriseController } from './enterprise.controller';
import { ObservabilityService, WhiteLabelService, ApiMarketplaceService } from '@ai-visibility/shared';

@Module({
  providers: [
    ObservabilityService,
    WhiteLabelService,
    ApiMarketplaceService,
  ],
  controllers: [EnterpriseController],
  exports: [
    ObservabilityService,
    WhiteLabelService,
    ApiMarketplaceService,
  ],
})
export class EnterpriseModule {}


import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { HallucinationsController } from './hallucinations.controller';
import { HallucinationsApiService } from './hallucinations.service';
import { HallucinationDetectorService, FactExtractorService, FactValidatorService } from '@ai-visibility/geo';
import { LLMRouterService } from '@ai-visibility/shared';

@Module({
  providers: [
    AlertsService,
    HallucinationsApiService,
    HallucinationDetectorService,
    FactExtractorService,
    FactValidatorService,
    LLMRouterService,
  ],
  controllers: [AlertsController, HallucinationsController],
  exports: [
    HallucinationDetectorService,
    FactExtractorService,
    FactValidatorService,
  ],
})
export class AlertsModule {}

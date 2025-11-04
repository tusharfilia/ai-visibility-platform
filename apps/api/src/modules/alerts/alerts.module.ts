import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { HallucinationsController } from './hallucinations.controller';
import { HallucinationsApiService } from './hallucinations.service';
import { HallucinationDetectorService } from '@ai-visibility/geo/validation/hallucination-detector.service';
import { FactExtractorService } from '@ai-visibility/geo/validation/fact-extractor.service';
import { FactValidatorService } from '@ai-visibility/geo/validation/fact-validator.service';
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

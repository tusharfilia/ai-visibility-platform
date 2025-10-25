import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  providers: [AlertsService],
  controllers: [AlertsController],
})
export class AlertsModule {}

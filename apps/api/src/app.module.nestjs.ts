/**
 * Minimal AppModule with environment support
 * Graceful degradation for database/Redis services
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}



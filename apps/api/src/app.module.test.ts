/**
 * Minimal AppModule for testing GEO features
 * Only loads essential modules to bypass broken dependencies
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './modules/database/database.module';
import { HealthController } from './health.controller';
import { GEOModuleTest } from './modules/geo/geo.module.test';
import { EEATControllerTest } from './modules/geo/eeat.controller.test';
import { DashboardControllerTest } from './modules/geo/dashboard.controller.test';
import { EvidenceControllerTest } from './modules/geo/evidence.controller.test';
import { AnalysisControllerTest } from './modules/geo/analysis.controller.test';
import { DataControllerTest } from './modules/geo/data.controller.test';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    
    // Database
    DatabaseModule,
    
    // GEO Module (Test version - no controllers)
    GEOModuleTest,
  ],
  controllers: [
    HealthController,
    EEATControllerTest,
    DashboardControllerTest,
    EvidenceControllerTest,
    AnalysisControllerTest,
    DataControllerTest,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}


/**
 * Main application module
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { PromptsModule } from './modules/prompts/prompts.module';
import { EnginesModule } from './modules/engines/engines.module';
import { CopilotModule } from './modules/copilot/copilot.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AdminModule } from './modules/admin/admin.module';

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
    
    // Feature modules
    AuthModule,
    MetricsModule,
    PromptsModule,
    EnginesModule,
    CopilotModule,
    ConnectionsModule,
    AlertsModule,
    ReportsModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

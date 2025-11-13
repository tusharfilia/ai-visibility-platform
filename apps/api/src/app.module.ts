/**
 * Main application module
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { MetricsModule } from './modules/metrics/metrics.module';
// import { PromptsModule } from './modules/prompts/prompts.module'; // Temporarily disabled
import { EnginesModule } from './modules/engines/engines.module';
import { CopilotModule } from './modules/copilot/copilot.module';
import { ConnectionsModule } from './modules/connections/connections.module';
// import { AlertsModule } from './modules/alerts/alerts.module'; // Temporarily disabled
import { ReportsModule } from './modules/reports/reports.module';
import { AdminModule } from './modules/admin/admin.module';
// import { SettingsModule } from './modules/settings/settings.module'; // Temporarily disabled
// import { ContentModule } from './modules/content/content.module'; // Temporarily disabled
import { CitationsModule } from './modules/citations/citations.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { EventsModule } from './modules/events/events.module';
import { GEOModule } from './modules/geo/geo.module';
// import { AutomationModule } from './modules/automation/automation.module'; // Temporarily disabled
// import { EnterpriseModule } from './modules/enterprise/enterprise.module'; // Temporarily disabled
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { DemoModule } from './modules/demo/demo.module';
import { HealthController } from './health.controller';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Redis-backed queues
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST') ?? 'localhost';
        const port = Number(config.get<string>('REDIS_PORT') ?? '6379');
        const password = config.get<string>('REDIS_PASSWORD');
        const url = config.get<string>('REDIS_URL');

        // Prefer URL when provided to support managed Redis providers
        if (url) {
          return {
            connection: {
              url,
            },
          };
        }

        return {
          connection: {
            host,
            port,
            password,
          },
        };
      },
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
    // PromptsModule, // Temporarily disabled - missing dependencies
    EnginesModule,
    CopilotModule,
    ConnectionsModule,
    // AlertsModule, // Temporarily disabled - missing dependencies
    ReportsModule,
    AdminModule,
    // SettingsModule, // Temporarily disabled - missing dependencies
    // ContentModule, // Temporarily disabled - missing dependencies
    CitationsModule,
    WorkspacesModule,
    EventsModule,
    GEOModule,
    // AutomationModule, // Temporarily disabled - missing dependencies
    // EnterpriseModule, // Temporarily disabled - missing dependencies
    RecommendationsModule,
    DirectoryModule,
    DemoModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

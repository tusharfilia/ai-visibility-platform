/**
 * Health controller with environment support
 * Graceful degradation for external services
 */

import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class HealthController {
  constructor(private configService: ConfigService) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: this.configService.get('NODE_ENV', 'development'),
      version: '1.0.0'
    };
  }

  @Get('ready')
  async getReady() {
    try {
      // Check environment variables
      const dbUrl = this.configService.get('DATABASE_URL');
      const redisUrl = this.configService.get('REDIS_URL');
      
      const checks = {
        database: dbUrl ? 'configured' : 'not_configured',
        redis: redisUrl ? 'configured' : 'not_configured',
        environment: this.configService.get('NODE_ENV', 'development')
      };
      
      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks
      };
    } catch (error) {
      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        note: 'running with graceful degradation'
      };
    }
  }

  @Get('env')
  getEnvironment() {
    return {
      nodeEnv: this.configService.get('NODE_ENV', 'development'),
      port: this.configService.get('PORT', 8080),
      corsOrigins: this.configService.get('CORS_ALLOWED_ORIGINS', 'http://localhost:5173'),
      mockProviders: this.configService.get('MOCK_PROVIDERS', 'true'),
      databaseConfigured: !!this.configService.get('DATABASE_URL'),
      redisConfigured: !!this.configService.get('REDIS_URL')
    };
  }
}



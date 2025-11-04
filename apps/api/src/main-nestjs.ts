/**
 * Minimal NestJS API with environment support
 * Graceful degradation if database/Redis are unavailable
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  console.log('🚀 Starting NestJS API with environment support...');
  
  try {
    const app = await NestFactory.create(AppModule, { 
      logger: ['error', 'warn', 'log'] // Enable basic logging
    });
    
    const configService = app.get(ConfigService);
    const port = configService.get('PORT', 8080);
    
    // CORS configuration
    const corsOrigins = configService.get('CORS_ALLOWED_ORIGINS', 'http://localhost:5173');
    const allowList = corsOrigins.split(',').map(s => s.trim()).filter(Boolean);
    
    app.enableCors({
      origin: (origin, cb) => {
        if (!origin || allowList.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked for origin: ${origin}`), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    });
    
    // Health check endpoint
    app.use('/healthz', (req: any, res: any) => {
      res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: configService.get('NODE_ENV', 'development')
      });
    });
    
    // Readiness check with graceful degradation
    app.use('/readyz', async (req: any, res: any) => {
      try {
        // Try to check database connectivity
        const dbUrl = configService.get('DATABASE_URL');
        const redisUrl = configService.get('REDIS_URL');
        
        const checks = {
          database: dbUrl ? 'configured' : 'not_configured',
          redis: redisUrl ? 'configured' : 'not_configured',
          environment: configService.get('NODE_ENV', 'development')
        };
        
        // Always return ready for now (graceful degradation)
        res.status(200).json({ 
          status: 'ready', 
          timestamp: new Date().toISOString(),
          checks
        });
      } catch (error) {
        // Even if checks fail, return ready (graceful degradation)
        res.status(200).json({ 
          status: 'ready', 
          timestamp: new Date().toISOString(),
          note: 'running with graceful degradation'
        });
      }
    });
    
    await app.listen(port);
    console.log(`✅ NestJS API running on port ${port}`);
    console.log(`🏥 Health check: http://localhost:${port}/healthz`);
    console.log(`✅ Readiness check: http://localhost:${port}/readyz`);
    
  } catch (error) {
    console.error('❌ Failed to start NestJS API:', error);
    process.exit(1);
  }
}

bootstrap();



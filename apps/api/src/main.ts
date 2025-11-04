/**
 * AI Visibility API Application
 * NestJS REST API with comprehensive middleware and security
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { LoggerService } from './middleware/logger.service';
import { GlobalExceptionFilter } from './middleware/exception.filter';
import { CorrelationIdInterceptor } from './middleware/correlation-id.interceptor';

async function bootstrap() {
  console.log('🚀 Starting AI Visibility API...');
  
  try {
    const app = await NestFactory.create(AppModule, { 
      bufferLogs: true,
      logger: ['error', 'warn', 'log'] // Enable logging for debugging
    });

    const configService = app.get(ConfigService);
    const port = configService.get('PORT', 8080);

    // Security middleware
    app.use(helmet());
    app.use(compression());

    // CORS configuration
    const allowList = (configService.get('CORS_ALLOWED_ORIGINS', 'http://localhost:5173'))
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    
    app.enableCors({
      origin: (origin, cb) => {
        if (!origin || allowList.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked for origin: ${origin}`), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    });

    // Health check endpoints (must be before global prefix to be accessible at root)
    app.use('/healthz', (req: any, res: any) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Readiness check endpoint
    app.use('/readyz', async (req: any, res: any) => {
      try {
        // For now, just return ready - we'll add database checks later
        res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(503).json({ status: 'not ready', error: (error as Error).message });
      }
    });

    // Global prefix
    app.setGlobalPrefix('v1');

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      })
    );

    // Global exception filter
    app.useGlobalFilters(new GlobalExceptionFilter());

    // Global interceptors
    app.useGlobalInterceptors(new CorrelationIdInterceptor());

    // Swagger documentation
    const config = new DocumentBuilder()
      .setTitle('AI Visibility Platform API')
      .setDescription('REST API for AI search visibility tracking and optimization')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('Health', 'Health check endpoints')
      .addTag('Metrics', 'Visibility metrics and analytics')
      .addTag('Prompts', 'Prompt management')
      .addTag('Engines', 'Search engine configuration')
      .addTag('Copilot', 'AI Copilot actions and rules')
      .addTag('Connections', 'CMS/CRM integrations')
      .addTag('Alerts', 'System alerts and notifications')
      .addTag('Reports', 'Report generation')
      .addTag('Admin', 'System administration')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('v1/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    try {
      await app.listen(port, '0.0.0.0'); // Listen on all interfaces for Railway
      console.log(`🚀 AI Visibility API running on port ${port}`);
      console.log(`📚 Swagger docs available at http://localhost:${port}/v1/docs`);
      console.log(`🏥 Health check available at http://localhost:${port}/healthz`);
      console.log(`✅ Readiness check available at http://localhost:${port}/readyz`);
    } catch (error) {
      console.error('❌ Failed to start API:', error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to create NestJS application:', error);
    console.error('Error details:', error instanceof Error ? error.stack : String(error));
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  console.error('Error details:', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});

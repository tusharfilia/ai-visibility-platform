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
import * as fs from 'fs';
import { AppModule } from './app.module';
import { LoggerService } from './middleware/logger.service';
import { GlobalExceptionFilter } from './middleware/exception.filter';
import { CorrelationIdInterceptor } from './middleware/correlation-id.interceptor';

async function bootstrap() {
  // Log to stderr so Railway captures it
  console.error('🚀 Starting AI Visibility API...');
  console.error(`📦 Node version: ${process.version}`);
  console.error(`📁 Working directory: ${process.cwd()}`);
  console.error(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.error(`🔌 PORT: ${process.env.PORT || '8080'}`);
  
  try {
    const app = await NestFactory.create(AppModule, { 
      bufferLogs: true,
      logger: ['error', 'warn', 'log'] // Enable logging for debugging
    });

    console.error('✅ NestJS application created successfully');

    const configService = app.get(ConfigService);
    const port = configService.get('PORT', 8080);
    console.error(`🔌 Attempting to start on port ${port}`);

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

    // Health check endpoints (must be registered before global prefix)
    // Access the underlying Express instance directly
    const httpAdapter = app.getHttpAdapter();
    const expressApp = httpAdapter.getInstance();
    
    console.error('🏥 Registering health check endpoints...');
    
    // Register health endpoints at root level before global prefix
    expressApp.get('/healthz', (req: any, res: any) => {
      console.error('📊 Health check hit');
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    expressApp.get('/readyz', async (req: any, res: any) => {
      try {
        console.error('📊 Readiness check hit');
        res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(503).json({ status: 'not ready', error: (error as Error).message });
      }
    });
    
    console.error('✅ Health check endpoints registered at /healthz and /readyz');

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
      console.error(`🚀 AI Visibility API running on port ${port}`);
      console.error(`📚 Swagger docs available at http://localhost:${port}/v1/docs`);
      console.error(`🏥 Health check available at http://localhost:${port}/healthz`);
      console.error(`✅ Readiness check available at http://localhost:${port}/readyz`);
      console.error('✅ Application fully started and ready to accept requests');
    } catch (error) {
      console.error('❌ Failed to start API:', error);
      console.error('Error details:', error instanceof Error ? error.stack : String(error));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to create NestJS application:', error);
    console.error('Error details:', error instanceof Error ? error.stack : String(error));
    process.exit(1);
  }
}

// Ensure we catch any unhandled errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

// Log that we're about to bootstrap
console.error('📋 Bootstrap starting...');
console.error('📁 Current directory:', process.cwd());
console.error('📦 Files in dist:', fs.existsSync('./dist/main.js') ? 'main.js exists' : 'main.js NOT FOUND');
console.error('📦 Files in current dir:', fs.readdirSync('.').join(', '));

bootstrap().catch((error) => {
  console.error('❌ Failed to start application:', error);
  console.error('Error details:', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});

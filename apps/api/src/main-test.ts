import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.test';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  console.log('🚀 Starting AI Visibility API (Test Mode - GEO Features Only)...');
  
  const app = await NestFactory.create(AppModule, { 
    logger: ['error', 'warn', 'log'] // Reduced logging
  });
  
  const configService = app.get(ConfigService);
  const port = configService.get('PORT', 8080);
  
  // Enable CORS for testing
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000', '*'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  });

  // Global prefix
  app.setGlobalPrefix('v1');

  // Swagger documentation for testing
  const config = new DocumentBuilder()
    .setTitle('AI Visibility Platform API - Test Mode')
    .setDescription('REST API for AI search visibility tracking and optimization (Test Mode with GEO Features)')
    .setVersion('1.0.0')
    .addTag('Health', 'Health check endpoints')
    .addTag('GEO', 'GEO optimization endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('v1/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // More lenient for testing
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Health check endpoint
  app.use('/healthz', (req: any, res: any) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      mode: 'test-geo-only'
    });
  });

  await app.listen(port);
  
  console.log(`🚀 AI Visibility API running on port ${port} (Test Mode)`);
  console.log(`📚 Swagger UI: http://localhost:${port}/v1/docs`);
  console.log(`📊 Health check: http://localhost:${port}/healthz`);
  console.log(`🌐 GEO E-E-A-T: http://localhost:${port}/v1/geo/eeat?workspaceId=test`);
  console.log(`📈 Dashboard: http://localhost:${port}/v1/geo/dashboard/overview?workspaceId=test`);
  console.log(`🔍 Data Summary: http://localhost:${port}/v1/geo/data/summary?workspaceId=test`);
}

bootstrap().catch(console.error);

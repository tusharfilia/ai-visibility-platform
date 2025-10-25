/**
 * Minimal API for Railway deployment
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('🚀 Starting minimal API...');
  
  try {
    const app = await NestFactory.create(AppModule, { 
      logger: false // Disable all logging
    });
    
    const port = process.env.PORT || 8080;
    
    // Simple health check
    app.use('/healthz', (req, res) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    await app.listen(port);
    console.log(`✅ API running on port ${port}`);
    
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

bootstrap();

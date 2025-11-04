/**
 * Ultra-minimal API for Railway deployment
 * No NestJS modules, just Express
 */

import express from 'express';

async function bootstrap() {
  console.log('🚀 Starting ultra-minimal API...');
  
  try {
    const app = express();
    const port = process.env.PORT || 8080;
    
    // Simple health check
    app.get('/healthz', (req, res) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    app.listen(port, () => {
      console.log(`✅ Ultra-minimal API running on port ${port}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

bootstrap();



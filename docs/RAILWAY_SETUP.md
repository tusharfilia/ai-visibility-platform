# Railway Environment Setup Guide

## Required Environment Variables

Copy and paste these environment variables into your Railway project settings:

### Core Server Configuration
```bash
NODE_ENV=production
PORT=8080
API_BASE_URL=https://your-api.railway.app
FRONTEND_URL=https://your-app.lovable.app
```

### Authentication
```bash
JWT_SECRET=your-secure-jwt-secret-here
JWKS_URI=https://your-lovable-app.lovable.app/.well-known/jwks.json
DEBUG_JWT_MODE=false
```

### Database & Cache
```bash
DATABASE_URL=postgresql://postgres:password@host:5432/dbname
REDIS_URL=redis://host:6379
```

### LLM Providers
```bash
# Add your API keys from OpenAI, Anthropic, and Google AI
OPENAI_API_KEY=YOUR_OPENAI_KEY_HERE
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_KEY_HERE
GOOGLE_AI_API_KEY=YOUR_GOOGLE_AI_KEY_HERE
```

### Email Service
```bash
# Add your Resend API key
RESEND_API_KEY=YOUR_RESEND_KEY_HERE
```

### File Storage (Cloudflare R2)
```bash
CLOUDFLARE_R2_ACCESS_KEY_ID=6c22d75e70ed0d1045b8d7a9e244348c
CLOUDFLARE_R2_SECRET_ACCESS_KEY=38b11efdd609e0081b33ee830093dfa83dacb7b1b27b38f88f67a8b3729a8cb7
CLOUDFLARE_R2_ENDPOINT=https://8785a2cd57df54423041f844f6b3aee2.r2.cloudflarestorage.com
CLOUDFLARE_R2_BUCKET=ai-visibility-assets
CLOUDFLARE_ACCOUNT_ID=8785a2cd57df54423041f844f6b3aee2
```

### Search Engine APIs
```bash
PERPLEXITY_API_KEY=your-perplexity-key
BRAVE_API_KEY=your-brave-key
```

### Feature Flags
```bash
MOCK_PROVIDERS=false
FULL_AUTO_DEFAULT=false
BRAND_DEFENSE_ENABLED=true
```

### Observability
```bash
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
```

### CORS Configuration
```bash
CORS_ALLOWED_ORIGINS=https://your-app.lovable.app,http://localhost:5173
```

### Cost Management
```bash
DEFAULT_MONTHLY_BUDGET=100.00
BUDGET_ALERT_THRESHOLDS=50,75,90,100
```

## How to Add Environment Variables in Railway

1. Go to your Railway project dashboard
2. Click on your service (API)
3. Go to the "Variables" tab
4. Click "New Variable"
5. Add each variable above with its corresponding value
6. Click "Deploy" to apply changes

## Important Notes

- **Never commit API keys to git** - they are already in Railway environment variables
- **Update JWT_SECRET** with a secure random string for production
- **Update API_BASE_URL** with your actual Railway URL
- **Update FRONTEND_URL** with your actual frontend URL
- **Set MOCK_PROVIDERS=false** for production to use real APIs

## Verification

After adding all environment variables:

1. Deploy your service
2. Check logs for any missing environment variable errors
3. Test the health endpoint: `GET /healthz`
4. Verify all services are connecting properly


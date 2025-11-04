# Testing Guide - Best-in-Market GEO Features

This guide will help you test the newly implemented features:
1. **E-E-A-T Scoring System**
2. **Fact-Level Consensus Tracking**
3. **Dashboard API Endpoints**

## Prerequisites

### 1. Run Database Migration

First, you need to create the migration for the new `EEATScore` model:

```bash
# Navigate to the db package
cd packages/db

# Create migration for EEATScore
pnpm prisma migrate dev --name add_eeat_score_model

# Or if you prefer to push schema without migration history
pnpm prisma db push
```

### 2. Verify Database Connection

Make sure your `.env` file has:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/ai_visibility?schema=public"
```

### 3. Check if Infrastructure is Running

```bash
# Start PostgreSQL and Redis
docker compose -f infra/docker-compose.yml up -d

# Check status
docker compose -f infra/docker-compose.yml ps
```

### 4. Start the API Server

```bash
# From project root
pnpm --filter @apps/api dev
```

The API should start on `http://localhost:8080` (or port 3000, check the console output).

## Testing Endpoints

### Setup Test Workspace

You'll need a workspace ID to test. You can either:
1. Use an existing workspace from your database
2. Create a test workspace using the seed script
3. Create one manually via the API

#### Option 1: Create Test Workspace (Recommended)

```bash
# First, seed the database if you haven't already
pnpm --filter @ai-visibility-platform/db prisma db seed

# Or create a workspace manually using Prisma Studio
pnpm --filter @ai-visibility-platform/db prisma studio
```

#### Option 2: Use Existing Workspace

Query your database:
```sql
SELECT id FROM "Workspace" LIMIT 1;
```

Also ensure you have a WorkspaceProfile:
```sql
SELECT "workspaceId" FROM "WorkspaceProfile" LIMIT 1;
```

### Authentication

For local testing, check if `DEBUG_JWT_MODE` is enabled in your `.env`:

```env
DEBUG_JWT_MODE=true
```

If not, you'll need a JWT token. You can:
1. Check the auth endpoint to get a token
2. Use the Swagger UI to authenticate

### Test Script

I'll create a test script for you that tests all endpoints. But first, let's test manually:

## Manual Testing Steps

### 1. Test E-E-A-T Scoring

```bash
# Replace WORKSPACE_ID with your actual workspace ID
curl -X GET "http://localhost:8080/v1/geo/eeat?workspaceId=YOUR_WORKSPACE_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "ok": true,
  "data": {
    "experience": 65,
    "expertise": 72,
    "authoritativeness": 58,
    "trustworthiness": 70,
    "overallScore": 66,
    "level": "high",
    "breakdown": {
      "experience": { "yearsInBusiness": 20, "caseStudies": 15, ... },
      "expertise": { "certifications": 0, "awards": 0, ... },
      ...
    },
    "createdAt": "2025-01-27T...",
    "updatedAt": "2025-01-27T..."
  }
}
```

### 2. Test Fact-Level Consensus

```bash
# Get consensus for all fact types
curl -X GET "http://localhost:8080/v1/geo/evidence/consensus?workspaceId=YOUR_WORKSPACE_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get consensus for specific fact type (address)
curl -X GET "http://localhost:8080/v1/geo/evidence/consensus?workspaceId=YOUR_WORKSPACE_ID&factType=address" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "ok": true,
  "data": [
    {
      "factType": "address",
      "consensus": 85,
      "agreementCount": 17,
      "contradictionCount": 2,
      "independentSources": 5,
      "facts": [...],
      "mostCommonValue": "123 Main St, San Francisco, CA 94102"
    },
    ...
  ]
}
```

### 3. Test Dashboard Overview

```bash
curl -X GET "http://localhost:8080/v1/geo/dashboard/overview?workspaceId=YOUR_WORKSPACE_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "ok": true,
  "data": {
    "maturityScore": {
      "entityStrength": 75,
      "citationDepth": 68,
      "structuralClarity": 72,
      "updateCadence": 65,
      "overallScore": 70,
      "maturityLevel": "advanced",
      "recommendations": []
    },
    "eeatScore": { ... },
    "recommendations": [ ... ],
    "engineComparison": [ ... ],
    "progress": [ ... ],
    "factConsensus": [ ... ],
    "lastUpdated": "2025-01-27T..."
  }
}
```

### 4. Test Other Dashboard Endpoints

```bash
# Maturity with trends
curl -X GET "http://localhost:8080/v1/geo/dashboard/maturity?workspaceId=YOUR_WORKSPACE_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Recommendations
curl -X GET "http://localhost:8080/v1/geo/dashboard/recommendations?workspaceId=YOUR_WORKSPACE_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Engine comparison
curl -X GET "http://localhost:8080/v1/geo/dashboard/engines/comparison?workspaceId=YOUR_WORKSPACE_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Progress history
curl -X GET "http://localhost:8080/v1/geo/dashboard/progress?workspaceId=YOUR_WORKSPACE_ID&days=30" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Maturity history
curl -X GET "http://localhost:8080/v1/geo/maturity/history?workspaceId=YOUR_WORKSPACE_ID&timeRange=30d" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Using Swagger UI

The easiest way to test is via Swagger UI:

1. **Start the API server**
2. **Open**: `http://localhost:8080/v1/docs`
3. **Click "Authorize"** and enter your JWT token (or use DEBUG_JWT_MODE)
4. **Navigate to GEO endpoints**:
   - GEO E-E-A-T → `GET /v1/geo/eeat`
   - GEO Evidence → `GET /v1/geo/evidence/consensus`
   - GEO Dashboard → All dashboard endpoints

## Common Issues

### Issue: "No workspace profile found"
**Solution**: Create a WorkspaceProfile for your workspace:
```sql
INSERT INTO "WorkspaceProfile" ("id", "workspaceId", "businessName", "verified")
VALUES ('test-profile-id', 'YOUR_WORKSPACE_ID', 'Test Business', false);
```

### Issue: "Migration not applied"
**Solution**: Run the migration:
```bash
pnpm --filter @ai-visibility-platform/db prisma migrate dev
```

### Issue: "401 Unauthorized"
**Solution**: 
- Check if `DEBUG_JWT_MODE=true` in `.env`
- Or get a valid JWT token from the auth endpoint

### Issue: Empty responses or errors
**Solution**: Ensure you have:
- Citations data in the database
- Mentions data
- At least one WorkspaceProfile
- Prompt runs linked to your workspace

## Quick Test Checklist

- [ ] Database migration run successfully
- [ ] Infrastructure (PostgreSQL, Redis) running
- [ ] API server started without errors
- [ ] Workspace ID available
- [ ] WorkspaceProfile exists for workspace
- [ ] Authentication token/JWT available
- [ ] Tested E-E-A-T endpoint
- [ ] Tested Fact Consensus endpoint
- [ ] Tested Dashboard Overview endpoint

## Next Steps

Once basic testing works, you can:
1. Add real citation/mention data to test fact extraction
2. Test with multiple workspaces
3. Verify caching works (15-minute TTL on dashboard)
4. Check progress tracking over time




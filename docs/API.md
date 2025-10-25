# AI Visibility Platform - API Documentation

Complete API reference for the AI Visibility Platform.

## Table of Contents
1. [Authentication](#authentication)
2. [Base URL](#base-url)
3. [Error Handling](#error-handling)
4. [Pagination](#pagination)
5. [Rate Limiting](#rate-limiting)
6. [Endpoints](#endpoints)
7. [Webhooks](#webhooks)
8. [SDK Examples](#sdk-examples)

## Authentication

All API endpoints require authentication via JWT tokens.

### Headers
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

### Token Claims
```json
{
  "sub": "user-id",
  "workspace_id": "workspace-id",
  "permissions": ["read", "write", "admin"],
  "iat": 1640995200,
  "exp": 1641081600
}
```

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: `https://api.ai-visibility-platform.com`

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "query",
      "reason": "Required field is missing"
    },
    "timestamp": "2024-01-01T00:00:00Z",
    "request_id": "req-123456"
  }
}
```

### Error Codes
- `VALIDATION_ERROR` - Input validation failed
- `AUTHENTICATION_ERROR` - Invalid or missing token
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `RATE_LIMIT_ERROR` - Rate limit exceeded
- `PROVIDER_ERROR` - External provider error
- `INTERNAL_ERROR` - Server error

## Pagination

List endpoints support cursor-based pagination:

### Query Parameters
- `limit` - Number of items per page (default: 20, max: 100)
- `cursor` - Cursor for pagination (base64 encoded)

### Response Format
```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "has_more": true,
    "total": 1000
  }
}
```

## Rate Limiting

Rate limits are applied per IP and workspace:

- **Per IP**: 100 requests/minute
- **Per Workspace**: 1000 requests/minute
- **Burst**: 200 requests/minute

### Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995260
```

## Endpoints

### Health & System

#### GET /healthz
Basic health check.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

#### GET /readyz
Readiness check for load balancers.

**Response:**
```json
{
  "status": "ready",
  "database": "connected",
  "redis": "connected",
  "queues": "healthy"
}
```

#### GET /metrics
Prometheus metrics endpoint.

**Response:** Prometheus format metrics

### Instant Summary

#### POST /v1/instant-summary
Generate instant summary for a query.

**Request:**
```json
{
  "query": "What is the latest news about AI?",
  "engines": ["perplexity", "aio"],
  "max_results": 10,
  "include_citations": true,
  "include_sentiment": true
}
```

**Response:**
```json
{
  "summary": "Latest AI news includes...",
  "engines_used": ["perplexity", "aio"],
  "citations": [
    {
      "url": "https://example.com/article",
      "title": "AI News Article",
      "domain": "example.com",
      "relevance_score": 0.95
    }
  ],
  "sentiment": {
    "overall": "positive",
    "confidence": 0.85,
    "breakdown": {
      "positive": 0.7,
      "neutral": 0.2,
      "negative": 0.1
    }
  },
  "metadata": {
    "processing_time": 2.5,
    "cost": 0.05,
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### Metrics

#### GET /v1/metrics/overview
Get workspace metrics overview.

**Query Parameters:**
- `period` - Time period (7d, 30d, 90d)
- `workspace_id` - Workspace ID (optional)

**Response:**
```json
{
  "period": "7d",
  "total_queries": 1500,
  "total_citations": 4500,
  "top_domains": [
    {
      "domain": "example.com",
      "count": 150,
      "percentage": 10.0
    }
  ],
  "cost_breakdown": {
    "perplexity": 25.50,
    "aio": 15.75,
    "brave": 8.25
  },
  "trends": {
    "queries": {
      "current": 1500,
      "previous": 1200,
      "change": 25.0
    },
    "cost": {
      "current": 49.50,
      "previous": 42.00,
      "change": 17.9
    }
  }
}
```

#### GET /v1/citations/top-domains
Get top citation domains.

**Query Parameters:**
- `limit` - Number of domains (default: 20)
- `period` - Time period (7d, 30d, 90d)

**Response:**
```json
{
  "domains": [
    {
      "domain": "example.com",
      "count": 150,
      "percentage": 10.0,
      "trend": "up",
      "last_seen": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "has_more": true,
    "total": 1000
  }
}
```

### Prompts

#### GET /v1/prompts
List prompts for the workspace.

**Query Parameters:**
- `limit` - Items per page (default: 20)
- `cursor` - Pagination cursor
- `status` - Filter by status (active, inactive)
- `engine` - Filter by engine

**Response:**
```json
{
  "prompts": [
    {
      "id": "prompt-123",
      "name": "AI News Summary",
      "query": "What is the latest news about AI?",
      "engines": ["perplexity", "aio"],
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "last_run": "2024-01-01T00:00:00Z",
      "run_count": 150
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "has_more": true,
    "total": 1000
  }
}
```

#### POST /v1/prompts
Create a new prompt.

**Request:**
```json
{
  "name": "AI News Summary",
  "query": "What is the latest news about AI?",
  "engines": ["perplexity", "aio"],
  "schedule": {
    "enabled": true,
    "cron": "0 9 * * *",
    "timezone": "UTC"
  },
  "settings": {
    "max_results": 10,
    "include_citations": true,
    "include_sentiment": true
  }
}
```

**Response:**
```json
{
  "id": "prompt-123",
  "name": "AI News Summary",
  "query": "What is the latest news about AI?",
  "engines": ["perplexity", "aio"],
  "status": "active",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

#### GET /v1/prompts/{id}
Get a specific prompt.

**Response:**
```json
{
  "id": "prompt-123",
  "name": "AI News Summary",
  "query": "What is the latest news about AI?",
  "engines": ["perplexity", "aio"],
  "status": "active",
  "schedule": {
    "enabled": true,
    "cron": "0 9 * * *",
    "timezone": "UTC",
    "next_run": "2024-01-02T09:00:00Z"
  },
  "settings": {
    "max_results": 10,
    "include_citations": true,
    "include_sentiment": true
  },
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "last_run": "2024-01-01T00:00:00Z",
  "run_count": 150
}
```

#### PUT /v1/prompts/{id}
Update a prompt.

**Request:**
```json
{
  "name": "Updated AI News Summary",
  "query": "What is the latest news about AI in 2024?",
  "engines": ["perplexity", "aio", "brave"],
  "settings": {
    "max_results": 15,
    "include_citations": true,
    "include_sentiment": true
  }
}
```

#### DELETE /v1/prompts/{id}
Delete a prompt.

**Response:**
```json
{
  "message": "Prompt deleted successfully"
}
```

### Engines

#### GET /v1/engines
List available AI engines.

**Response:**
```json
{
  "engines": [
    {
      "key": "perplexity",
      "name": "Perplexity AI",
      "description": "Real-time web search with citations",
      "status": "active",
      "capabilities": ["web_search", "citations", "real_time"],
      "cost_per_1k_tokens": 0.20,
      "rate_limit": {
        "requests_per_minute": 100,
        "tokens_per_minute": 100000
      }
    },
    {
      "key": "aio",
      "name": "Google AI Overviews",
      "description": "Google AI Overviews via SerpAPI",
      "status": "active",
      "capabilities": ["ai_overviews", "search_results"],
      "cost_per_1k_tokens": 0.05,
      "rate_limit": {
        "requests_per_minute": 1000,
        "tokens_per_minute": 500000
      }
    },
    {
      "key": "brave",
      "name": "Brave Search",
      "description": "Brave Search API with summarization",
      "status": "active",
      "capabilities": ["web_search", "summarization"],
      "cost_per_1k_tokens": 0.10,
      "rate_limit": {
        "requests_per_minute": 100,
        "tokens_per_minute": 50000
      }
    }
  ]
}
```

### Copilot

#### GET /v1/copilot/rules
List Copilot rules.

**Query Parameters:**
- `limit` - Items per page (default: 20)
- `cursor` - Pagination cursor
- `status` - Filter by status (active, inactive)

**Response:**
```json
{
  "rules": [
    {
      "id": "rule-123",
      "name": "Brand Defense Rule",
      "description": "Monitor for brand mentions",
      "pattern": "brand-name",
      "action": "alert",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "trigger_count": 25
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "has_more": true,
    "total": 1000
  }
}
```

#### POST /v1/copilot/rules
Create a new Copilot rule.

**Request:**
```json
{
  "name": "Brand Defense Rule",
  "description": "Monitor for brand mentions",
  "pattern": "brand-name",
  "action": "alert",
  "settings": {
    "threshold": 0.8,
    "cooldown": 3600,
    "channels": ["email", "slack"]
  }
}
```

#### GET /v1/copilot/actions
List Copilot actions.

**Query Parameters:**
- `limit` - Items per page (default: 20)
- `cursor` - Pagination cursor
- `status` - Filter by status (pending, approved, rejected)

**Response:**
```json
{
  "actions": [
    {
      "id": "action-123",
      "rule_id": "rule-123",
      "type": "alert",
      "status": "approved",
      "payload": {
        "message": "Brand mention detected",
        "severity": "high"
      },
      "created_at": "2024-01-01T00:00:00Z",
      "approved_at": "2024-01-01T00:05:00Z",
      "approved_by": "user-456"
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "has_more": true,
    "total": 1000
  }
}
```

### Connections

#### GET /v1/connections
List data connections.

**Query Parameters:**
- `limit` - Items per page (default: 20)
- `cursor` - Pagination cursor
- `type` - Filter by type (webhook, api, cms)

**Response:**
```json
{
  "connections": [
    {
      "id": "conn-123",
      "name": "CMS Webhook",
      "type": "webhook",
      "status": "active",
      "url": "https://cms.example.com/webhook",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "last_sync": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "has_more": true,
    "total": 1000
  }
}
```

### Alerts

#### GET /v1/alerts
List system alerts.

**Query Parameters:**
- `limit` - Items per page (default: 20)
- `cursor` - Pagination cursor
- `type` - Filter by type (budget, rate_limit, error, performance)
- `status` - Filter by status (active, resolved)

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert-123",
      "type": "budget",
      "severity": "high",
      "message": "Daily budget exceeded",
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z",
      "resolved_at": null,
      "metadata": {
        "budget": 100,
        "current": 150,
        "workspace_id": "workspace-123"
      }
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "has_more": true,
    "total": 1000
  }
}
```

### Reports

#### GET /v1/reports
List generated reports.

**Query Parameters:**
- `limit` - Items per page (default: 20)
- `cursor` - Pagination cursor
- `type` - Filter by type (daily, weekly, monthly)
- `status` - Filter by status (pending, completed, failed)

**Response:**
```json
{
  "reports": [
    {
      "id": "report-123",
      "type": "daily",
      "status": "completed",
      "title": "Daily AI Visibility Report",
      "created_at": "2024-01-01T00:00:00Z",
      "completed_at": "2024-01-01T00:05:00Z",
      "file_url": "https://storage.example.com/reports/report-123.pdf",
      "metadata": {
        "period": "2024-01-01",
        "workspace_id": "workspace-123",
        "total_queries": 150,
        "total_citations": 450
      }
    }
  ],
  "pagination": {
    "next_cursor": "eyJpZCI6IjEyMyJ9",
    "has_more": true,
    "total": 1000
  }
}
```

## Webhooks

### Webhook Configuration

Webhooks are configured per workspace and can be triggered by various events:

- **Prompt completed** - When a prompt run completes
- **Alert triggered** - When an alert is triggered
- **Report generated** - When a report is generated
- **Budget exceeded** - When budget threshold is exceeded

### Webhook Payload

```json
{
  "event": "prompt.completed",
  "timestamp": "2024-01-01T00:00:00Z",
  "workspace_id": "workspace-123",
  "data": {
    "prompt_id": "prompt-123",
    "run_id": "run-456",
    "status": "completed",
    "results": {
      "summary": "AI news summary...",
      "citations": [...],
      "cost": 0.05
    }
  }
}
```

### Webhook Security

Webhooks are secured with HMAC signatures:

```
X-Webhook-Signature: sha256=abc123...
X-Webhook-Timestamp: 1640995200
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { AIVisibilityClient } from '@ai-visibility-platform/client';

const client = new AIVisibilityClient({
  baseUrl: 'https://api.ai-visibility-platform.com',
  apiKey: 'your-api-key'
});

// Generate instant summary
const summary = await client.instantSummary.create({
  query: 'What is the latest news about AI?',
  engines: ['perplexity', 'aio'],
  maxResults: 10,
  includeCitations: true
});

// Get metrics
const metrics = await client.metrics.getOverview({
  period: '7d',
  workspaceId: 'workspace-123'
});

// List prompts
const prompts = await client.prompts.list({
  limit: 20,
  status: 'active'
});
```

### Python

```python
from ai_visibility_platform import AIVisibilityClient

client = AIVisibilityClient(
    base_url='https://api.ai-visibility-platform.com',
    api_key='your-api-key'
)

# Generate instant summary
summary = client.instant_summary.create(
    query='What is the latest news about AI?',
    engines=['perplexity', 'aio'],
    max_results=10,
    include_citations=True
)

# Get metrics
metrics = client.metrics.get_overview(
    period='7d',
    workspace_id='workspace-123'
)
```

### cURL Examples

```bash
# Generate instant summary
curl -X POST https://api.ai-visibility-platform.com/v1/instant-summary \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the latest news about AI?",
    "engines": ["perplexity", "aio"],
    "max_results": 10,
    "include_citations": true
  }'

# Get metrics
curl -X GET "https://api.ai-visibility-platform.com/v1/metrics/overview?period=7d" \
  -H "Authorization: Bearer $TOKEN"

# List prompts
curl -X GET "https://api.ai-visibility-platform.com/v1/prompts?limit=20&status=active" \
  -H "Authorization: Bearer $TOKEN"
```

## Rate Limits

### Default Limits
- **Per IP**: 100 requests/minute
- **Per Workspace**: 1000 requests/minute
- **Burst**: 200 requests/minute

### Provider Limits
- **Perplexity**: 100 requests/minute, 100k tokens/minute
- **Google AI Overviews**: 1000 requests/minute, 500k tokens/minute
- **Brave Search**: 100 requests/minute, 50k tokens/minute

### Cost Limits
- **Per Workspace**: $100/day default
- **Auto-throttling**: Enabled when 80% of budget reached
- **Emergency stop**: When 100% of budget reached

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Input validation failed | 400 |
| `AUTHENTICATION_ERROR` | Invalid or missing token | 401 |
| `AUTHORIZATION_ERROR` | Insufficient permissions | 403 |
| `RATE_LIMIT_ERROR` | Rate limit exceeded | 429 |
| `PROVIDER_ERROR` | External provider error | 502 |
| `INTERNAL_ERROR` | Server error | 500 |

## Support

For API support and questions:
- **Documentation**: [Documentation URL]
- **GitHub Issues**: [Repository URL]/issues
- **Email**: [Support Email]
- **Status Page**: [Status Page URL]

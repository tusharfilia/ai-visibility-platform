# AI Visibility Platform - Deployment Guide

Complete deployment guide for the AI Visibility Platform.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Local Development](#local-development)
4. [Production Deployment](#production-deployment)
5. [Docker Deployment](#docker-deployment)
6. [Kubernetes Deployment](#kubernetes-deployment)
7. [Monitoring Setup](#monitoring-setup)
8. [Security Configuration](#security-configuration)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- **Node.js**: 20.x or higher
- **pnpm**: 8.x or higher
- **Docker**: 20.x or higher
- **Docker Compose**: 2.x or higher
- **PostgreSQL**: 15.x or higher
- **Redis**: 7.x or higher

### Cloud Requirements
- **Database**: PostgreSQL (Neon, AWS RDS, or self-hosted)
- **Cache/Queue**: Redis (Upstash, AWS ElastiCache, or self-hosted)
- **Storage**: S3-compatible storage (AWS S3, MinIO, etc.)
- **Monitoring**: Sentry, OpenTelemetry, Prometheus

## Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/ai-visibility-platform.git
cd ai-visibility-platform
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# API Configuration
API_PORT=3000
API_HOST=0.0.0.0
NODE_ENV=production

# Database
DATABASE_URL="postgresql://user:password@host:5432/database"
REDIS_URL="redis://host:6379"

# Authentication
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="7d"
JWKS_URL="https://your-jwks-endpoint/.well-known/jwks.json"

# Observability
SENTRY_DSN="https://your-sentry-dsn"
OTEL_EXPORTER_OTLP_ENDPOINT="https://your-otel-endpoint"
PROMETHEUS_ENABLED=true

# Provider API Keys
PERPLEXITY_API_KEY="your-perplexity-key"
SERPAPI_KEY="your-serpapi-key"
BRAVE_API_KEY="your-brave-key"

# Feature Flags
FEATURE_FLAGS_ENABLED=true
FEATURE_FLAGS_API_KEY="your-flags-api-key"

# Storage
STORAGE_PROVIDER="s3"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
S3_BUCKET="your-bucket"

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=100
RATE_LIMIT_BURST=200

# Cost Management
BUDGET_DAILY_DEFAULT=100
AUTO_THROTTLE_ENABLED=true
AUTO_THROTTLE_THRESHOLD=0.8
```

## Local Development

### 1. Start Infrastructure
```bash
docker-compose -f infra/docker-compose.yml up -d
```

### 2. Database Setup
```bash
# Run migrations
pnpm --filter @ai-visibility-platform/db prisma migrate dev

# Seed demo data
pnpm --filter @ai-visibility-platform/db prisma db seed
```

### 3. Start Services
```bash
# Start all services
pnpm dev

# Or start individually
pnpm --filter @ai-visibility-platform/api dev
pnpm --filter @ai-visibility-platform/jobs dev
```

### 4. Verify Setup
```bash
# Check health
curl http://localhost:3000/healthz

# Check readiness
curl http://localhost:3000/readyz

# Check metrics
curl http://localhost:3000/metrics
```

## Production Deployment

### 1. Build Applications
```bash
pnpm build
```

### 2. Database Migration
```bash
pnpm --filter @ai-visibility-platform/db prisma migrate deploy
```

### 3. Deploy API Server
```bash
# Using PM2
pm2 start apps/api/dist/main.js --name api-server --instances 2

# Using systemd
sudo systemctl start ai-visibility-api
```

### 4. Deploy Jobs Worker
```bash
# Using PM2
pm2 start apps/jobs/dist/index.js --name jobs-worker --instances 4

# Using systemd
sudo systemctl start ai-visibility-jobs
```

### 5. Configure Reverse Proxy
```nginx
# Nginx configuration
server {
    listen 80;
    server_name api.ai-visibility-platform.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Docker Deployment

### 1. Build Images
```bash
# Build API image
docker build -t ai-visibility-api apps/api/

# Build Jobs image
docker build -t ai-visibility-jobs apps/jobs/
```

### 2. Docker Compose
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  api:
    image: ai-visibility-api
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  jobs:
    image: ai-visibility-jobs
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 3. Deploy with Docker Compose
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Kubernetes Deployment

### 1. Namespace
```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ai-visibility-platform
```

### 2. ConfigMap
```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ai-visibility-config
  namespace: ai-visibility-platform
data:
  NODE_ENV: "production"
  API_PORT: "3000"
  API_HOST: "0.0.0.0"
```

### 3. Secret
```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ai-visibility-secrets
  namespace: ai-visibility-platform
type: Opaque
data:
  DATABASE_URL: <base64-encoded-url>
  REDIS_URL: <base64-encoded-url>
  JWT_SECRET: <base64-encoded-secret>
  PERPLEXITY_API_KEY: <base64-encoded-key>
  SERPAPI_KEY: <base64-encoded-key>
  BRAVE_API_KEY: <base64-encoded-key>
```

### 4. API Deployment
```yaml
# api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: ai-visibility-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
    spec:
      containers:
      - name: api
        image: ai-visibility-api:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: ai-visibility-config
        - secretRef:
            name: ai-visibility-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /readyz
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 5. Jobs Deployment
```yaml
# jobs-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jobs-worker
  namespace: ai-visibility-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: jobs-worker
  template:
    metadata:
      labels:
        app: jobs-worker
    spec:
      containers:
      - name: jobs
        image: ai-visibility-jobs:latest
        envFrom:
        - configMapRef:
            name: ai-visibility-config
        - secretRef:
            name: ai-visibility-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### 6. Service
```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: ai-visibility-platform
spec:
  selector:
    app: api-server
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### 7. Ingress
```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ai-visibility-ingress
  namespace: ai-visibility-platform
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.ai-visibility-platform.com
    secretName: ai-visibility-tls
  rules:
  - host: api.ai-visibility-platform.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80
```

## Monitoring Setup

### 1. Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'ai-visibility-api'
    static_configs:
      - targets: ['api-server:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s
```

### 2. Grafana Dashboard
```json
{
  "dashboard": {
    "title": "AI Visibility Platform",
    "panels": [
      {
        "title": "HTTP Requests",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      },
      {
        "title": "Queue Jobs",
        "type": "graph",
        "targets": [
          {
            "expr": "queue_jobs_total",
            "legendFormat": "{{queue}} {{status}}"
          }
        ]
      }
    ]
  }
}
```

### 3. Alert Rules
```yaml
# alerts.yml
groups:
- name: ai-visibility-alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} errors per second"

  - alert: QueueBacklog
    expr: queue_jobs_total{status="waiting"} > 100
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Queue backlog is high"
      description: "{{ $value }} jobs waiting in queue"
```

## Security Configuration

### 1. SSL/TLS
```bash
# Generate SSL certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

### 2. Firewall Rules
```bash
# UFW configuration
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. Database Security
```sql
-- Create database user
CREATE USER ai_visibility_user WITH PASSWORD 'secure_password';

-- Grant permissions
GRANT CONNECT ON DATABASE ai_visibility TO ai_visibility_user;
GRANT USAGE ON SCHEMA public TO ai_visibility_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ai_visibility_user;
```

### 4. Redis Security
```bash
# Redis configuration
requirepass your_redis_password
bind 127.0.0.1
protected-mode yes
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
curl http://localhost:3000/v1/admin/system | jq '.system.database'
```

#### 2. Redis Connection Failed
```bash
# Check Redis connectivity
redis-cli -u $REDIS_URL ping

# Check Redis memory
redis-cli info memory
```

#### 3. Provider API Errors
```bash
# Check provider status
curl http://localhost:3000/v1/admin/system | jq '.system.providers'

# Check provider logs
grep "ProviderError" logs/api.log
```

#### 4. Queue Processing Issues
```bash
# Check queue status
curl http://localhost:3000/v1/admin/system | jq '.system.queues'

# Check failed jobs
redis-cli -u $REDIS_URL llen "bull:runPrompt:failed"
```

### Log Analysis
```bash
# API logs
tail -f logs/api.log | grep ERROR

# Jobs logs
tail -f logs/jobs.log | grep ERROR

# System logs
journalctl -u ai-visibility-api -f
```

### Performance Tuning
```bash
# Increase worker concurrency
export WORKER_CONCURRENCY=10

# Adjust connection pool
export DATABASE_POOL_SIZE=20

# Enable caching
export REDIS_CACHE_TTL=3600
```

## Backup & Recovery

### 1. Database Backup
```bash
# Full backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Incremental backup
pg_dump $DATABASE_URL --schema-only > schema-$(date +%Y%m%d).sql
```

### 2. Redis Backup
```bash
# Redis backup
redis-cli --rdb backup-$(date +%Y%m%d).rdb
```

### 3. Application Backup
```bash
# Code backup
tar -czf code-$(date +%Y%m%d).tar.gz .

# Configuration backup
tar -czf config-$(date +%Y%m%d).tar.gz .env docker-compose.yml
```

## Scaling

### Horizontal Scaling
```bash
# Scale API servers
kubectl scale deployment api-server --replicas=5

# Scale job workers
kubectl scale deployment jobs-worker --replicas=3
```

### Vertical Scaling
```yaml
# Increase resources
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

## Maintenance

### 1. Database Maintenance
```bash
# Vacuum database
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Update statistics
psql $DATABASE_URL -c "ANALYZE;"
```

### 2. Cache Maintenance
```bash
# Clear cache
redis-cli -u $REDIS_URL FLUSHDB

# Check memory usage
redis-cli -u $REDIS_URL info memory
```

### 3. Log Rotation
```bash
# Configure logrotate
sudo nano /etc/logrotate.d/ai-visibility-platform
```

## Support

For deployment support:
- **Documentation**: [Documentation URL]
- **GitHub Issues**: [Repository URL]/issues
- **Email**: [Support Email]
- **Status Page**: [Status Page URL]

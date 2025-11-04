const http = require('http');
const url = require('url');

const PORT = 3004;

// Mock data for Batch 4 Enterprise Features
const mockWorkspaceMetrics = {
  workspaceId: 'ws_123',
  visibilityScore: 78.5,
  mentionCount: 45,
  rankingPositions: [3, 7, 12, 15],
  sentimentScore: 82.3,
  trustScore: 76.8,
  competitorGap: 5.2,
  opportunities: 8,
  alerts: 2,
  executions: 156,
  cost: 1250.75,
  apiCalls: 2847,
  errors: 12,
};

const mockSystemMetrics = {
  cpuUsage: 45.2,
  memoryUsage: 68.7,
  diskUsage: 23.4,
  activeConnections: 156,
  queueDepth: 23,
  errorRate: 0.02,
  responseTime: 245,
  throughput: 1250,
  uptime: 86400,
};

const mockAlertRules = [
  {
    id: 'rule_1',
    name: 'High Error Rate',
    type: 'system',
    condition: { metric: 'error_rate', operator: 'greater_than', threshold: 0.05 },
    severity: 'high',
    enabled: true,
    triggerCount: 3,
  },
  {
    id: 'rule_2',
    name: 'Low Visibility Score',
    type: 'workspace',
    condition: { metric: 'visibility_score', operator: 'less_than', threshold: 30 },
    severity: 'medium',
    enabled: true,
    triggerCount: 1,
  },
];

const mockActiveAlerts = [
  {
    id: 'alert_1',
    ruleId: 'rule_1',
    type: 'system',
    severity: 'high',
    title: 'High Error Rate - error_rate',
    message: 'error_rate is greater_than 0.05 (current: 0.08)',
    status: 'active',
    createdAt: new Date(),
  },
];

const mockWhiteLabelConfig = {
  id: 'config_1',
  clientId: 'client_123',
  clientName: 'TechCorp Enterprise',
  domain: 'ai-visibility.techcorp.com',
  branding: {
    logo: 'https://techcorp.com/logo.png',
    favicon: 'https://techcorp.com/favicon.ico',
    primaryColor: '#1e40af',
    secondaryColor: '#3b82f6',
    fontFamily: 'Inter, sans-serif',
  },
  features: {
    customDomain: true,
    customEmail: true,
    customReports: true,
    customIntegrations: true,
    apiAccess: true,
    sso: true,
  },
  limits: {
    maxWorkspaces: 50,
    maxUsers: 500,
    maxApiCalls: 100000,
    maxStorage: 1000,
  },
  status: 'active',
};

const mockApiKey = {
  id: 'key_1',
  clientId: 'client_123',
  name: 'Production API Key',
  key: 'ak_1234567890abcdef',
  secret: 'as_abcdef1234567890',
  permissions: ['read:metrics', 'write:alerts', 'read:workspaces'],
  rateLimit: { requestsPerMinute: 1000, requestsPerDay: 100000 },
  status: 'active',
  createdAt: new Date(),
};

const mockMarketplaceApps = [
  {
    id: 'app_1',
    name: 'Slack Integration',
    description: 'Send alerts and reports to Slack channels',
    version: '1.2.0',
    category: 'integration',
    developer: { name: 'AI Visibility Team', email: 'dev@aivisibility.com' },
    pricing: { model: 'free' },
    features: ['Real-time alerts', 'Custom reports', 'Team notifications'],
    status: 'approved',
    downloads: 1250,
    rating: 4.8,
    reviews: 156,
  },
  {
    id: 'app_2',
    name: 'Advanced Analytics',
    description: 'Enhanced analytics and reporting capabilities',
    version: '2.1.0',
    category: 'analytics',
    developer: { name: 'Analytics Pro', email: 'contact@analyticspro.com' },
    pricing: { model: 'paid', price: 99, currency: 'USD', billingCycle: 'monthly' },
    features: ['Custom dashboards', 'Advanced metrics', 'Export capabilities'],
    status: 'approved',
    downloads: 890,
    rating: 4.6,
    reviews: 98,
  },
];

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (path === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '4.0.0',
      features: ['observability', 'whitelabel', 'api-marketplace', 'production-deployment']
    }));
    return;
  }

  // Readiness check
  if (path === '/readyz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        observabilityService: 'healthy',
        whiteLabelService: 'healthy',
        apiMarketplaceService: 'healthy',
        productionDeployment: 'ready',
      }
    }));
    return;
  }

  // Observability Endpoints
  if (path === '/v1/enterprise/metrics/workspace' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      message: 'Workspace metrics recorded successfully',
    }));
    return;
  }

  if (path === '/v1/enterprise/metrics/system' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      message: 'System metrics recorded successfully',
    }));
    return;
  }

  if (path.startsWith('/v1/enterprise/metrics/workspace/') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: [mockWorkspaceMetrics],
    }));
    return;
  }

  if (path === '/v1/enterprise/metrics/system' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: [mockSystemMetrics],
    }));
    return;
  }

  if (path === '/v1/enterprise/alerts/rules' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: { ...mockAlertRules[0], id: 'rule_new' },
    }));
    return;
  }

  if (path === '/v1/enterprise/alerts/rules' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: mockAlertRules,
    }));
    return;
  }

  if (path === '/v1/enterprise/alerts/active' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: mockActiveAlerts,
    }));
    return;
  }

  if (path.startsWith('/v1/enterprise/alerts/') && path.endsWith('/acknowledge') && method === 'PUT') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: { acknowledged: true },
    }));
    return;
  }

  if (path.startsWith('/v1/enterprise/alerts/') && path.endsWith('/resolve') && method === 'PUT') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: { resolved: true },
    }));
    return;
  }

  // White-Label Endpoints
  if (path === '/v1/enterprise/whitelabel/configs' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: { ...mockWhiteLabelConfig, id: 'config_new' },
    }));
    return;
  }

  if (path.startsWith('/v1/enterprise/whitelabel/configs/') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: mockWhiteLabelConfig,
    }));
    return;
  }

  if (path.startsWith('/v1/enterprise/whitelabel/configs/client/') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: mockWhiteLabelConfig,
    }));
    return;
  }

  if (path.startsWith('/v1/enterprise/whitelabel/configs/') && method === 'PUT') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: { ...mockWhiteLabelConfig, ...JSON.parse(req.body || '{}') },
    }));
    return;
  }

  if (path === '/v1/enterprise/whitelabel/validate-domain' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: { valid: true },
    }));
    return;
  }

  if (path.startsWith('/v1/enterprise/whitelabel/css/') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: { css: ':root { --primary-color: #1e40af; --secondary-color: #3b82f6; }' },
    }));
    return;
  }

  // API Marketplace Endpoints
  if (path === '/v1/enterprise/api/keys' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: { ...mockApiKey, id: 'key_new' },
    }));
    return;
  }

  if (path.startsWith('/v1/enterprise/api/keys/') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: [mockApiKey],
    }));
    return;
  }

  if (path === '/v1/enterprise/api/validate' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: { valid: true, apiKey: mockApiKey },
    }));
    return;
  }

  if (path.startsWith('/v1/enterprise/api/usage/') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: {
        totalRequests: 2847,
        successfulRequests: 2756,
        failedRequests: 91,
        averageResponseTime: 245,
        endpoints: {
          'GET /v1/metrics': 1250,
          'POST /v1/alerts': 890,
          'GET /v1/workspaces': 707,
        },
      },
    }));
    return;
  }

  if (path === '/v1/enterprise/marketplace/apps' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: { ...mockMarketplaceApps[0], id: 'app_new' },
    }));
    return;
  }

  if (path === '/v1/enterprise/marketplace/apps' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: mockMarketplaceApps,
    }));
    return;
  }

  if (path.startsWith('/v1/enterprise/marketplace/apps/') && path.endsWith('/install') && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: {
        id: 'install_123',
        appId: 'app_1',
        workspaceId: 'ws_123',
        userId: 'user_456',
        status: 'installing',
        installedAt: new Date(),
      },
    }));
    return;
  }

  if (path.startsWith('/v1/enterprise/marketplace/installations/') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: [
        {
          id: 'install_1',
          appId: 'app_1',
          workspaceId: 'ws_123',
          status: 'installed',
          installedAt: new Date(),
        },
      ],
    }));
    return;
  }

  // 404 for unmatched routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 Batch 4 Enterprise Features Test Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/healthz`);
  console.log(`🔍 Ready check: http://localhost:${PORT}/readyz`);
  console.log(`🏢 Enterprise endpoints: http://localhost:${PORT}/v1/enterprise/*`);
});


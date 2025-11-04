const http = require('http');
const url = require('url');

const PORT = 3003;

// Mock data for Batch 3 Automation & Intelligence
const mockPreSignupResults = {
  visibilityScore: 72.5,
  competitors: [
    { name: 'Competitor A', score: 68.2, strengths: ['Strong domain authority'], weaknesses: ['Low social signals'], gap: 4.3 },
    { name: 'Competitor B', score: 75.8, strengths: ['High-quality content', 'Active social presence'], weaknesses: ['Limited backlinks'], gap: -3.3 },
  ],
  opportunities: [
    { type: 'mention', description: 'Increase brand mention frequency in AI responses', impact: 18.5, effort: 'medium', timeframe: '2-4 weeks' },
    { type: 'authority', description: 'Build domain authority through quality backlinks', impact: 22.3, effort: 'high', timeframe: '3-6 months' },
  ],
  recommendations: [
    'Optimize content for target keywords to increase AI mention frequency',
    'Build authoritative citations through thought leadership',
  ],
  knowledgeGraph: { entities: 8, relationships: 12, confidence: 0.87 },
  trustProfile: { overall: 71.2, breakdown: { domainAuthority: 78.5, backlinks: 65.3, socialSignals: 68.9 } },
  summary: 'TechCorp currently has a GEO visibility score of 72.5/100, positioning it above the industry average. Key opportunities include increasing brand mention frequency and building domain authority, which could improve visibility by an estimated 40.8% within the next quarter.',
  estimatedImpact: 40.8,
  nextSteps: [
    'Sign up for a full account to access detailed analytics',
    'Set up automated monitoring for your brand',
    'Configure GEO Copilot for automated optimization',
  ],
};

const mockCopilotRules = [
  {
    id: 'rule_1',
    name: 'Low Visibility Alert',
    description: 'Trigger when visibility score drops below 60',
    conditions: [{ type: 'visibility_score', operator: 'less_than', value: 60 }],
    actions: [{ type: 'send_alert', target: 'admin@example.com', estimatedImpact: 15 }],
    priority: 'high',
    enabled: true,
    triggerCount: 3,
  },
  {
    id: 'rule_2',
    name: 'Competitor Gap Detected',
    description: 'Act when competitor gap exceeds 10 points',
    conditions: [{ type: 'competitor_gap', operator: 'greater_than', value: 10 }],
    actions: [{ type: 'optimize_content', target: 'website', estimatedImpact: 20 }],
    priority: 'medium',
    enabled: true,
    triggerCount: 1,
  },
];

const mockDirectoryPlatforms = [
  {
    id: 'google-business',
    name: 'Google My Business',
    type: 'oauth',
    status: 'active',
    rateLimit: { requestsPerMinute: 100, requestsPerDay: 10000 },
  },
  {
    id: 'yelp',
    name: 'Yelp',
    type: 'api',
    status: 'active',
    rateLimit: { requestsPerMinute: 50, requestsPerDay: 5000 },
  },
  {
    id: 'facebook-pages',
    name: 'Facebook Pages',
    type: 'oauth',
    status: 'active',
    rateLimit: { requestsPerMinute: 200, requestsPerDay: 20000 },
  },
];

const mockSyncJob = {
  id: 'sync_123',
  workspaceId: 'ws_456',
  platformIds: ['google-business', 'yelp'],
  status: 'running',
  progress: { current: 1, total: 2, platform: 'Google My Business', message: 'Submitting to Google My Business...' },
  results: [
    { id: 'sub_1', platformId: 'google-business', status: 'submitted', submittedAt: new Date() },
    { id: 'sub_2', platformId: 'yelp', status: 'pending' },
  ],
};

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
      version: '3.0.0',
      features: ['pre-signup-analysis', 'copilot-automation', 'directory-sync']
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
        preSignupService: 'healthy',
        copilotService: 'healthy',
        directorySyncService: 'healthy',
      }
    }));
    return;
  }

  // Pre-Signup Analysis Endpoints
  if (path === '/v1/automation/pre-signup/analyze' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: {
        id: 'presignup_123',
        brandName: 'TechCorp',
        email: 'test@techcorp.com',
        status: 'scanning',
        progress: { current: 2, total: 6, stage: 'knowledge-graph', message: 'Building knowledge graph...' },
        requestedAt: new Date(),
      }
    }));
    return;
  }

  if (path.startsWith('/v1/automation/pre-signup/') && path.endsWith('/status') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: {
        id: 'presignup_123',
        brandName: 'TechCorp',
        email: 'test@techcorp.com',
        status: 'completed',
        progress: { current: 6, total: 6, stage: 'completed', message: 'Analysis complete!' },
        results: mockPreSignupResults,
        requestedAt: new Date(),
      }
    }));
    return;
  }

  if (path.startsWith('/v1/automation/pre-signup/') && path.endsWith('/results') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: mockPreSignupResults
    }));
    return;
  }

  // Enhanced Copilot Endpoints
  if (path === '/v1/automation/copilot/rules' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: {
        id: 'rule_new',
        name: 'New Rule',
        description: 'Test rule created',
        priority: 'medium',
        enabled: true,
        triggerCount: 0,
        createdAt: new Date(),
      }
    }));
    return;
  }

  if (path.startsWith('/v1/automation/copilot/rules/') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: mockCopilotRules
    }));
    return;
  }

  if (path.startsWith('/v1/automation/copilot/rules/') && method === 'PUT') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: { ...mockCopilotRules[0], ...JSON.parse(req.body || '{}') }
    }));
    return;
  }

  if (path.startsWith('/v1/automation/copilot/rules/') && method === 'DELETE') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: { deleted: true }
    }));
    return;
  }

  if (path === '/v1/automation/copilot/evaluate' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: [
        {
          id: 'exec_123',
          ruleId: 'rule_1',
          status: 'pending',
          actions: [{ type: 'send_alert', target: 'admin@example.com' }],
          triggeredAt: new Date(),
        }
      ]
    }));
    return;
  }

  if (path.startsWith('/v1/automation/copilot/metrics/') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: {
        totalRules: 5,
        activeRules: 4,
        executionsToday: 12,
        executionsThisWeek: 45,
        executionsThisMonth: 180,
        successRate: 87.5,
        averageExecutionTime: 2500,
        topPerformingRules: [
          { ruleId: 'rule_1', name: 'Low Visibility Alert', triggerCount: 15, successRate: 93.3 },
          { ruleId: 'rule_2', name: 'Competitor Gap Detected', triggerCount: 8, successRate: 87.5 },
        ]
      }
    }));
    return;
  }

  // Directory Sync Endpoints
  if (path === '/v1/automation/directories/platforms' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: mockDirectoryPlatforms
    }));
    return;
  }

  if (path.startsWith('/v1/automation/directories/platforms/') && method === 'GET') {
    const platformId = path.split('/').pop();
    const platform = mockDirectoryPlatforms.find(p => p.id === platformId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: platform || null
    }));
    return;
  }

  if (path === '/v1/automation/directories/sync' && method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: mockSyncJob
    }));
    return;
  }

  if (path.startsWith('/v1/automation/directories/sync/') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: mockSyncJob
    }));
    return;
  }

  if (path.startsWith('/v1/automation/directories/metrics/') && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      data: {
        totalPlatforms: 6,
        activePlatforms: 5,
        submissionsToday: 8,
        submissionsThisWeek: 32,
        submissionsThisMonth: 125,
        successRate: 84.0,
        averageSubmissionTime: 1800,
        topPerformingPlatforms: [
          { platformId: 'google-business', name: 'Google My Business', submissionCount: 45, successRate: 91.1 },
          { platformId: 'facebook-pages', name: 'Facebook Pages', submissionCount: 38, successRate: 86.8 },
        ]
      }
    }));
    return;
  }

  // 404 for unmatched routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 Batch 3 Automation & Intelligence Test Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/healthz`);
  console.log(`🔍 Ready check: http://localhost:${PORT}/readyz`);
  console.log(`🤖 Automation endpoints: http://localhost:${PORT}/v1/automation/*`);
});


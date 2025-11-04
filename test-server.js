const http = require('http');
const url = require('url');

const port = process.env.PORT || 3001;

// Simple HTTP server without external dependencies
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let responseData = {};
  
  switch (path) {
    case '/healthz':
      responseData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
      };
      break;
      
    case '/readyz':
      responseData = {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'connected',
          redis: 'connected',
          queues: 'running'
        }
      };
      break;
      
    case '/v1/admin/system':
      responseData = {
        ok: true,
        data: {
          status: 'operational',
          version: '1.0.0',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          environment: process.env.NODE_ENV || 'development',
          features: {
            multiTenancy: true,
            sse: true,
            queueManagement: true,
            rateLimiting: true,
            gdprCompliance: true
          },
          queues: {
            runPrompt: { waiting: 0, active: 0, completed: 10, failed: 0 },
            runBatch: { waiting: 0, active: 0, completed: 5, failed: 0 },
            copilotPlanner: { waiting: 0, active: 0, completed: 3, failed: 0 }
          },
          providers: {
            perplexity: { enabled: true, status: 'healthy' },
            aio: { enabled: true, status: 'healthy' },
            brave: { enabled: true, status: 'healthy' },
            openai: { enabled: true, status: 'healthy' },
            anthropic: { enabled: true, status: 'healthy' },
            gemini: { enabled: true, status: 'healthy' }
          }
        }
      };
      break;
      
    case '/v1/events/stats':
      responseData = {
        ok: true,
        data: {
          totalPools: 1,
          totalConnections: 0,
          workspaceConnections: {},
          instanceStats: {
            'api-1': {
              connections: 0,
              workspaces: 0
            }
          }
        }
      };
      break;
      
    case '/v1/admin/queues/health':
      responseData = {
        ok: true,
        data: {
          queues: [
            {
              queueName: 'runPrompt',
              status: 'healthy',
              issues: [],
              metrics: {
                waiting: 0,
                active: 0,
                completed: 10,
                failed: 0,
                delayed: 0,
                paused: false
              },
              performance: {
                avgProcessingTime: 2500,
                processingRate: 0.4,
                errorRate: 0.05,
                throughput: 2.5
              },
              lastUpdated: new Date().toISOString()
            }
          ]
        }
      };
      break;
      
    default:
      if (path.startsWith('/v1/workspaces/') && path.endsWith('/members')) {
        responseData = {
          ok: true,
          data: {
            members: [
              {
                id: 'member-1',
                workspaceId: path.split('/')[3],
                userId: 'user-1',
                role: 'OWNER',
                joinedAt: new Date().toISOString(),
                invitedBy: null
              }
            ],
            total: 1
          }
        };
      } else if (path === '/v1/test/rate-limit') {
        responseData = {
          ok: true,
          data: {
            message: 'Rate limit test passed',
            timestamp: new Date().toISOString(),
            tier: 'FREE',
            limits: {
              requestsPerHour: 100,
              scansPerDay: 10,
              members: 3,
              storageGB: 1
            }
          }
        };
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Endpoint not found'
          }
        }));
        return;
      }
  }
  
  res.writeHead(200);
  res.end(JSON.stringify(responseData));
});

server.listen(port, () => {
  console.log(`🚀 AI Visibility Platform Test Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/healthz`);
  console.log(`🔧 Admin system: http://localhost:${port}/v1/admin/system`);
  console.log(`📡 Events stats: http://localhost:${port}/v1/events/stats`);
  console.log(`⚙️  Queue health: http://localhost:${port}/v1/admin/queues/health`);
  console.log(`👥 Members: http://localhost:${port}/v1/workspaces/test-workspace/members`);
  console.log(`🚦 Rate limit test: http://localhost:${port}/v1/test/rate-limit`);
});

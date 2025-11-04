const http = require('http');
const url = require('url');

const port = process.env.PORT || 3002;

// Simple HTTP server for GEO optimization testing
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
        version: '2.0.0',
        features: ['geo-scoring', 'knowledge-graph', 'trust-signals']
      };
      break;
      
    case '/readyz':
      responseData = {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'connected',
          redis: 'connected',
          queues: 'running',
          geo_engine: 'operational'
        }
      };
      break;
      
    // GEO Scoring endpoints
    case '/v1/geo/scoring/test-brand':
      responseData = {
        ok: true,
        data: {
          overall: 78.5,
          breakdown: {
            mentions: 82.3,
            rankings: 75.1,
            citations: 71.8,
            sentiment: 85.2,
            authority: 76.4,
            freshness: 68.9
          },
          trends: {
            weekly: 5.2,
            monthly: 12.8,
            quarterly: 18.3
          },
          competitors: {
            position: 2,
            gap: 8.7,
            opportunities: 3
          },
          recommendations: [
            'Increase brand mention frequency by optimizing content for target keywords',
            'Improve search ranking by enhancing content relevance and authority',
            'Build more authoritative citations through thought leadership'
          ],
          lastUpdated: new Date().toISOString()
        }
      };
      break;
      
    case '/v1/geo/knowledge-graph/test-brand':
      responseData = {
        ok: true,
        data: {
          entities: [
            {
              id: 'brand_test-brand',
              type: 'brand',
              name: 'Test Brand',
              description: 'Primary brand entity',
              properties: { isPrimary: true, industry: 'technology' },
              confidence: 1.0,
              lastUpdated: new Date().toISOString()
            },
            {
              id: 'entity_competitor1',
              type: 'brand',
              name: 'Competitor 1',
              description: 'Main competitor',
              properties: { mentions: 5, context: 'competitive analysis' },
              confidence: 0.8,
              lastUpdated: new Date().toISOString()
            }
          ],
          relationships: [
            {
              id: 'rel_brand_test-brand_competes_with_entity_competitor1',
              source: 'brand_test-brand',
              target: 'entity_competitor1',
              type: 'competes_with',
              strength: 0.7,
              context: 'Both companies compete in the same market',
              evidence: ['Market analysis shows direct competition'],
              lastUpdated: new Date().toISOString()
            }
          ],
          metadata: {
            totalEntities: 2,
            totalRelationships: 1,
            lastUpdated: new Date().toISOString(),
            confidence: 0.9
          }
        }
      };
      break;
      
    case '/v1/geo/knowledge-graph/test-brand/analysis':
      responseData = {
        ok: true,
        data: {
          centrality: {
            brand: 0.6,
            competitors: ['Competitor 1'],
            keyEntities: [
              {
                id: 'brand_test-brand',
                type: 'brand',
                name: 'Test Brand',
                description: 'Primary brand entity',
                properties: { isPrimary: true },
                confidence: 1.0,
                lastUpdated: new Date().toISOString()
              }
            ]
          },
          clusters: [
            {
              id: 'cluster_brand',
              entities: ['brand_test-brand', 'entity_competitor1'],
              theme: 'brand entities',
              strength: 0.8
            }
          ],
          insights: [
            {
              type: 'opportunity',
              description: 'Brand has moderate centrality in the knowledge graph. Consider increasing mentions and relationships.',
              confidence: 0.7,
              actionable: true
            }
          ]
        }
      };
      break;
      
    case '/v1/geo/trust/test-brand.com':
      responseData = {
        ok: true,
        data: {
          overall: 72.3,
          breakdown: {
            domainAuthority: 78.5,
            backlinks: 71.2,
            socialSignals: 68.9,
            contentQuality: 75.8,
            userEngagement: 69.4,
            expertise: 73.1,
            freshness: 66.7
          },
          trends: {
            weekly: 3.2,
            monthly: 8.7,
            quarterly: 15.3
          },
          signals: [
            {
              id: 'da_test-brand.com_1',
              type: 'domain_authority',
              source: 'domain_analysis',
              value: 78.5,
              weight: 0.25,
              confidence: 0.9,
              metadata: { domain: 'test-brand.com', algorithm: 'simplified_da' },
              timestamp: new Date().toISOString()
            }
          ],
          lastUpdated: new Date().toISOString()
        }
      };
      break;
      
    case '/v1/geo/trust/test-brand.com/analysis':
      responseData = {
        ok: true,
        data: {
          score: 72.3,
          level: 'high',
          strengths: [
            'Strong domain authority',
            'High-quality content',
            'Strong expertise signals'
          ],
          weaknesses: [
            'Limited social media presence',
            'Outdated content'
          ],
          recommendations: [
            'Increase social media activity and engagement',
            'Regularly update content and publish fresh material'
          ],
          competitors: [
            { name: 'competitor1.com', score: 68.9, gap: 3.4 },
            { name: 'competitor2.com', score: 65.2, gap: 7.1 }
          ]
        }
      };
      break;
      
    case '/v1/geo/optimization/test-brand/recommendations':
      responseData = {
        ok: true,
        data: {
          visibilityScore: {
            overall: 78.5,
            breakdown: { mentions: 82.3, rankings: 75.1, citations: 71.8, sentiment: 85.2, authority: 76.4, freshness: 68.9 },
            trends: { weekly: 5.2, monthly: 12.8, quarterly: 18.3 },
            competitors: { position: 2, gap: 8.7, opportunities: 3 },
            recommendations: ['Increase brand mention frequency', 'Improve search ranking', 'Build more authoritative citations'],
            lastUpdated: new Date().toISOString()
          },
          knowledgeGraph: {
            totalEntities: 2,
            totalRelationships: 1,
            lastUpdated: new Date().toISOString(),
            confidence: 0.9
          },
          trustProfile: 72.3,
          recommendations: [
            'Increase brand mention frequency by optimizing content for target keywords',
            'Improve search ranking by enhancing content relevance and authority',
            'Build more authoritative citations through thought leadership and partnerships',
            'Increase social media activity and engagement',
            'Regularly update content and publish fresh material'
          ],
          priority: ['high', 'high', 'medium', 'medium', 'low'],
          estimatedImpact: [25, 22, 18, 15, 12]
        }
      };
      break;
      
    case '/v1/geo/competitors/test-brand':
      responseData = {
        ok: true,
        data: {
          brandName: 'Test Brand',
          competitors: [
            {
              name: 'Competitor 1',
              score: 87.2,
              strengths: ['High domain authority', 'Strong social presence'],
              weaknesses: ['Limited content freshness']
            },
            {
              name: 'Competitor 2',
              score: 78.5,
              strengths: ['Good content quality', 'Strong expertise'],
              weaknesses: ['Low social signals']
            },
            {
              name: 'Competitor 3',
              score: 65.8,
              strengths: ['Fresh content'],
              weaknesses: ['Low authority', 'Poor rankings']
            }
          ],
          marketPosition: 2,
          opportunities: [
            'Close the gap with Competitor 1 (87.2 score)',
            'Focus on underserved market segments',
            'Leverage emerging AI platforms'
          ]
        }
      };
      break;
      
    default:
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
  
  res.writeHead(200);
  res.end(JSON.stringify(responseData));
});

server.listen(port, () => {
  console.log(`🚀 AI Visibility Platform GEO Engine Test Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/healthz`);
  console.log(`🔧 Ready check: http://localhost:${port}/readyz`);
  console.log(`📈 GEO Scoring: http://localhost:${port}/v1/geo/scoring/test-brand`);
  console.log(`🧠 Knowledge Graph: http://localhost:${port}/v1/geo/knowledge-graph/test-brand`);
  console.log(`🔒 Trust Analysis: http://localhost:${port}/v1/geo/trust/test-brand.com`);
  console.log(`💡 Optimization: http://localhost:${port}/v1/geo/optimization/test-brand/recommendations`);
  console.log(`🏆 Competitors: http://localhost:${port}/v1/geo/competitors/test-brand`);
});


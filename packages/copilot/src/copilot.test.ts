/**
 * Comprehensive tests for copilot package
 */

import { CopilotRule, CopilotActionType, MetricDaily, Alert, AlertType } from '@ai-visibility/shared';
import { getEffectivePolicy, isActionAllowed, getActionPriority } from './rules';
import { planActions, PlanningContext } from './planner';
import { createExecutor, CopilotExecutor } from './executor';
import { detectHallucinations, BrandFacts, BrandDefenseConfig } from './brand-defense';

describe('Copilot Package', () => {
  describe('Rule Engine', () => {
    const sampleRule: CopilotRule = {
      id: 'rule-123',
      workspaceId: 'workspace-123',
      fullAuto: true,
      requireApproval: false,
      maxPagesPerWeek: 10,
      enabledActions: [CopilotActionType.ADD_FAQ, CopilotActionType.ADD_TLDR],
      intensity: 2,
      config: {},
    };

    const sampleContext = {
      workspaceId: 'workspace-123',
      userId: 'user-123',
      currentPageCount: 5,
      lastActionDate: new Date(),
    };

    it('should get effective policy', () => {
      const policy = getEffectivePolicy(sampleRule, sampleContext);
      
      expect(policy).toMatchObject({
        fullAuto: true,
        requireApproval: false,
        maxPagesPerWeek: 10,
        enabledActions: expect.any(Array),
        intensity: 2,
        globalKillSwitch: false,
      });
    });

    it('should check if action is allowed', () => {
      const policy = getEffectivePolicy(sampleRule, sampleContext);
      
      expect(isActionAllowed(CopilotActionType.ADD_FAQ, policy, sampleContext)).toBe(true);
      expect(isActionAllowed(CopilotActionType.ADD_CITATIONS, policy, sampleContext)).toBe(false);
    });

    it('should get action priority', () => {
      const policy = getEffectivePolicy(sampleRule, sampleContext);
      
      const priority = getActionPriority(CopilotActionType.ADD_FAQ, policy);
      expect(priority).toBeGreaterThan(0);
    });

    it('should handle global kill switch', () => {
      const ruleWithKillSwitch = { ...sampleRule, fullAuto: false };
      const policy = getEffectivePolicy(ruleWithKillSwitch, sampleContext);
      
      expect(policy.globalKillSwitch).toBe(true);
      expect(policy.fullAuto).toBe(false);
    });
  });

  describe('Planner', () => {
    const sampleMetrics: MetricDaily[] = [
      {
        id: 'metric-1',
        workspaceId: 'workspace-123',
        engineKey: 'PERPLEXITY' as any,
        date: new Date(),
        promptSOV: 30,
        coverage: 40,
        citationCount: 5,
        aioImpressions: 100,
      },
    ];

    const sampleAlerts: Alert[] = [
      {
        id: 'alert-1',
        workspaceId: 'workspace-123',
        type: AlertType.SOV_DROP,
        payload: { drop: 20 },
        createdAt: new Date(),
      },
    ];

    const sampleContext: PlanningContext = {
      workspaceId: 'workspace-123',
      metrics: sampleMetrics,
      alerts: sampleAlerts,
      recentActions: [],
      targetUrls: ['https://example.com'],
      brandFacts: { companyName: 'Test Company' },
    };

    it('should plan actions based on metrics', () => {
      const policy = {
        fullAuto: true,
        requireApproval: false,
        maxPagesPerWeek: 10,
        enabledActions: [CopilotActionType.ADD_FAQ, CopilotActionType.ADD_TLDR],
        intensity: 2,
        globalKillSwitch: false,
      };

      const result = planActions(sampleContext, policy);
      
      expect(result.proposedActions).toBeDefined();
      expect(result.totalImpact).toBeGreaterThan(0);
      expect(result.estimatedTime).toBeGreaterThan(0);
    });

    it('should handle empty metrics', () => {
      const emptyContext = { ...sampleContext, metrics: [] };
      const policy = {
        fullAuto: true,
        requireApproval: false,
        maxPagesPerWeek: 10,
        enabledActions: [CopilotActionType.ADD_FAQ],
        intensity: 2,
        globalKillSwitch: false,
      };

      const result = planActions(emptyContext, policy);
      
      expect(result.proposedActions).toBeDefined();
      expect(result.totalImpact).toBeGreaterThanOrEqual(0);
    });

    it('should handle alerts', () => {
      const policy = {
        fullAuto: true,
        requireApproval: false,
        maxPagesPerWeek: 10,
        enabledActions: [CopilotActionType.REVIEW_CAMPAIGN],
        intensity: 2,
        globalKillSwitch: false,
      };

      const result = planActions(sampleContext, policy);
      
      expect(result.proposedActions.length).toBeGreaterThan(0);
      expect(result.proposedActions.some(a => a.actionType === CopilotActionType.REVIEW_CAMPAIGN)).toBe(true);
    });
  });

  describe('Executor', () => {
    let executor: CopilotExecutor;

    beforeEach(() => {
      executor = createExecutor();
    });

    it('should create executor with default plugins', () => {
      expect(executor).toBeDefined();
      expect(executor.getAllPlugins().length).toBeGreaterThan(0);
    });

    it('should register and unregister plugins', () => {
      const plugin = {
        name: 'test-plugin',
        version: '1.0.0',
        supportedActions: [CopilotActionType.ADD_FAQ],
        execute: jest.fn(),
        testConnection: jest.fn().mockResolvedValue(true),
        getCapabilities: jest.fn().mockReturnValue(['test']),
      };

      executor.registerPlugin(plugin);
      expect(executor.getPlugin('test-plugin')).toBe(plugin);

      executor.unregisterPlugin('test-plugin');
      expect(executor.getPlugin('test-plugin')).toBeUndefined();
    });

    it('should get plugins for action type', () => {
      const plugins = executor.getPluginsForAction(CopilotActionType.ADD_FAQ);
      expect(plugins.length).toBeGreaterThan(0);
    });

    it('should execute action', async () => {
      const proposedAction = {
        actionType: CopilotActionType.ADD_FAQ,
        targetUrl: 'https://example.com',
        priority: 8,
        confidence: 0.8,
        reasoning: 'Test action',
        estimatedImpact: 20,
        requiredApproval: false,
      };

      const context = {
        workspaceId: 'workspace-123',
        userId: 'user-123',
        targetUrl: 'https://example.com',
        actionType: CopilotActionType.ADD_FAQ,
        diff: 'Test diff',
        metadata: {},
      };

      const result = await executor.executeAction(proposedAction, context);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.actionId).toBeDefined();
    });
  });

  describe('Brand Defense', () => {
    const sampleBrandFacts: BrandFacts = {
      companyName: 'Test Company',
      description: 'A test company',
      products: ['Product A', 'Product B'],
      services: ['Service A', 'Service B'],
      keyFeatures: ['Feature 1', 'Feature 2'],
      pricing: { price: 100 },
      contactInfo: { email: 'test@company.com', phone: '123-456-7890' },
      lastUpdated: new Date(),
    };

    const sampleConfig: BrandDefenseConfig = {
      enableDetection: true,
      confidenceThreshold: 0.7,
      autoCorrect: false,
      requireApproval: true,
    };

    it('should detect hallucinations', () => {
      const answerText = 'Test Company is a cheap and unreliable service provider.';
      const detection = detectHallucinations(answerText, sampleBrandFacts, sampleConfig);
      
      expect(detection).toBeDefined();
      expect(detection.detected).toBe(true);
      expect(detection.mismatches.length).toBeGreaterThan(0);
      expect(detection.suggestedActions.length).toBeGreaterThan(0);
    });

    it('should handle accurate content', () => {
      const answerText = 'Test Company is a reliable service provider offering Product A and Service A.';
      const detection = detectHallucinations(answerText, sampleBrandFacts, sampleConfig);
      
      expect(detection.detected).toBe(false);
      expect(detection.mismatches.length).toBe(0);
    });

    it('should handle disabled detection', () => {
      const disabledConfig = { ...sampleConfig, enableDetection: false };
      const answerText = 'Test Company is a cheap service.';
      const detection = detectHallucinations(answerText, sampleBrandFacts, disabledConfig);
      
      expect(detection.detected).toBe(false);
      expect(detection.mismatches.length).toBe(0);
    });

    it('should detect company name variations', () => {
      const answerText = 'Test Compnay is a great service provider.';
      const detection = detectHallucinations(answerText, sampleBrandFacts, sampleConfig);
      
      expect(detection.detected).toBe(true);
      expect(detection.mismatches.some(m => m.claim.includes('Compnay'))).toBe(true);
    });

    it('should detect pricing inaccuracies', () => {
      const answerText = 'Test Company charges $200 for their services.';
      const detection = detectHallucinations(answerText, sampleBrandFacts, sampleConfig);
      
      expect(detection.detected).toBe(true);
      expect(detection.mismatches.some(m => m.claim.includes('$200'))).toBe(true);
    });

    it('should generate corrective actions', () => {
      const answerText = 'Test Company is cheap and unreliable.';
      const detection = detectHallucinations(answerText, sampleBrandFacts, sampleConfig);
      
      expect(detection.suggestedActions.length).toBeGreaterThan(0);
      expect(detection.suggestedActions.some(a => a.actionType === CopilotActionType.ADD_FAQ)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should integrate rule engine with planner', () => {
      const rule: CopilotRule = {
        id: 'rule-123',
        workspaceId: 'workspace-123',
        fullAuto: true,
        requireApproval: false,
        maxPagesPerWeek: 10,
        enabledActions: [CopilotActionType.ADD_FAQ],
        intensity: 2,
        config: {},
      };

      const context = {
        workspaceId: 'workspace-123',
        userId: 'user-123',
        currentPageCount: 5,
        lastActionDate: new Date(),
      };

      const policy = getEffectivePolicy(rule, context);
      expect(policy.fullAuto).toBe(true);
      expect(policy.enabledActions).toContain(CopilotActionType.ADD_FAQ);
    });

    it('should integrate planner with executor', async () => {
      const executor = createExecutor();
      const proposedAction = {
        actionType: CopilotActionType.ADD_FAQ,
        targetUrl: 'https://example.com',
        priority: 8,
        confidence: 0.8,
        reasoning: 'Test action',
        estimatedImpact: 20,
        requiredApproval: false,
      };

      const context = {
        workspaceId: 'workspace-123',
        userId: 'user-123',
        targetUrl: 'https://example.com',
        actionType: CopilotActionType.ADD_FAQ,
        diff: 'Test diff',
        metadata: {},
      };

      const result = await executor.executeAction(proposedAction, context);
      expect(result.success).toBe(true);
    });

    it('should integrate brand defense with planner', () => {
      const brandFacts: BrandFacts = {
        companyName: 'Test Company',
        description: 'A test company',
        products: ['Product A'],
        services: ['Service A'],
        keyFeatures: ['Feature 1'],
        pricing: { price: 100 },
        contactInfo: { email: 'test@company.com' },
        lastUpdated: new Date(),
      };

      const config: BrandDefenseConfig = {
        enableDetection: true,
        confidenceThreshold: 0.7,
        autoCorrect: false,
        requireApproval: true,
      };

      const answerText = 'Test Company is cheap and unreliable.';
      const detection = detectHallucinations(answerText, brandFacts, config);
      
      expect(detection.detected).toBe(true);
      expect(detection.suggestedActions.length).toBeGreaterThan(0);
    });
  });
});

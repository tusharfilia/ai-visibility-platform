/**
 * Copilot planner
 * Analyzes metrics and proposes actions
 */

import { CopilotAction, CopilotActionType, MetricDaily, Alert } from '@ai-visibility/shared';
import { EffectivePolicy } from './rules';

export interface PlanningContext {
  workspaceId: string;
  metrics: MetricDaily[];
  alerts: Alert[];
  recentActions: CopilotAction[];
  targetUrls: string[];
  brandFacts: Record<string, any>;
}

export interface ProposedAction {
  actionType: CopilotActionType;
  targetUrl: string;
  priority: number;
  confidence: number;
  reasoning: string;
  estimatedImpact: number;
  requiredApproval: boolean;
}

export interface PlanningResult {
  proposedActions: ProposedAction[];
  totalImpact: number;
  requiresApproval: boolean;
  estimatedTime: number; // minutes
}

/**
 * Plan actions based on metrics and context
 */
export function planActions(
  context: PlanningContext,
  policy: EffectivePolicy
): PlanningResult {
  const proposedActions: ProposedAction[] = [];
  
  // Analyze metrics for opportunities
  const metricAnalysis = analyzeMetrics(context.metrics);
  
  // Check for alerts that need attention
  const alertActions = analyzeAlerts(context.alerts, policy);
  
  // Analyze recent actions for patterns
  const patternActions = analyzeActionPatterns(context.recentActions, policy);
  
  // Analyze brand facts for accuracy
  const brandActions = analyzeBrandFacts(context.brandFacts, policy);
  
  // Combine all proposed actions
  proposedActions.push(...metricAnalysis);
  proposedActions.push(...alertActions);
  proposedActions.push(...patternActions);
  proposedActions.push(...brandActions);
  
  // Sort by priority and confidence
  proposedActions.sort((a, b) => {
    const priorityDiff = b.priority - a.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return b.confidence - a.confidence;
  });
  
  // Filter based on policy limits
  const filteredActions = filterActionsByPolicy(proposedActions, policy);
  
  // Calculate total impact and time
  const totalImpact = filteredActions.reduce((sum, action) => sum + action.estimatedImpact, 0);
  const estimatedTime = filteredActions.length * 15; // 15 minutes per action
  const requiresApproval = filteredActions.some(action => action.requiredApproval);
  
  return {
    proposedActions: filteredActions,
    totalImpact,
    requiresApproval,
    estimatedTime,
  };
}

/**
 * Analyze metrics for optimization opportunities
 */
function analyzeMetrics(metrics: MetricDaily[]): ProposedAction[] {
  const actions: ProposedAction[] = [];
  
  if (metrics.length === 0) return actions;
  
  // Calculate average SOV
  const avgSOV = metrics.reduce((sum, metric) => sum + metric.promptSOV, 0) / metrics.length;
  
  // Calculate average coverage
  const avgCoverage = metrics.reduce((sum, metric) => sum + metric.coverage, 0) / metrics.length;
  
  // Calculate citation velocity
  const totalCitations = metrics.reduce((sum, metric) => sum + metric.citationCount, 0);
  const citationVelocity = totalCitations / metrics.length;
  
  // Propose actions based on metrics
  if (avgSOV < 50) {
    actions.push({
      actionType: CopilotActionType.ADD_FAQ,
      targetUrl: 'https://example.com/faq',
      priority: 8,
      confidence: 0.8,
      reasoning: `Low SOV (${avgSOV.toFixed(1)}%) - adding FAQ content to improve visibility`,
      estimatedImpact: 20,
      requiredApproval: false,
    });
  }
  
  if (avgCoverage < 60) {
    actions.push({
      actionType: CopilotActionType.ADD_CITATIONS,
      targetUrl: 'https://example.com/content',
      priority: 7,
      confidence: 0.7,
      reasoning: `Low coverage (${avgCoverage.toFixed(1)}%) - adding citations to improve credibility`,
      estimatedImpact: 15,
      requiredApproval: false,
    });
  }
  
  if (citationVelocity < 5) {
    actions.push({
      actionType: CopilotActionType.ADD_TLDR,
      targetUrl: 'https://example.com/landing',
      priority: 6,
      confidence: 0.6,
      reasoning: `Low citation velocity (${citationVelocity.toFixed(1)}) - adding TL;DR to improve engagement`,
      estimatedImpact: 10,
      requiredApproval: false,
    });
  }
  
  return actions;
}

/**
 * Analyze alerts for urgent actions
 */
function analyzeAlerts(alerts: Alert[], policy: EffectivePolicy): ProposedAction[] {
  const actions: ProposedAction[] = [];
  
  for (const alert of alerts) {
    if (alert.resolvedAt) continue; // Skip resolved alerts
    
    switch (alert.type) {
      case 'SOV_DROP':
        actions.push({
          actionType: CopilotActionType.REVIEW_CAMPAIGN,
          targetUrl: 'https://example.com/campaign',
          priority: 9,
          confidence: 0.9,
          reasoning: 'SOV drop detected - reviewing campaign strategy',
          estimatedImpact: 25,
          requiredApproval: true,
        });
        break;
        
      case 'ENGINE_LOSS':
        actions.push({
          actionType: CopilotActionType.FIX_SCHEMA,
          targetUrl: 'https://example.com/schema',
          priority: 8,
          confidence: 0.8,
          reasoning: 'Engine loss detected - fixing schema markup',
          estimatedImpact: 20,
          requiredApproval: false,
        });
        break;
        
      case 'COMPETITOR_OVERTAKE':
        actions.push({
          actionType: CopilotActionType.ADD_FAQ,
          targetUrl: 'https://example.com/competitor-analysis',
          priority: 7,
          confidence: 0.7,
          reasoning: 'Competitor overtake detected - adding competitive FAQ',
          estimatedImpact: 15,
          requiredApproval: false,
        });
        break;
        
      case 'HALLUCINATION':
        actions.push({
          actionType: CopilotActionType.CORRECT_HALLUCINATION,
          targetUrl: 'https://example.com/fact-check',
          priority: 9,
          confidence: 0.95,
          reasoning: 'Hallucination detected - submitting correction to AI platform',
          estimatedImpact: 30,
          requiredApproval: true,
        });
        break;
    }
  }
  
  return actions;
}

/**
 * Analyze recent actions for patterns
 */
function analyzeActionPatterns(recentActions: CopilotAction[], policy: EffectivePolicy): ProposedAction[] {
  const actions: ProposedAction[] = [];
  
  if (recentActions.length === 0) return actions;
  
  // Count action types
  const actionCounts = recentActions.reduce((counts, action) => {
    counts[action.actionType] = (counts[action.actionType] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);
  
  // Find underutilized action types
  const totalActions = recentActions.length;
  const threshold = totalActions * 0.2; // 20% threshold
  
  for (const actionType of Object.keys(actionCounts)) {
    if (actionCounts[actionType] < threshold) {
      actions.push({
        actionType: actionType as CopilotActionType,
        targetUrl: 'https://example.com/optimization',
        priority: 5,
        confidence: 0.6,
        reasoning: `Underutilized action type (${actionType}) - increasing usage`,
        estimatedImpact: 10,
        requiredApproval: false,
      });
    }
  }
  
  return actions;
}

/**
 * Analyze brand facts for accuracy
 */
function analyzeBrandFacts(brandFacts: Record<string, any>, policy: EffectivePolicy): ProposedAction[] {
  const actions: ProposedAction[] = [];
  
  if (Object.keys(brandFacts).length === 0) return actions;
  
  // Check for missing or outdated facts
  const requiredFacts = ['companyName', 'description', 'products', 'services'];
  const missingFacts = requiredFacts.filter(fact => !brandFacts[fact]);
  
  if (missingFacts.length > 0) {
    actions.push({
      actionType: CopilotActionType.ADD_FAQ,
      targetUrl: 'https://example.com/about',
      priority: 6,
      confidence: 0.7,
      reasoning: `Missing brand facts: ${missingFacts.join(', ')} - adding FAQ content`,
      estimatedImpact: 15,
      requiredApproval: false,
    });
  }
  
  // Check for outdated facts
  const lastUpdated = brandFacts.lastUpdated;
  if (lastUpdated && new Date(lastUpdated) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)) { // 90 days
    actions.push({
      actionType: CopilotActionType.REVIEW_CAMPAIGN,
      targetUrl: 'https://example.com/brand-review',
      priority: 7,
      confidence: 0.8,
      reasoning: 'Brand facts are outdated - reviewing and updating',
      estimatedImpact: 20,
      requiredApproval: true,
    });
  }
  
  return actions;
}

/**
 * Filter actions based on policy
 */
function filterActionsByPolicy(actions: ProposedAction[], policy: EffectivePolicy): ProposedAction[] {
  return actions.filter(action => {
    // Check if action type is enabled
    if (!policy.enabledActions.includes(action.actionType)) {
      return false;
    }
    
    // Check intensity requirements
    if (policy.intensity === 1 && action.priority < 7) {
      return false; // Only high priority actions for low intensity
    }
    
    if (policy.intensity === 3 && action.priority < 5) {
      return false; // Only medium+ priority actions for high intensity
    }
    
    return true;
  });
}

/**
 * Get action impact score
 */
export function getActionImpactScore(action: ProposedAction): number {
  return action.priority * action.confidence * action.estimatedImpact;
}

/**
 * Get planning summary
 */
export function getPlanningSummary(result: PlanningResult): string {
  const actionCount = result.proposedActions.length;
  const highPriorityCount = result.proposedActions.filter(a => a.priority >= 8).length;
  const approvalCount = result.proposedActions.filter(a => a.requiredApproval).length;
  
  return `Planned ${actionCount} actions (${highPriorityCount} high priority, ${approvalCount} requiring approval). Estimated impact: ${result.totalImpact.toFixed(1)}, Time: ${result.estimatedTime}min`;
}

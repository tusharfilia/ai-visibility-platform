/**
 * Copilot rule engine
 * Manages workspace rules and feature flag integration
 */

import { CopilotRule, CopilotActionType } from '@ai-visibility/shared';
import { getFeatureFlags } from '@ai-visibility/shared';

export interface EffectivePolicy {
  fullAuto: boolean;
  requireApproval: boolean;
  maxPagesPerWeek: number;
  enabledActions: CopilotActionType[];
  intensity: number;
  globalKillSwitch: boolean;
}

export interface RuleContext {
  workspaceId: string;
  userId?: string;
  currentPageCount: number;
  lastActionDate?: Date;
}

/**
 * Get effective policy for a workspace
 */
export function getEffectivePolicy(
  rule: CopilotRule,
  context: RuleContext
): EffectivePolicy {
  const flags = getFeatureFlags();
  
  // Check global kill switch
  const globalKillSwitch = !flags.fullAutoDefault && !flags.brandDefenseEnabled;
  
  // Determine if full auto is enabled
  const fullAuto = rule.fullAuto && !globalKillSwitch;
  
  // Determine if approval is required
  const requireApproval = rule.requireApproval || globalKillSwitch;
  
  // Get enabled actions (intersection of rule actions and feature flags)
  const enabledActions = getEnabledActions(rule.enabledActions, flags);
  
  return {
    fullAuto,
    requireApproval,
    maxPagesPerWeek: rule.maxPagesPerWeek,
    enabledActions,
    intensity: rule.intensity,
    globalKillSwitch,
  };
}

/**
 * Get enabled actions based on feature flags
 */
function getEnabledActions(
  ruleActions: string[],
  flags: any
): CopilotActionType[] {
  const enabledActions: CopilotActionType[] = [];
  
  for (const action of ruleActions) {
    if (isActionEnabled(action, flags)) {
      enabledActions.push(action as CopilotActionType);
    }
  }
  
  return enabledActions;
}

/**
 * Check if an action is enabled based on feature flags
 */
function isActionEnabled(action: string, flags: any): boolean {
  switch (action) {
    case CopilotActionType.ADD_FAQ:
      return flags.brandDefenseEnabled;
    case CopilotActionType.ADD_TLDR:
      return flags.brandDefenseEnabled;
    case CopilotActionType.ADD_CITATIONS:
      return flags.brandDefenseEnabled;
    case CopilotActionType.FIX_SCHEMA:
      return flags.brandDefenseEnabled;
    case CopilotActionType.REVIEW_CAMPAIGN:
      return flags.fullAutoDefault;
    case CopilotActionType.CORRECT_HALLUCINATION:
      return flags.brandDefenseEnabled; // Hallucination correction is part of brand defense
    default:
      return false;
  }
}

/**
 * Validate rule configuration
 */
export function validateRule(rule: Partial<CopilotRule>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (rule.maxPagesPerWeek !== undefined && (rule.maxPagesPerWeek < 0 || rule.maxPagesPerWeek > 100)) {
    errors.push('maxPagesPerWeek must be between 0 and 100');
  }
  
  if (rule.intensity !== undefined && (rule.intensity < 1 || rule.intensity > 3)) {
    errors.push('intensity must be between 1 and 3');
  }
  
  if (rule.enabledActions !== undefined && !Array.isArray(rule.enabledActions)) {
    errors.push('enabledActions must be an array');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if action is allowed based on policy
 */
export function isActionAllowed(
  action: CopilotActionType,
  policy: EffectivePolicy,
  context: RuleContext
): boolean {
  // Check if action is enabled
  if (!policy.enabledActions.includes(action)) {
    return false;
  }
  
  // Check global kill switch
  if (policy.globalKillSwitch) {
    return false;
  }
  
  // Check page limit
  if (context.currentPageCount >= policy.maxPagesPerWeek) {
    return false;
  }
  
  // Check if approval is required
  if (policy.requireApproval && !policy.fullAuto) {
    return false; // Action needs approval
  }
  
  return true;
}

/**
 * Get action priority based on policy
 */
export function getActionPriority(
  action: CopilotActionType,
  policy: EffectivePolicy
): number {
  const basePriorities = {
    [CopilotActionType.ADD_FAQ]: 1,
    [CopilotActionType.ADD_TLDR]: 2,
    [CopilotActionType.ADD_CITATIONS]: 3,
    [CopilotActionType.FIX_SCHEMA]: 4,
    [CopilotActionType.REVIEW_CAMPAIGN]: 5,
    [CopilotActionType.CORRECT_HALLUCINATION]: 1, // High priority - critical for brand accuracy
  } as Record<CopilotActionType, number>;
  
  let priority = basePriorities[action] ?? 10; // Default to low priority if not found
  
  // Adjust priority based on intensity
  if (policy.intensity === 1) {
    priority += 2; // Lower priority for low intensity
  } else if (policy.intensity === 3) {
    priority -= 1; // Higher priority for high intensity
  }
  
  return priority;
}

/**
 * Check if workspace has exceeded limits
 */
export function hasExceededLimits(
  policy: EffectivePolicy,
  context: RuleContext
): boolean {
  return context.currentPageCount >= policy.maxPagesPerWeek;
}

/**
 * Get remaining actions for the week
 */
export function getRemainingActions(
  policy: EffectivePolicy,
  context: RuleContext
): number {
  return Math.max(0, policy.maxPagesPerWeek - context.currentPageCount);
}

/**
 * Check if action requires approval
 */
export function requiresApproval(
  action: CopilotActionType,
  policy: EffectivePolicy
): boolean {
  return policy.requireApproval && !policy.fullAuto;
}

/**
 * Get action configuration
 */
export function getActionConfig(
  action: CopilotActionType,
  policy: EffectivePolicy
): Record<string, any> {
  const baseConfig = {
    intensity: policy.intensity,
    fullAuto: policy.fullAuto,
    requireApproval: policy.requireApproval,
  };
  
  switch (action) {
    case CopilotActionType.ADD_FAQ:
      return {
        ...baseConfig,
        maxQuestions: 5,
        minConfidence: 0.7,
      };
    case CopilotActionType.ADD_TLDR:
      return {
        ...baseConfig,
        maxLength: 200,
        minConfidence: 0.8,
      };
    case CopilotActionType.ADD_CITATIONS:
      return {
        ...baseConfig,
        maxCitations: 10,
        minConfidence: 0.6,
      };
    case CopilotActionType.FIX_SCHEMA:
      return {
        ...baseConfig,
        schemaTypes: ['Article', 'FAQPage', 'Organization'],
        minConfidence: 0.9,
      };
    case CopilotActionType.REVIEW_CAMPAIGN:
      return {
        ...baseConfig,
        reviewPeriod: 7, // days
        minConfidence: 0.8,
      };
    case CopilotActionType.CORRECT_HALLUCINATION:
      return {
        ...baseConfig,
        maxCorrections: 5,
        minConfidence: 0.95, // Very high confidence required for corrections
        severity: 'high', // Always high priority for brand accuracy
      };
    default:
      return baseConfig;
  }
}

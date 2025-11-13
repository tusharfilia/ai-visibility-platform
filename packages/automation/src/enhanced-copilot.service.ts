import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { createRedisClient } from '@ai-visibility/shared';

export interface CopilotRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  actions: CopilotAction[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  workspaceId: string;
  createdBy: string;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface RuleCondition {
  type: 'visibility_score' | 'mention_frequency' | 'ranking_position' | 'sentiment_score' | 'competitor_gap' | 'trust_score' | 'opportunity_detected';
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains';
  value: any;
  threshold?: number;
}

export interface CopilotAction {
  id: string;
  type: 'optimize_content' | 'build_backlinks' | 'improve_sentiment' | 'enhance_authority' | 'update_knowledge_graph' | 'submit_correction' | 'schedule_report' | 'send_alert';
  target: string;
  parameters: Record<string, any>;
  estimatedImpact: number;
  estimatedEffort: 'low' | 'medium' | 'high';
  requiresApproval: boolean;
  autoExecute: boolean;
}

export interface CopilotExecution {
  id: string;
  ruleId: string;
  workspaceId: string;
  triggeredBy: string;
  triggeredAt: Date;
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'rejected';
  actions: CopilotAction[];
  results: ActionResult[];
  progress: {
    current: number;
    total: number;
    stage: string;
    message: string;
  };
  error?: string;
  completedAt?: Date;
}

export interface ActionResult {
  actionId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  executedAt?: Date;
  duration?: number;
}

export interface CopilotMetrics {
  totalRules: number;
  activeRules: number;
  executionsToday: number;
  executionsThisWeek: number;
  executionsThisMonth: number;
  successRate: number;
  averageExecutionTime: number;
  topPerformingRules: Array<{
    ruleId: string;
    name: string;
    triggerCount: number;
    successRate: number;
  }>;
}

@Injectable()
export class EnhancedCopilotService {
  private redis: Redis;
  private executionQueue: Queue;
  private rulesCache: Map<string, CopilotRule[]> = new Map();

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.redis = createRedisClient('EnhancedCopilotService');
    this.executionQueue = new Queue('copilot-execution', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 10,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });
  }

  /**
   * Create a new Copilot rule
   */
  async createRule(
    workspaceId: string,
    userId: string,
    ruleData: Omit<CopilotRule, 'id' | 'workspaceId' | 'createdBy' | 'createdAt' | 'triggerCount'>
  ): Promise<CopilotRule> {
    const rule: CopilotRule = {
      ...ruleData,
      id: this.generateRuleId(),
      workspaceId,
      createdBy: userId,
      createdAt: new Date(),
      triggerCount: 0,
    };

    // Store rule in Redis
    await this.redis.hset(
      `copilot:rules:${workspaceId}`,
      rule.id,
      JSON.stringify(rule)
    );

    // Update cache
    await this.updateRulesCache(workspaceId);

    // Emit event
    this.eventEmitter.emit('copilot.rule.created', {
      workspaceId,
      ruleId: rule.id,
      userId,
    });

    return rule;
  }

  /**
   * Get all rules for a workspace
   */
  async getRules(workspaceId: string): Promise<CopilotRule[]> {
    const cached = this.rulesCache.get(workspaceId);
    if (cached) return cached;

    const rulesData = await this.redis.hgetall(`copilot:rules:${workspaceId}`);
    const rules = Object.values(rulesData).map((data: string) => JSON.parse(data));
    
    this.rulesCache.set(workspaceId, rules);
    return rules;
  }

  /**
   * Update a rule
   */
  async updateRule(
    workspaceId: string,
    ruleId: string,
    updates: Partial<CopilotRule>
  ): Promise<CopilotRule | null> {
    const ruleData = await this.redis.hget(`copilot:rules:${workspaceId}`, ruleId);
    if (!ruleData) return null;

    const rule = JSON.parse(ruleData);
    const updatedRule = { ...rule, ...updates };

    await this.redis.hset(
      `copilot:rules:${workspaceId}`,
      ruleId,
      JSON.stringify(updatedRule)
    );

    await this.updateRulesCache(workspaceId);

    this.eventEmitter.emit('copilot.rule.updated', {
      workspaceId,
      ruleId,
      updates,
    });

    return updatedRule;
  }

  /**
   * Delete a rule
   */
  async deleteRule(workspaceId: string, ruleId: string): Promise<boolean> {
    const deleted = await this.redis.hdel(`copilot:rules:${workspaceId}`, ruleId);
    
    if (deleted > 0) {
      await this.updateRulesCache(workspaceId);
      
      this.eventEmitter.emit('copilot.rule.deleted', {
        workspaceId,
        ruleId,
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Evaluate rules against current data
   */
  async evaluateRules(
    workspaceId: string,
    context: {
      visibilityScore?: number;
      mentionFrequency?: number;
      rankingPosition?: number;
      sentimentScore?: number;
      competitorGap?: number;
      trustScore?: number;
      opportunities?: any[];
    }
  ): Promise<CopilotExecution[]> {
    const rules = await this.getRules(workspaceId);
    const triggeredRules = rules.filter(rule => 
      rule.enabled && this.evaluateRuleConditions(rule.conditions, context)
    );

    const executions: CopilotExecution[] = [];

    for (const rule of triggeredRules) {
      const execution = await this.createExecution(workspaceId, rule, context);
      executions.push(execution);

      // Update rule trigger count
      await this.updateRule(workspaceId, rule.id, {
        lastTriggered: new Date(),
        triggerCount: rule.triggerCount + 1,
      });
    }

    return executions;
  }

  /**
   * Execute a Copilot action
   */
  async executeAction(
    executionId: string,
    action: CopilotAction,
    context: any
  ): Promise<ActionResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Executing Copilot action: ${action.type}`);

      let result: any;

      switch (action.type) {
        case 'optimize_content':
          result = await this.executeContentOptimization(action, context);
          break;
        case 'build_backlinks':
          result = await this.executeBacklinkBuilding(action, context);
          break;
        case 'improve_sentiment':
          result = await this.executeSentimentImprovement(action, context);
          break;
        case 'enhance_authority':
          result = await this.executeAuthorityEnhancement(action, context);
          break;
        case 'update_knowledge_graph':
          result = await this.executeKnowledgeGraphUpdate(action, context);
          break;
        case 'submit_correction':
          result = await this.executeCorrectionSubmission(action, context);
          break;
        case 'schedule_report':
          result = await this.executeReportScheduling(action, context);
          break;
        case 'send_alert':
          result = await this.executeAlertSending(action, context);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      const duration = Date.now() - startTime;

      return {
        actionId: action.id,
        status: 'completed',
        result,
        executedAt: new Date(),
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        actionId: action.id,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        executedAt: new Date(),
        duration,
      };
    }
  }

  /**
   * Get Copilot metrics for a workspace
   */
  async getMetrics(workspaceId: string): Promise<CopilotMetrics> {
    const rules = await this.getRules(workspaceId);
    const executions = await this.getExecutions(workspaceId);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const executionsToday = executions.filter(e => e.triggeredAt >= today).length;
    const executionsThisWeek = executions.filter(e => e.triggeredAt >= weekAgo).length;
    const executionsThisMonth = executions.filter(e => e.triggeredAt >= monthAgo).length;

    const completedExecutions = executions.filter(e => e.status === 'completed');
    const successRate = executions.length > 0 
      ? (completedExecutions.length / executions.length) * 100 
      : 0;

    const averageExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => {
          const duration = e.completedAt ? e.completedAt.getTime() - e.triggeredAt.getTime() : 0;
          return sum + duration;
        }, 0) / completedExecutions.length
      : 0;

    const topPerformingRules = rules
      .filter(rule => rule.triggerCount > 0)
      .map(rule => {
        const ruleExecutions = executions.filter(e => e.ruleId === rule.id);
        const successfulExecutions = ruleExecutions.filter(e => e.status === 'completed');
        const ruleSuccessRate = ruleExecutions.length > 0 
          ? (successfulExecutions.length / ruleExecutions.length) * 100 
          : 0;

        return {
          ruleId: rule.id,
          name: rule.name,
          triggerCount: rule.triggerCount,
          successRate: ruleSuccessRate,
        };
      })
      .sort((a, b) => b.triggerCount - a.triggerCount)
      .slice(0, 5);

    return {
      totalRules: rules.length,
      activeRules: rules.filter(r => r.enabled).length,
      executionsToday,
      executionsThisWeek,
      executionsThisMonth,
      successRate: Math.round(successRate * 100) / 100,
      averageExecutionTime: Math.round(averageExecutionTime),
      topPerformingRules,
    };
  }

  /**
   * Private helper methods
   */
  private async createExecution(
    workspaceId: string,
    rule: CopilotRule,
    context: any
  ): Promise<CopilotExecution> {
    const execution: CopilotExecution = {
      id: this.generateExecutionId(),
      ruleId: rule.id,
      workspaceId,
      triggeredBy: 'system',
      triggeredAt: new Date(),
      status: 'pending',
      actions: rule.actions,
      results: [],
      progress: {
        current: 0,
        total: rule.actions.length,
        stage: 'pending',
        message: 'Waiting for approval...',
      },
    };

    // Store execution
    await this.redis.setex(
      `copilot:execution:${execution.id}`,
      86400, // 24 hours TTL
      JSON.stringify(execution)
    );

    // Queue execution if auto-execute is enabled
    const autoExecuteActions = rule.actions.filter(a => a.autoExecute);
    if (autoExecuteActions.length > 0) {
      await this.executionQueue.add('execute-copilot', {
        executionId: execution.id,
        actions: autoExecuteActions,
        context,
      }, {
        jobId: execution.id,
        priority: this.getPriorityValue(rule.priority),
      });
    }

    this.eventEmitter.emit('copilot.execution.created', {
      workspaceId,
      executionId: execution.id,
      ruleId: rule.id,
    });

    return execution;
  }

  private evaluateRuleConditions(conditions: RuleCondition[], context: any): boolean {
    return conditions.every(condition => {
      const value = this.getContextValue(condition.type, context);
      return this.evaluateCondition(condition, value);
    });
  }

  private getContextValue(type: string, context: any): any {
    switch (type) {
      case 'visibility_score':
        return context.visibilityScore;
      case 'mention_frequency':
        return context.mentionFrequency;
      case 'ranking_position':
        return context.rankingPosition;
      case 'sentiment_score':
        return context.sentimentScore;
      case 'competitor_gap':
        return context.competitorGap;
      case 'trust_score':
        return context.trustScore;
      case 'opportunity_detected':
        return context.opportunities?.length > 0;
      default:
        return null;
    }
  }

  private evaluateCondition(condition: RuleCondition, value: any): boolean {
    if (value === null || value === undefined) return false;

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'greater_than':
        return value > condition.value;
      case 'less_than':
        return value < condition.value;
      case 'contains':
        return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'not_contains':
        return !String(value).toLowerCase().includes(String(condition.value).toLowerCase());
      default:
        return false;
    }
  }

  private async updateRulesCache(workspaceId: string): Promise<void> {
    const rulesData = await this.redis.hgetall(`copilot:rules:${workspaceId}`);
    const rules = Object.values(rulesData).map((data: string) => JSON.parse(data));
    this.rulesCache.set(workspaceId, rules);
  }

  private async getExecutions(workspaceId: string): Promise<CopilotExecution[]> {
    // In a real implementation, this would query a database
    // For now, return empty array
    return [];
  }

  private getPriorityValue(priority: string): number {
    const priorities = {
      'low': 1,
      'medium': 5,
      'high': 10,
      'critical': 20,
    };
    return (priorities as Record<string, number>)[priority] || 1;
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Action execution methods
   */
  private async executeContentOptimization(action: CopilotAction, context: any): Promise<any> {
    await this.simulateDelay(2000);
    return {
      optimizedContent: 'Content has been optimized for better AI visibility',
      keywords: ['brand', 'industry', 'solution'],
      estimatedImprovement: 15,
    };
  }

  private async executeBacklinkBuilding(action: CopilotAction, context: any): Promise<any> {
    await this.simulateDelay(3000);
    return {
      backlinksBuilt: 5,
      domains: ['example1.com', 'example2.com', 'example3.com'],
      estimatedAuthorityIncrease: 8,
    };
  }

  private async executeSentimentImprovement(action: CopilotAction, context: any): Promise<any> {
    await this.simulateDelay(1500);
    return {
      sentimentScore: 75,
      improvements: ['Customer service enhancement', 'Content tone adjustment'],
      estimatedSentimentIncrease: 12,
    };
  }

  private async executeAuthorityEnhancement(action: CopilotAction, context: any): Promise<any> {
    await this.simulateDelay(2500);
    return {
      authorityScore: 82,
      enhancements: ['Expertise demonstration', 'Industry recognition'],
      estimatedAuthorityIncrease: 10,
    };
  }

  private async executeKnowledgeGraphUpdate(action: CopilotAction, context: any): Promise<any> {
    await this.simulateDelay(1000);
    return {
      entitiesAdded: 3,
      relationshipsAdded: 5,
      confidenceIncrease: 0.15,
    };
  }

  private async executeCorrectionSubmission(action: CopilotAction, context: any): Promise<any> {
    await this.simulateDelay(1800);
    return {
      correctionsSubmitted: 2,
      platforms: ['perplexity', 'aio'],
      estimatedAccuracyImprovement: 20,
    };
  }

  private async executeReportScheduling(action: CopilotAction, context: any): Promise<any> {
    await this.simulateDelay(500);
    return {
      reportScheduled: true,
      reportDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      recipients: ['admin@example.com'],
    };
  }

  private async executeAlertSending(action: CopilotAction, context: any): Promise<any> {
    await this.simulateDelay(800);
    return {
      alertSent: true,
      recipients: 3,
      channels: ['email', 'slack'],
    };
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


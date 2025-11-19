import { Injectable } from '@nestjs/common';
import { DiagnosticInsight } from '../insights/diagnostic-insights.service';
import { CopilotActionType } from '@ai-visibility/shared';

export interface CopilotTask {
  id: string;
  actionType: CopilotActionType;
  insightId: string;
  insightType: DiagnosticInsight['type'];
  priority: 'low' | 'medium' | 'high' | 'critical';
  target: string;
  parameters: Record<string, any>;
  estimatedImpact: number; // 0-100
  estimatedEffort: 'low' | 'medium' | 'high';
  dueDate: Date;
  weeklyRecurring: boolean;
  evidence: string[];
}

export interface WeeklyOptimizationPlan {
  workspaceId: string;
  weekStart: Date;
  weekEnd: Date;
  tasks: CopilotTask[];
  summary: {
    totalTasks: number;
    highPriority: number;
    estimatedTotalImpact: number;
    categories: {
      schema: number;
      content: number;
      citations: number;
      reputation: number;
      structure: number;
    };
  };
}

@Injectable()
export class InsightCopilotMapperService {
  /**
   * Map diagnostic insights to Copilot action types
   */
  mapInsightsToCopilotTasks(
    workspaceId: string,
    insights: DiagnosticInsight[],
    weekStart: Date = new Date(),
    weekEnd: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  ): WeeklyOptimizationPlan {
    const tasks: CopilotTask[] = [];

    for (const insight of insights) {
      const mappedTasks = this.mapInsightToTasks(insight, workspaceId);
      tasks.push(...mappedTasks);
    }

    // Sort by priority and impact
    tasks.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.estimatedImpact - a.estimatedImpact;
    });

    // Calculate summary
    const summary = {
      totalTasks: tasks.length,
      highPriority: tasks.filter(t => t.priority === 'high' || t.priority === 'critical').length,
      estimatedTotalImpact: tasks.reduce((sum, t) => sum + t.estimatedImpact, 0),
      categories: {
        schema: tasks.filter(t => t.actionType === CopilotActionType.FIX_SCHEMA).length,
        content: tasks.filter(t => t.actionType === CopilotActionType.ADD_FAQ || t.actionType === CopilotActionType.ADD_TLDR).length,
        citations: tasks.filter(t => t.actionType === CopilotActionType.ADD_CITATIONS).length,
        reputation: tasks.filter(t => t.actionType === CopilotActionType.REVIEW_CAMPAIGN).length,
        structure: tasks.filter(t => t.actionType === CopilotActionType.FIX_SCHEMA).length,
      },
    };

    return {
      workspaceId,
      weekStart,
      weekEnd,
      tasks,
      summary,
    };
  }

  /**
   * Map a single insight to one or more Copilot tasks
   */
  private mapInsightToTasks(
    insight: DiagnosticInsight,
    workspaceId: string
  ): CopilotTask[] {
    const tasks: CopilotTask[] = [];
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    switch (insight.type) {
      case 'schema_gap':
        tasks.push({
          id: `${taskId}_schema`,
          actionType: CopilotActionType.FIX_SCHEMA,
          insightId: insight.title,
          insightType: insight.type,
          priority: insight.severity === 'critical' ? 'critical' : insight.severity === 'high' ? 'high' : 'medium',
          target: 'website',
          parameters: {
            schemaTypes: ['Organization', 'LocalBusiness', 'FAQPage'],
            priority: insight.severity,
            evidence: insight.evidence,
          },
          estimatedImpact: insight.impact.score,
          estimatedEffort: 'medium',
          dueDate: this.calculateDueDate(insight.severity),
          weeklyRecurring: false,
          evidence: insight.evidence,
        });
        break;

      case 'content_gap':
        tasks.push({
          id: `${taskId}_content`,
          actionType: CopilotActionType.ADD_FAQ,
          insightId: insight.title,
          insightType: insight.type,
          priority: insight.severity === 'critical' ? 'high' : 'medium',
          target: 'website',
          parameters: {
            maxQuestions: 5,
            topics: insight.recommendations.slice(0, 3),
          },
          estimatedImpact: insight.impact.score * 0.8,
          estimatedEffort: 'low',
          dueDate: this.calculateDueDate(insight.severity),
          weeklyRecurring: false,
          evidence: insight.evidence,
        });
        break;

      case 'trust_gap':
      case 'listing_inconsistency':
        tasks.push({
          id: `${taskId}_citations`,
          actionType: CopilotActionType.ADD_CITATIONS,
          insightId: insight.title,
          insightType: insight.type,
          priority: insight.severity === 'critical' ? 'high' : 'medium',
          target: 'external',
          parameters: {
            citationTypes: ['licensed_publisher', 'directory'],
            priority: insight.severity,
            targetCount: 5,
          },
          estimatedImpact: insight.impact.score,
          estimatedEffort: 'high',
          dueDate: this.calculateDueDate(insight.severity),
          weeklyRecurring: true, // Ongoing citation building
          evidence: insight.evidence,
        });
        break;

      case 'reputation_weakness':
        tasks.push({
          id: `${taskId}_reviews`,
          actionType: CopilotActionType.REVIEW_CAMPAIGN,
          insightId: insight.title,
          insightType: insight.type,
          priority: insight.severity === 'critical' ? 'high' : 'medium',
          target: 'reputation',
          parameters: {
            campaignDuration: 30, // days
            targetPlatforms: ['Google', 'Yelp', 'Trustpilot'],
            goal: 'improve_sentiment',
          },
          estimatedImpact: insight.impact.score * 0.9,
          estimatedEffort: 'medium',
          dueDate: this.calculateDueDate(insight.severity),
          weeklyRecurring: true, // Ongoing reputation management
          evidence: insight.evidence,
        });
        break;

      case 'hallucination_risk':
        tasks.push({
          id: `${taskId}_hallucination`,
          actionType: CopilotActionType.CORRECT_HALLUCINATION,
          insightId: insight.title,
          insightType: insight.type,
          priority: 'high',
          target: 'content',
          parameters: {
            factValidation: true,
            sourceVerification: true,
            correctionPriority: 'high',
          },
          estimatedImpact: insight.impact.score,
          estimatedEffort: 'medium',
          dueDate: this.calculateDueDate('high'),
          weeklyRecurring: false,
          evidence: insight.evidence,
        });
        break;

      case 'visibility_blocker':
        // Multiple tasks for visibility blockers
        tasks.push({
          id: `${taskId}_content_opt`,
          actionType: CopilotActionType.ADD_TLDR,
          insightId: insight.title,
          insightType: insight.type,
          priority: insight.severity === 'critical' ? 'critical' : 'high',
          target: 'website',
          parameters: {
            maxLength: 200,
            optimizeForEngines: insight.impact.engines,
          },
          estimatedImpact: insight.impact.score * 0.7,
          estimatedEffort: 'low',
          dueDate: this.calculateDueDate(insight.severity),
          weeklyRecurring: false,
          evidence: insight.evidence,
        });

        if (insight.impact.engines.length > 0) {
          tasks.push({
            id: `${taskId}_citations_opt`,
            actionType: CopilotActionType.ADD_CITATIONS,
            insightId: insight.title,
            insightType: insight.type,
            priority: insight.severity === 'critical' ? 'high' : 'medium',
            target: 'external',
            parameters: {
              targetEngines: insight.impact.engines,
              citationTypes: ['licensed_publisher', 'curated'],
            },
            estimatedImpact: insight.impact.score * 0.8,
            estimatedEffort: 'high',
            dueDate: this.calculateDueDate(insight.severity),
            weeklyRecurring: true,
            evidence: insight.evidence,
          });
        }
        break;

      case 'missing_fact':
        tasks.push({
          id: `${taskId}_facts`,
          actionType: CopilotActionType.ADD_FAQ,
          insightId: insight.title,
          insightType: insight.type,
          priority: 'medium',
          target: 'website',
          parameters: {
            factTypes: ['address', 'phone', 'services'],
            ensureCompleteness: true,
          },
          estimatedImpact: insight.impact.score * 0.6,
          estimatedEffort: 'low',
          dueDate: this.calculateDueDate(insight.severity),
          weeklyRecurring: false,
          evidence: insight.evidence,
        });
        break;
    }

    return tasks;
  }

  /**
   * Calculate due date based on severity
   */
  private calculateDueDate(severity: DiagnosticInsight['severity']): Date {
    const now = new Date();
    const daysToAdd: Record<DiagnosticInsight['severity'], number> = {
      critical: 1, // Due tomorrow
      high: 3, // Due in 3 days
      medium: 7, // Due in a week
      low: 14, // Due in 2 weeks
    };

    const days = daysToAdd[severity] || 7;
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  /**
   * Generate weekly optimization plan from insights
   */
  async generateWeeklyOptimizationPlan(
    workspaceId: string,
    insights: DiagnosticInsight[]
  ): Promise<WeeklyOptimizationPlan> {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    return this.mapInsightsToCopilotTasks(workspaceId, insights, weekStart, weekEnd);
  }

  /**
   * Get action type for insight type
   */
  getActionTypeForInsight(insightType: DiagnosticInsight['type']): CopilotActionType[] {
    const mapping: Record<DiagnosticInsight['type'], CopilotActionType[]> = {
      schema_gap: [CopilotActionType.FIX_SCHEMA],
      content_gap: [CopilotActionType.ADD_FAQ, CopilotActionType.ADD_TLDR],
      trust_gap: [CopilotActionType.ADD_CITATIONS],
      listing_inconsistency: [CopilotActionType.ADD_CITATIONS],
      reputation_weakness: [CopilotActionType.REVIEW_CAMPAIGN],
      visibility_blocker: [CopilotActionType.ADD_TLDR, CopilotActionType.ADD_CITATIONS],
      competitor_advantage: [CopilotActionType.ADD_CITATIONS, CopilotActionType.ADD_FAQ],
      hallucination_risk: [CopilotActionType.CORRECT_HALLUCINATION],
      missing_fact: [CopilotActionType.ADD_FAQ],
    };

    return mapping[insightType] || [];
  }
}


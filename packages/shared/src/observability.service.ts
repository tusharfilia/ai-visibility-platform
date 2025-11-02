import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Redis } from 'ioredis';

export interface WorkspaceMetrics {
  workspaceId: string;
  timestamp: Date;
  visibilityScore: number;
  mentionCount: number;
  rankingPositions: number[];
  sentimentScore: number;
  trustScore: number;
  competitorGap: number;
  opportunities: number;
  alerts: number;
  executions: number;
  cost: number;
  apiCalls: number;
  errors: number;
}

export interface SystemMetrics {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeConnections: number;
  queueDepth: number;
  errorRate: number;
  responseTime: number;
  throughput: number;
  uptime: number;
}

export interface AlertRule {
  id: string;
  name: string;
  workspaceId?: string; // null for system-wide alerts
  type: 'workspace' | 'system';
  condition: {
    metric: string;
    operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
    threshold: number;
    duration?: number; // seconds
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  channels: string[]; // ['email', 'slack', 'webhook']
  recipients: string[];
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface ObservabilityAlert {
  id: string;
  ruleId: string;
  workspaceId?: string;
  type: 'workspace' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  workspaceId?: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'success' | 'error' | 'timeout';
  tags: Record<string, any>;
  logs: Array<{
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    data?: any;
  }>;
}

@Injectable()
export class ObservabilityService {
  private redis: Redis;
  private metricsCache: Map<string, WorkspaceMetrics[]> = new Map();
  private alertRules: Map<string, AlertRule[]> = new Map();

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.initializeDefaultAlertRules();
  }

  /**
   * Record workspace metrics
   */
  async recordWorkspaceMetrics(metrics: Omit<WorkspaceMetrics, 'timestamp'>): Promise<void> {
    const timestampedMetrics: WorkspaceMetrics = {
      ...metrics,
      timestamp: new Date(),
    };

    // Store in Redis with TTL
    const key = `metrics:workspace:${metrics.workspaceId}:${Date.now()}`;
    await this.redis.setex(key, 86400 * 7, JSON.stringify(timestampedMetrics)); // 7 days TTL

    // Update cache
    this.updateMetricsCache(metrics.workspaceId, timestampedMetrics);

    // Check alert rules
    await this.checkAlertRules(metrics.workspaceId, timestampedMetrics);

    // Emit metrics event
    this.eventEmitter.emit('metrics.workspace.recorded', {
      workspaceId: metrics.workspaceId,
      metrics: timestampedMetrics,
    });
  }

  /**
   * Record system metrics
   */
  async recordSystemMetrics(metrics: Omit<SystemMetrics, 'timestamp'>): Promise<void> {
    const timestampedMetrics: SystemMetrics = {
      ...metrics,
      timestamp: new Date(),
    };

    // Store in Redis
    const key = `metrics:system:${Date.now()}`;
    await this.redis.setex(key, 86400 * 3, JSON.stringify(timestampedMetrics)); // 3 days TTL

    // Check system alert rules
    await this.checkSystemAlertRules(timestampedMetrics);

    // Emit system metrics event
    this.eventEmitter.emit('metrics.system.recorded', {
      metrics: timestampedMetrics,
    });
  }

  /**
   * Get workspace metrics for a time range
   */
  async getWorkspaceMetrics(
    workspaceId: string,
    startTime: Date,
    endTime: Date,
    granularity: 'minute' | 'hour' | 'day' = 'hour'
  ): Promise<WorkspaceMetrics[]> {
    // Try cache first
    const cached = this.metricsCache.get(workspaceId);
    if (cached) {
      return cached.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
    }

    // Query Redis
    const pattern = `metrics:workspace:${workspaceId}:*`;
    const keys = await this.redis.keys(pattern);
    
    const metrics: WorkspaceMetrics[] = [];
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const metric = JSON.parse(data);
        if (metric.timestamp >= startTime && metric.timestamp <= endTime) {
          metrics.push(metric);
        }
      }
    }

    return metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get system metrics for a time range
   */
  async getSystemMetrics(
    startTime: Date,
    endTime: Date,
    granularity: 'minute' | 'hour' | 'day' = 'hour'
  ): Promise<SystemMetrics[]> {
    const pattern = 'metrics:system:*';
    const keys = await this.redis.keys(pattern);
    
    const metrics: SystemMetrics[] = [];
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const metric = JSON.parse(data);
        if (metric.timestamp >= startTime && metric.timestamp <= endTime) {
          metrics.push(metric);
        }
      }
    }

    return metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Create alert rule
   */
  async createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'triggerCount'>): Promise<AlertRule> {
    const alertRule: AlertRule = {
      ...rule,
      id: this.generateAlertRuleId(),
      createdAt: new Date(),
      triggerCount: 0,
    };

    const key = rule.workspaceId 
      ? `alerts:rules:workspace:${rule.workspaceId}`
      : 'alerts:rules:system';
    
    await this.redis.hset(key, alertRule.id, JSON.stringify(alertRule));

    // Update cache
    await this.updateAlertRulesCache(rule.workspaceId);

    this.eventEmitter.emit('alerts.rule.created', {
      ruleId: alertRule.id,
      workspaceId: rule.workspaceId,
    });

    return alertRule;
  }

  /**
   * Get alert rules for workspace or system
   */
  async getAlertRules(workspaceId?: string): Promise<AlertRule[]> {
    const cached = this.alertRules.get(workspaceId || 'system');
    if (cached) return cached;

    const key = workspaceId 
      ? `alerts:rules:workspace:${workspaceId}`
      : 'alerts:rules:system';
    
    const rulesData = await this.redis.hgetall(key);
    const rules = Object.values(rulesData).map(data => JSON.parse(data));
    
    this.alertRules.set(workspaceId || 'system', rules);
    return rules;
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(workspaceId?: string): Promise<Alert[]> {
    const pattern = workspaceId 
      ? `alerts:active:workspace:${workspaceId}:*`
      : 'alerts:active:system:*';
    
    const keys = await this.redis.keys(pattern);
    const alerts: Alert[] = [];
    
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        alerts.push(JSON.parse(data));
      }
    }

    return alerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    const pattern = `alerts:active:*:${alertId}`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) return false;

    const key = keys[0];
    const data = await this.redis.get(key);
    if (!data) return false;

    const alert: Alert = JSON.parse(data);
    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;

    await this.redis.setex(key, 86400 * 7, JSON.stringify(alert)); // 7 days TTL

    this.eventEmitter.emit('alerts.acknowledged', {
      alertId,
      userId,
      workspaceId: alert.workspaceId,
    });

    return true;
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string, userId: string): Promise<boolean> {
    const pattern = `alerts:active:*:${alertId}`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) return false;

    const key = keys[0];
    const data = await this.redis.get(key);
    if (!data) return false;

    const alert: Alert = JSON.parse(data);
    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedBy = userId;

    // Move to resolved alerts
    await this.redis.del(key);
    await this.redis.setex(
      `alerts:resolved:${alertId}`,
      86400 * 30, // 30 days TTL
      JSON.stringify(alert)
    );

    this.eventEmitter.emit('alerts.resolved', {
      alertId,
      userId,
      workspaceId: alert.workspaceId,
    });

    return true;
  }

  /**
   * Start trace
   */
  async startTrace(context: Omit<TraceContext, 'spanId' | 'startTime' | 'status' | 'logs'>): Promise<TraceContext> {
    const trace: TraceContext = {
      ...context,
      spanId: this.generateSpanId(),
      startTime: new Date(),
      status: 'success',
      logs: [],
    };

    const key = `trace:${trace.traceId}:${trace.spanId}`;
    await this.redis.setex(key, 3600, JSON.stringify(trace)); // 1 hour TTL

    return trace;
  }

  /**
   * Add log to trace
   */
  async addTraceLog(
    traceId: string,
    spanId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    logData?: any
  ): Promise<void> {
    const key = `trace:${traceId}:${spanId}`;
    const traceData = await this.redis.get(key);
    
    if (traceData) {
      const trace: TraceContext = JSON.parse(traceData);
      trace.logs.push({
        timestamp: new Date(),
        level,
        message,
        data: logData,
      });

      await this.redis.setex(key, 3600, JSON.stringify(trace));
    }
  }

  /**
   * Finish trace
   */
  async finishTrace(
    traceId: string,
    spanId: string,
    status: 'success' | 'error' | 'timeout',
    error?: string
  ): Promise<void> {
    const key = `trace:${traceId}:${spanId}`;
    const traceData = await this.redis.get(key);
    
    if (traceData) {
      const trace: TraceContext = JSON.parse(traceData);
      trace.endTime = new Date();
      trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
      trace.status = status;

      if (error) {
        trace.logs.push({
          timestamp: new Date(),
          level: 'error',
          message: error,
        });
      }

      await this.redis.setex(key, 3600, JSON.stringify(trace));

      this.eventEmitter.emit('trace.finished', {
        traceId,
        spanId,
        duration: trace.duration,
        status,
      });
    }
  }

  /**
   * Private helper methods
   */
  private async checkAlertRules(workspaceId: string, metrics: WorkspaceMetrics): Promise<void> {
    const rules = await this.getAlertRules(workspaceId);
    
    for (const rule of rules) {
      if (!rule.enabled) continue;

      const value = this.getMetricValue(rule.condition.metric, metrics);
      if (this.evaluateCondition(rule.condition, value)) {
        await this.triggerAlert(rule, value, metrics);
      }
    }
  }

  private async checkSystemAlertRules(metrics: SystemMetrics): Promise<void> {
    const rules = await this.getAlertRules(); // System rules
    
    for (const rule of rules) {
      if (!rule.enabled) continue;

      const value = this.getSystemMetricValue(rule.condition.metric, metrics);
      if (this.evaluateCondition(rule.condition, value)) {
        await this.triggerSystemAlert(rule, value, metrics);
      }
    }
  }

  private async triggerAlert(rule: AlertRule, value: number, metrics: WorkspaceMetrics): Promise<void> {
    const alert: ObservabilityAlert = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      workspaceId: rule.workspaceId,
      type: 'workspace',
      severity: rule.severity,
      title: `${rule.name} - ${rule.condition.metric}`,
      message: `${rule.condition.metric} is ${rule.condition.operator} ${rule.condition.threshold} (current: ${value})`,
      metric: rule.condition.metric,
      value,
      threshold: rule.condition.threshold,
      status: 'active',
      createdAt: new Date(),
    };

    const key = `alerts:active:workspace:${rule.workspaceId}:${alert.id}`;
    await this.redis.setex(key, 86400 * 7, JSON.stringify(alert)); // 7 days TTL

    // Update rule trigger count
    await this.updateRuleTriggerCount(rule.id, rule.workspaceId);

    // Send notifications
    await this.sendAlertNotifications(alert, rule);

    this.eventEmitter.emit('alerts.triggered', {
      alertId: alert.id,
      ruleId: rule.id,
      workspaceId: rule.workspaceId,
      severity: rule.severity,
    });
  }

  private async triggerSystemAlert(rule: AlertRule, value: number, metrics: SystemMetrics): Promise<void> {
    const alert: ObservabilityAlert = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      type: 'system',
      severity: rule.severity,
      title: `${rule.name} - ${rule.condition.metric}`,
      message: `${rule.condition.metric} is ${rule.condition.operator} ${rule.condition.threshold} (current: ${value})`,
      metric: rule.condition.metric,
      value,
      threshold: rule.condition.threshold,
      status: 'active',
      createdAt: new Date(),
    };

    const key = `alerts:active:system:${alert.id}`;
    await this.redis.setex(key, 86400 * 7, JSON.stringify(alert)); // 7 days TTL

    // Update rule trigger count
    await this.updateRuleTriggerCount(rule.id);

    // Send notifications
    await this.sendAlertNotifications(alert, rule);

    this.eventEmitter.emit('alerts.triggered', {
      alertId: alert.id,
      ruleId: rule.id,
      severity: rule.severity,
    });
  }

  private getMetricValue(metric: string, metrics: WorkspaceMetrics): number {
    const metricMap: Record<string, number> = {
      'visibility_score': metrics.visibilityScore,
      'mention_count': metrics.mentionCount,
      'sentiment_score': metrics.sentimentScore,
      'trust_score': metrics.trustScore,
      'competitor_gap': metrics.competitorGap,
      'opportunities': metrics.opportunities,
      'alerts': metrics.alerts,
      'executions': metrics.executions,
      'cost': metrics.cost,
      'api_calls': metrics.apiCalls,
      'errors': metrics.errors,
    };
    return metricMap[metric] || 0;
  }

  private getSystemMetricValue(metric: string, metrics: SystemMetrics): number {
    const metricMap: Record<string, number> = {
      'cpu_usage': metrics.cpuUsage,
      'memory_usage': metrics.memoryUsage,
      'disk_usage': metrics.diskUsage,
      'active_connections': metrics.activeConnections,
      'queue_depth': metrics.queueDepth,
      'error_rate': metrics.errorRate,
      'response_time': metrics.responseTime,
      'throughput': metrics.throughput,
    };
    return metricMap[metric] || 0;
  }

  private evaluateCondition(condition: any, value: number): boolean {
    switch (condition.operator) {
      case 'greater_than':
        return value > condition.threshold;
      case 'less_than':
        return value < condition.threshold;
      case 'equals':
        return value === condition.threshold;
      case 'not_equals':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  private async sendAlertNotifications(alert: ObservabilityAlert, rule: AlertRule): Promise<void> {
    // In a real implementation, this would send emails, Slack messages, etc.
    console.log(`Alert triggered: ${alert.title} - ${alert.message}`);
    
    for (const channel of rule.channels) {
      console.log(`Sending ${channel} notification to: ${rule.recipients.join(', ')}`);
    }
  }

  private async updateRuleTriggerCount(ruleId: string, workspaceId?: string): Promise<void> {
    const key = workspaceId 
      ? `alerts:rules:workspace:${workspaceId}`
      : 'alerts:rules:system';
    
    const data = await this.redis.hget(key, ruleId);
    if (data) {
      const rule: AlertRule = JSON.parse(data);
      rule.triggerCount++;
      rule.lastTriggered = new Date();
      
      await this.redis.hset(key, ruleId, JSON.stringify(rule));
    }
  }

  private updateMetricsCache(workspaceId: string, metrics: WorkspaceMetrics): void {
    const cached = this.metricsCache.get(workspaceId) || [];
    cached.push(metrics);
    
    // Keep only last 1000 metrics per workspace
    if (cached.length > 1000) {
      cached.splice(0, cached.length - 1000);
    }
    
    this.metricsCache.set(workspaceId, cached);
  }

  private async updateAlertRulesCache(workspaceId?: string): Promise<void> {
    const key = workspaceId 
      ? `alerts:rules:workspace:${workspaceId}`
      : 'alerts:rules:system';
    
    const rulesData = await this.redis.hgetall(key);
    const rules = Object.values(rulesData).map(data => JSON.parse(data));
    
    this.alertRules.set(workspaceId || 'system', rules);
  }

  private async initializeDefaultAlertRules(): Promise<void> {
    const defaultRules: Omit<AlertRule, 'id' | 'createdAt' | 'triggerCount'>[] = [
      {
        name: 'High Error Rate',
        type: 'system',
        condition: { metric: 'error_rate', operator: 'greater_than', threshold: 0.05 },
        severity: 'high',
        enabled: true,
        channels: ['email', 'slack'],
        recipients: ['admin@example.com'],
      },
      {
        name: 'Low Visibility Score',
        type: 'workspace',
        condition: { metric: 'visibility_score', operator: 'less_than', threshold: 30 },
        severity: 'medium',
        enabled: true,
        channels: ['email'],
        recipients: ['workspace-admin@example.com'],
      },
      {
        name: 'High API Cost',
        type: 'workspace',
        condition: { metric: 'cost', operator: 'greater_than', threshold: 1000 },
        severity: 'high',
        enabled: true,
        channels: ['email', 'slack'],
        recipients: ['billing@example.com'],
      },
    ];

    for (const rule of defaultRules) {
      await this.createAlertRule(rule);
    }
  }

  private generateAlertRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}


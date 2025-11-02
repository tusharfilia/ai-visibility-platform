/**
 * Event type definitions for SSE
 * Defines all event types used in the real-time system
 */

export interface BaseEvent {
  id: string;
  type: string;
  data: any;
  timestamp: string;
  workspaceId: string;
}

export interface ScanProgressEvent extends BaseEvent {
  type: 'scan.progress';
  data: {
    scanId: string;
    progress: number; // 0-100
    status: 'pending' | 'running' | 'completed' | 'failed';
    currentStep?: string;
    totalSteps?: number;
    completedSteps?: number;
    estimatedTimeRemaining?: number; // seconds
  };
}

export interface CopilotActionEvent extends BaseEvent {
  type: 'copilot.action';
  data: {
    actionId: string;
    actionType: 'ADD_FAQ' | 'ADD_TLDR' | 'ADD_CITATIONS' | 'FIX_SCHEMA' | 'REVIEW_CAMPAIGN';
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
    targetUrl: string;
    diff?: string;
    approverId?: string;
    approvedAt?: string;
  };
}

export interface SyncStatusEvent extends BaseEvent {
  type: 'sync.status';
  data: {
    syncId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    platform: 'GBP' | 'YELP' | 'FB' | 'APPLE' | 'WEBFLOW' | 'WP' | 'NOTION' | 'HUBSPOT' | 'PIPEDRIVE';
    progress?: number;
    lastSyncAt?: string;
    nextSyncAt?: string;
    errorMessage?: string;
  };
}

export interface NotificationEvent extends BaseEvent {
  type: 'notification';
  data: {
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    title?: string;
    actionUrl?: string;
    actionText?: string;
    persistent?: boolean;
  };
}

export interface HeartbeatEvent extends BaseEvent {
  type: 'heartbeat';
  data: {
    timestamp: string;
  };
}

export interface ConnectedEvent extends BaseEvent {
  type: 'connected';
  data: {
    workspaceId: string;
    userId: string;
    timestamp: string;
  };
}

export type SSEEvent = 
  | ScanProgressEvent
  | CopilotActionEvent
  | SyncStatusEvent
  | NotificationEvent
  | HeartbeatEvent
  | ConnectedEvent;

export interface EventSubscription {
  workspaceId: string;
  eventTypes: string[];
  callback: (event: SSEEvent) => void;
}

export interface EventFilter {
  workspaceId: string;
  eventTypes?: string[];
  since?: string;
  until?: string;
  limit?: number;
}

export class EventTypeRegistry {
  private static readonly EVENT_TYPES = {
    SCAN_PROGRESS: 'scan.progress',
    COPILOT_ACTION: 'copilot.action',
    SYNC_STATUS: 'sync.status',
    NOTIFICATION: 'notification',
    HEARTBEAT: 'heartbeat',
    CONNECTED: 'connected',
    MATURITY_UPDATED: 'maturity.updated',
    GEO_RECOMMENDATIONS_UPDATED: 'geo.recommendations.updated',
    EVIDENCE_PROGRESS: 'evidence.progress',
    EVIDENCE_COMPLETE: 'evidence.complete'
  } as const;

  static getEventTypes() {
    return this.EVENT_TYPES;
  }

  static isValidEventType(type: string): boolean {
    return Object.values(this.EVENT_TYPES).includes(type as any);
  }

  static getEventTypeForOperation(operation: string): string {
    const operationMap: Record<string, string> = {
      'scan': this.EVENT_TYPES.SCAN_PROGRESS,
      'copilot': this.EVENT_TYPES.COPILOT_ACTION,
      'sync': this.EVENT_TYPES.SYNC_STATUS,
      'notification': this.EVENT_TYPES.NOTIFICATION
    };

    return operationMap[operation] || this.EVENT_TYPES.NOTIFICATION;
  }
}

export interface EventMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByWorkspace: Record<string, number>;
  averageEventSize: number;
  lastEventAt: string;
}

export interface EventSubscriptionManager {
  subscribe(filter: EventFilter, callback: (event: SSEEvent) => void): string;
  unsubscribe(subscriptionId: string): void;
  getSubscriptions(workspaceId: string): EventSubscription[];
  emit(event: SSEEvent): void;
  getMetrics(): EventMetrics;
}


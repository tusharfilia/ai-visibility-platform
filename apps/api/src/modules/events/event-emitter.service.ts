/**
 * Event Emitter Service
 * Manages real-time event broadcasting with workspace isolation
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import { RedisSSEAdapter } from './redis-adapter';

export interface SSEEvent {
  id: string;
  type: string;
  data: any;
  timestamp: string;
  workspaceId: string;
}

@Injectable()
export class EventEmitterService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private subscribers: Map<string, Set<Function>> = new Map();
  private eventHistory: Map<string, SSEEvent[]> = new Map();
  private readonly MAX_HISTORY = 100; // Keep last 100 events per workspace
  private redisAdapter?: RedisSSEAdapter;

  constructor(@Optional() redisAdapter: RedisSSEAdapter | undefined) {
    super();
    this.redisAdapter = redisAdapter;
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async onModuleInit() {
    // Set up Redis pub/sub for multi-instance support
    // Gracefully handle Redis connection failures
    try {
      await this.setupRedisPubSub();
    } catch (error) {
      console.warn('⚠️  Redis connection failed, continuing without pub/sub:', error instanceof Error ? error.message : String(error));
      // Continue without Redis - app should still work with local event emission
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /**
   * Set up Redis pub/sub for multi-instance SSE broadcast
   */
  private async setupRedisPubSub() {
    // Subscribe to SSE events from other instances
    await this.redis.subscribe('sse:events');
    
    this.redis.on('message', (channel, message) => {
      if (channel === 'sse:events') {
        try {
          const event: SSEEvent = JSON.parse(message);
          this.handleRedisEvent(event);
        } catch (error) {
          console.error('Failed to parse Redis SSE event:', error);
        }
      }
    });

    console.log('Redis Pub/Sub setup complete for multi-instance SSE broadcast');
  }

  /**
   * Handle SSE event from Redis
   */
  private handleRedisEvent(event: SSEEvent): void {
    // Store in history
    this.storeEvent(event.workspaceId, event);

    // Notify local subscribers
    const workspaceSubscribers = this.subscribers.get(event.workspaceId);
    if (workspaceSubscribers) {
      workspaceSubscribers.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  /**
   * Subscribe to workspace events
   */
  subscribe(workspaceId: string, listener: Function): void {
    if (!this.subscribers.has(workspaceId)) {
      this.subscribers.set(workspaceId, new Set());
    }
    this.subscribers.get(workspaceId)!.add(listener);
  }

  /**
   * Unsubscribe from workspace events
   */
  unsubscribe(workspaceId: string, listener: Function): void {
    const workspaceSubscribers = this.subscribers.get(workspaceId);
    if (workspaceSubscribers) {
      workspaceSubscribers.delete(listener);
      if (workspaceSubscribers.size === 0) {
        this.subscribers.delete(workspaceId);
      }
    }
  }

  /**
   * Emit event to workspace
   */
  async emitToWorkspace(workspaceId: string, type: string, data: any): Promise<void> {
    const event: SSEEvent = {
      id: this.generateEventId(),
      type,
      data,
      timestamp: new Date().toISOString(),
      workspaceId
    };

    // Store in history
    this.storeEvent(workspaceId, event);

    // Notify local subscribers
    const workspaceSubscribers = this.subscribers.get(workspaceId);
    if (workspaceSubscribers) {
      workspaceSubscribers.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }

    // Emit to Redis for multi-instance support
    await this.emitToRedis(event);

    // Also emit via Redis adapter for SSE connections (if available)
    if (this.redisAdapter) {
      try {
        await this.redisAdapter.sendToWorkspace(workspaceId, type, data);
      } catch (error) {
        console.warn('Failed to send event via Redis SSE adapter:', error instanceof Error ? error.message : String(error));
      }
    }
  }

  /**
   * Get missed events for reconnection
   */
  async getMissedEvents(workspaceId: string, lastEventId: string): Promise<SSEEvent[]> {
    const history = this.eventHistory.get(workspaceId) || [];
    const lastEventIndex = history.findIndex(event => event.id === lastEventId);
    
    if (lastEventIndex === -1) {
      // Event not found, return recent events
      return history.slice(-10);
    }
    
    return history.slice(lastEventIndex + 1);
  }

  /**
   * Store event in history
   */
  private storeEvent(workspaceId: string, event: SSEEvent): void {
    if (!this.eventHistory.has(workspaceId)) {
      this.eventHistory.set(workspaceId, []);
    }
    
    const history = this.eventHistory.get(workspaceId)!;
    history.push(event);
    
    // Keep only recent events
    if (history.length > this.MAX_HISTORY) {
      history.shift();
    }
  }

  /**
   * Emit to Redis for multi-instance support
   */
  private async emitToRedis(event: SSEEvent): Promise<void> {
    try {
      await this.redis.publish('sse:events', JSON.stringify(event));
    } catch (error) {
      console.error('Failed to emit to Redis:', error);
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit scan progress event
   */
  emitScanProgress(workspaceId: string, scanId: string, progress: number, status: string): void {
    this.emitToWorkspace(workspaceId, 'scan.progress', {
      scanId,
      progress,
      status,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit copilot action event
   */
  emitCopilotAction(workspaceId: string, actionId: string, action: any): void {
    this.emitToWorkspace(workspaceId, 'copilot.action', {
      actionId,
      action,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit sync status event
   */
  emitSyncStatus(workspaceId: string, syncId: string, status: string, details?: any): void {
    this.emitToWorkspace(workspaceId, 'sync.status', {
      syncId,
      status,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit workspace notification
   */
  emitNotification(workspaceId: string, type: string, message: string, data?: any): void {
    this.emitToWorkspace(workspaceId, 'notification', {
      type,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get workspace event history
   */
  getEventHistory(workspaceId: string): SSEEvent[] {
    return this.eventHistory.get(workspaceId) || [];
  }

  /**
   * Clear workspace event history
   */
  clearEventHistory(workspaceId: string): void {
    this.eventHistory.delete(workspaceId);
  }
}


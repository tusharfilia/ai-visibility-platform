import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface SSEConnection {
  id: string;
  workspaceId: string;
  userId: string;
  response: any;
  lastHeartbeat: Date;
  isActive: boolean;
}

export interface SSEMessage {
  id: string;
  workspaceId: string;
  event: string;
  data: any;
  timestamp: Date;
}

@Injectable()
export class RedisSSEAdapter {
  private publisher: Redis;
  private subscriber: Redis;
  private connections: Map<string, SSEConnection> = new Map();
  private workspaceConnections: Map<string, Set<string>> = new Map();

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    
    this.publisher = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    this.subscriber = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    this.setupSubscriptions();
  }

  /**
   * Add SSE connection
   */
  addConnection(connectionId: string, connection: SSEConnection): void {
    this.connections.set(connectionId, connection);
    
    // Add to workspace connections
    if (!this.workspaceConnections.has(connection.workspaceId)) {
      this.workspaceConnections.set(connection.workspaceId, new Set());
    }
    this.workspaceConnections.get(connection.workspaceId)!.add(connectionId);

    console.log(`SSE connection added: ${connectionId} for workspace ${connection.workspaceId}`);
  }

  /**
   * Remove SSE connection
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    this.connections.delete(connectionId);
    
    // Remove from workspace connections
    const workspaceConnections = this.workspaceConnections.get(connection.workspaceId);
    if (workspaceConnections) {
      workspaceConnections.delete(connectionId);
      if (workspaceConnections.size === 0) {
        this.workspaceConnections.delete(connection.workspaceId);
      }
    }

    console.log(`SSE connection removed: ${connectionId}`);
  }

  /**
   * Send message to workspace
   */
  async sendToWorkspace(workspaceId: string, event: string, data: any): Promise<void> {
    const message: SSEMessage = {
      id: this.generateMessageId(),
      workspaceId,
      event,
      data,
      timestamp: new Date()
    };

    // Publish to Redis channel
    await this.publisher.publish(
      `sse:workspace:${workspaceId}`,
      JSON.stringify(message)
    );

    console.log(`SSE message published to workspace ${workspaceId}: ${event}`);
  }

  /**
   * Send message to specific user
   */
  async sendToUser(workspaceId: string, userId: string, event: string, data: any): Promise<void> {
    const message: SSEMessage = {
      id: this.generateMessageId(),
      workspaceId,
      event,
      data,
      timestamp: new Date()
    };

    // Publish to Redis channel
    await this.publisher.publish(
      `sse:user:${workspaceId}:${userId}`,
      JSON.stringify(message)
    );

    console.log(`SSE message published to user ${userId} in workspace ${workspaceId}: ${event}`);
  }

  /**
   * Send heartbeat to all connections
   */
  async sendHeartbeat(): Promise<void> {
    const heartbeatMessage: SSEMessage = {
      id: this.generateMessageId(),
      workspaceId: 'system',
      event: 'heartbeat',
      data: { timestamp: new Date().toISOString() },
      timestamp: new Date()
    };

    // Publish to global heartbeat channel
    await this.publisher.publish('sse:heartbeat', JSON.stringify(heartbeatMessage));
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    workspaceConnections: Record<string, number>;
    activeConnections: number;
  } {
    const stats = {
      totalConnections: this.connections.size,
      workspaceConnections: {} as Record<string, number>,
      activeConnections: 0
    };

    // Count connections per workspace
    for (const [workspaceId, connections] of this.workspaceConnections.entries()) {
      stats.workspaceConnections[workspaceId] = connections.size;
    }

    // Count active connections
    for (const connection of this.connections.values()) {
      if (connection.isActive) {
        stats.activeConnections++;
      }
    }

    return stats;
  }

  /**
   * Clean up inactive connections
   */
  cleanupInactiveConnections(): number {
    const now = new Date();
    const inactiveThreshold = 60 * 1000; // 60 seconds
    let cleanedCount = 0;

    for (const [connectionId, connection] of this.connections.entries()) {
      const timeSinceLastHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
      
      if (timeSinceLastHeartbeat > inactiveThreshold) {
        this.removeConnection(connectionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} inactive SSE connections`);
    }

    return cleanedCount;
  }

  /**
   * Setup Redis subscriptions
   */
  private setupSubscriptions(): void {
    // Subscribe to workspace channels
    this.subscriber.psubscribe('sse:workspace:*');
    this.subscriber.psubscribe('sse:user:*');
    this.subscriber.subscribe('sse:heartbeat');

    this.subscriber.on('pmessage', (pattern, channel, message) => {
      this.handleRedisMessage(channel, message);
    });

    this.subscriber.on('message', (channel, message) => {
      this.handleRedisMessage(channel, message);
    });

    console.log('Redis SSE adapter subscriptions setup complete');
  }

  /**
   * Handle Redis message
   */
  private handleRedisMessage(channel: string, message: string): void {
    try {
      const sseMessage: SSEMessage = JSON.parse(message);

      if (channel === 'sse:heartbeat') {
        this.broadcastHeartbeat(sseMessage);
        return;
      }

      if (channel.startsWith('sse:workspace:')) {
        const workspaceId = channel.replace('sse:workspace:', '');
        this.broadcastToWorkspace(workspaceId, sseMessage);
        return;
      }

      if (channel.startsWith('sse:user:')) {
        const [, , workspaceId, userId] = channel.split(':');
        this.broadcastToUser(workspaceId, userId, sseMessage);
        return;
      }
    } catch (error) {
      console.error('Failed to handle Redis SSE message:', error);
    }
  }

  /**
   * Broadcast heartbeat to all connections
   */
  private broadcastHeartbeat(message: SSEMessage): void {
    for (const connection of this.connections.values()) {
      if (connection.isActive) {
        this.sendSSEMessage(connection, message);
        connection.lastHeartbeat = new Date();
      }
    }
  }

  /**
   * Broadcast to workspace
   */
  private broadcastToWorkspace(workspaceId: string, message: SSEMessage): void {
    const workspaceConnections = this.workspaceConnections.get(workspaceId);
    if (!workspaceConnections) return;

    for (const connectionId of workspaceConnections) {
      const connection = this.connections.get(connectionId);
      if (connection && connection.isActive) {
        this.sendSSEMessage(connection, message);
      }
    }
  }

  /**
   * Broadcast to specific user
   */
  private broadcastToUser(workspaceId: string, userId: string, message: SSEMessage): void {
    const workspaceConnections = this.workspaceConnections.get(workspaceId);
    if (!workspaceConnections) return;

    for (const connectionId of workspaceConnections) {
      const connection = this.connections.get(connectionId);
      if (connection && connection.isActive && connection.userId === userId) {
        this.sendSSEMessage(connection, message);
      }
    }
  }

  /**
   * Send SSE message to connection
   */
  private sendSSEMessage(connection: SSEConnection, message: SSEMessage): void {
    try {
      const sseData = `id: ${message.id}\nevent: ${message.event}\ndata: ${JSON.stringify(message.data)}\n\n`;
      connection.response.write(sseData);
    } catch (error) {
      console.error(`Failed to send SSE message to connection ${connection.id}:`, error);
      connection.isActive = false;
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close Redis connections
   */
  async close(): Promise<void> {
    await Promise.all([
      this.publisher.quit(),
      this.subscriber.quit()
    ]);
    console.log('Redis SSE adapter closed');
  }
}


import { Injectable } from '@nestjs/common';
import { RedisSSEAdapter } from './redis-adapter';

export interface SSEConnectionPool {
  connections: Map<string, any>;
  workspaceConnections: Map<string, Set<string>>;
  lastCleanup: Date;
}

@Injectable()
export class SSEConnectionPoolService {
  private pools: Map<string, SSEConnectionPool> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private redisAdapter: RedisSSEAdapter) {
    // Cleanup inactive connections every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveConnections();
    }, 30000);
  }

  /**
   * Add connection to pool
   */
  addConnection(
    instanceId: string,
    connectionId: string,
    workspaceId: string,
    userId: string,
    response: any
  ): void {
    if (!this.pools.has(instanceId)) {
      this.pools.set(instanceId, {
        connections: new Map(),
        workspaceConnections: new Map(),
        lastCleanup: new Date()
      });
    }

    const pool = this.pools.get(instanceId)!;
    const connection = {
      id: connectionId,
      workspaceId,
      userId,
      response,
      lastHeartbeat: new Date(),
      isActive: true
    };

    pool.connections.set(connectionId, connection);

    // Add to workspace connections
    if (!pool.workspaceConnections.has(workspaceId)) {
      pool.workspaceConnections.set(workspaceId, new Set());
    }
    pool.workspaceConnections.get(workspaceId)!.add(connectionId);

    // Also add to Redis adapter for cross-instance communication
    this.redisAdapter.addConnection(connectionId, connection);

    console.log(`Connection ${connectionId} added to pool ${instanceId} for workspace ${workspaceId}`);
  }

  /**
   * Remove connection from pool
   */
  removeConnection(instanceId: string, connectionId: string): void {
    const pool = this.pools.get(instanceId);
    if (!pool) return;

    const connection = pool.connections.get(connectionId);
    if (!connection) return;

    pool.connections.delete(connectionId);

    // Remove from workspace connections
    const workspaceConnections = pool.workspaceConnections.get(connection.workspaceId);
    if (workspaceConnections) {
      workspaceConnections.delete(connectionId);
      if (workspaceConnections.size === 0) {
        pool.workspaceConnections.delete(connection.workspaceId);
      }
    }

    // Also remove from Redis adapter
    this.redisAdapter.removeConnection(connectionId);

    console.log(`Connection ${connectionId} removed from pool ${instanceId}`);
  }

  /**
   * Send message to workspace across all instances
   */
  async sendToWorkspace(workspaceId: string, event: string, data: any): Promise<void> {
    await this.redisAdapter.sendToWorkspace(workspaceId, event, data);
  }

  /**
   * Send message to specific user across all instances
   */
  async sendToUser(workspaceId: string, userId: string, event: string, data: any): Promise<void> {
    await this.redisAdapter.sendToUser(workspaceId, userId, event, data);
  }

  /**
   * Send heartbeat to all connections
   */
  async sendHeartbeat(): Promise<void> {
    await this.redisAdapter.sendHeartbeat();
  }

  /**
   * Get connection statistics for all pools
   */
  getPoolStats(): {
    totalPools: number;
    totalConnections: number;
    workspaceConnections: Record<string, number>;
    instanceStats: Record<string, {
      connections: number;
      workspaces: number;
    }>;
  } {
    const stats = {
      totalPools: this.pools.size,
      totalConnections: 0,
      workspaceConnections: {} as Record<string, number>,
      instanceStats: {} as Record<string, any>
    };

    for (const [instanceId, pool] of this.pools.entries()) {
      stats.instanceStats[instanceId] = {
        connections: pool.connections.size,
        workspaces: pool.workspaceConnections.size
      };

      stats.totalConnections += pool.connections.size;

      // Aggregate workspace connections
      for (const [workspaceId, connections] of pool.workspaceConnections.entries()) {
        stats.workspaceConnections[workspaceId] = 
          (stats.workspaceConnections[workspaceId] || 0) + connections.size;
      }
    }

    return stats;
  }

  /**
   * Clean up inactive connections
   */
  private cleanupInactiveConnections(): void {
    const now = new Date();
    const inactiveThreshold = 60 * 1000; // 60 seconds
    let totalCleaned = 0;

    for (const [instanceId, pool] of this.pools.entries()) {
      let cleanedCount = 0;

      for (const [connectionId, connection] of pool.connections.entries()) {
        const timeSinceLastHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
        
        if (timeSinceLastHeartbeat > inactiveThreshold) {
          this.removeConnection(instanceId, connectionId);
          cleanedCount++;
        }
      }

      totalCleaned += cleanedCount;
      pool.lastCleanup = now;
    }

    if (totalCleaned > 0) {
      console.log(`Cleaned up ${totalCleaned} inactive SSE connections across all pools`);
    }
  }

  /**
   * Get connections for workspace
   */
  getWorkspaceConnections(workspaceId: string): Array<{
    instanceId: string;
    connectionId: string;
    userId: string;
    isActive: boolean;
    lastHeartbeat: Date;
  }> {
    const connections: any[] = [];

    for (const [instanceId, pool] of this.pools.entries()) {
      const workspaceConnections = pool.workspaceConnections.get(workspaceId);
      if (!workspaceConnections) continue;

      for (const connectionId of workspaceConnections) {
        const connection = pool.connections.get(connectionId);
        if (connection) {
          connections.push({
            instanceId,
            connectionId,
            userId: connection.userId,
            isActive: connection.isActive,
            lastHeartbeat: connection.lastHeartbeat
          });
        }
      }
    }

    return connections;
  }

  /**
   * Check if workspace has active connections
   */
  hasActiveConnections(workspaceId: string): boolean {
    for (const pool of this.pools.values()) {
      const workspaceConnections = pool.workspaceConnections.get(workspaceId);
      if (workspaceConnections && workspaceConnections.size > 0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Close all connections and cleanup
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all connections
    for (const pool of this.pools.values()) {
      for (const connection of pool.connections.values()) {
        try {
          connection.response.end();
        } catch (error) {
          console.error('Error closing SSE connection:', error);
        }
      }
    }

    this.pools.clear();
    await this.redisAdapter.close();

    console.log('SSE connection pool service closed');
  }
}


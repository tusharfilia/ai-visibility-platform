import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SSEClientConfig {
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatTimeout: number;
  lastEventId?: string;
}

export interface SSERawEvent {
  id: string;
  event: string;
  data: any;
  timestamp: Date;
}

export interface SSEConnectionState {
  isConnected: boolean;
  reconnectAttempts: number;
  lastEventId: string | null;
  lastHeartbeat: Date | null;
}

@Injectable()
export class SSEClientService {
  private defaultConfig: SSEClientConfig = {
    reconnectInterval: 1000, // Start with 1 second
    maxReconnectAttempts: 10,
    heartbeatTimeout: 30000, // 30 seconds
  };

  constructor(private configService: ConfigService) {
    // Load config from environment
    this.defaultConfig.reconnectInterval = this.configService.get<number>('SSE_RECONNECT_INTERVAL', 1000);
    this.defaultConfig.maxReconnectAttempts = this.configService.get<number>('SSE_MAX_RECONNECT_ATTEMPTS', 10);
    this.defaultConfig.heartbeatTimeout = this.configService.get<number>('SSE_HEARTBEAT_TIMEOUT', 30000);
  }

  /**
   * Create SSE client configuration
   */
  createClientConfig(customConfig: Partial<SSEClientConfig> = {}): SSEClientConfig {
    return {
      ...this.defaultConfig,
      ...customConfig
    };
  }

  /**
   * Generate SSE client JavaScript code
   */
  generateClientCode(baseUrl: string, workspaceId: string, userId: string): string {
    return `
class AIVisibilitySSEClient {
  constructor(baseUrl, workspaceId, userId, config = {}) {
    this.baseUrl = baseUrl;
    this.workspaceId = workspaceId;
    this.userId = userId;
    this.config = {
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      heartbeatTimeout: 30000,
      ...config
    };
    
    this.state = {
      isConnected: false,
      reconnectAttempts: 0,
      lastEventId: null,
      lastHeartbeat: null
    };
    
    this.eventSource = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    
    this.eventHandlers = new Map();
  }

  connect() {
    if (this.state.isConnected) {
      console.warn('SSE client already connected');
      return;
    }

    const url = \`\${this.baseUrl}/v1/events/stream?workspaceId=\${this.workspaceId}&userId=\${this.userId}\`;
    const headers = {};
    
    if (this.state.lastEventId) {
      headers['Last-Event-ID'] = this.state.lastEventId;
    }

    try {
      this.eventSource = new EventSource(url);
      this.setupEventHandlers();
      this.startHeartbeatTimer();
      
      console.log('SSE client connecting...');
    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.state.isConnected = false;
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    console.log('SSE client disconnected');
  }

  setupEventHandlers() {
    this.eventSource.onopen = () => {
      console.log('SSE client connected');
      this.state.isConnected = true;
      this.state.reconnectAttempts = 0;
      this.emit('connected');
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.state.lastEventId = event.lastEventId;
        
        if (event.type === 'heartbeat') {
          this.state.lastHeartbeat = new Date();
          this.emit('heartbeat', data);
        } else {
          this.emit(event.type || 'message', data);
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      this.state.isConnected = false;
      this.emit('error', error);
      
      if (this.state.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.scheduleReconnect();
      } else {
        this.emit('maxReconnectAttemptsReached');
      }
    };
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    
    this.state.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.state.reconnectAttempts - 1);
    
    console.log(\`SSE client reconnecting in \${delay}ms (attempt \${this.state.reconnectAttempts})\`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  startHeartbeatTimer() {
    this.heartbeatTimer = setInterval(() => {
      const now = new Date();
      const timeSinceLastHeartbeat = this.state.lastHeartbeat ? 
        now.getTime() - this.state.lastHeartbeat.getTime() : 
        this.config.heartbeatTimeout + 1;
      
      if (timeSinceLastHeartbeat > this.config.heartbeatTimeout) {
        console.warn('SSE heartbeat timeout, reconnecting...');
        this.disconnect();
        this.scheduleReconnect();
      }
    }, this.config.heartbeatTimeout / 2);
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  off(event, handler) {
    if (!this.eventHandlers.has(event)) return;
    
    const handlers = this.eventHandlers.get(event);
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.eventHandlers.has(event)) return;
    
    this.eventHandlers.get(event).forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(\`Error in SSE event handler for \${event}:\`, error);
      }
    });
  }

  getState() {
    return { ...this.state };
  }
}

// Usage example:
const sseClient = new AIVisibilitySSEClient(
  '${baseUrl}',
  '${workspaceId}',
  '${userId}',
  {
    reconnectInterval: 1000,
    maxReconnectAttempts: 10,
    heartbeatTimeout: 30000
  }
);

// Event handlers
sseClient.on('connected', () => {
  console.log('Connected to AI Visibility Platform');
});

sseClient.on('scan.progress', (data) => {
  console.log('Scan progress:', data);
  // Update UI with progress
});

sseClient.on('copilot.action', (data) => {
  console.log('Copilot action:', data);
  // Handle copilot actions
});

sseClient.on('sync.status', (data) => {
  console.log('Sync status:', data);
  // Update sync status
});

sseClient.on('heartbeat', (data) => {
  console.log('Heartbeat received:', data);
});

sseClient.on('error', (error) => {
  console.error('SSE error:', error);
});

sseClient.on('maxReconnectAttemptsReached', () => {
  console.error('Max reconnect attempts reached');
  // Show user notification
});

// Connect
sseClient.connect();

// Export for use
window.AIVisibilitySSEClient = AIVisibilitySSEClient;
window.sseClient = sseClient;
`;
  }

  /**
   * Generate SSE client configuration for React/Vue/Angular
   */
  generateReactHook(): string {
    return `
import { useEffect, useRef, useState } from 'react';

export interface SSEEvent {
  id: string;
  event: string;
  data: any;
  timestamp: Date;
}

export interface SSEState {
  isConnected: boolean;
  reconnectAttempts: number;
  lastEventId: string | null;
  lastHeartbeat: Date | null;
}

export function useSSE(
  baseUrl: string,
  workspaceId: string,
  userId: string,
  config: {
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
    heartbeatTimeout?: number;
  } = {}
) {
  const [state, setState] = useState<SSEState>({
    isConnected: false,
    reconnectAttempts: 0,
    lastEventId: null,
    lastHeartbeat: null
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);

  const defaultConfig = {
    reconnectInterval: 1000,
    maxReconnectAttempts: 10,
    heartbeatTimeout: 30000,
    ...config
  };

  const connect = () => {
    if (state.isConnected) return;

    const url = \`\${baseUrl}/v1/events/stream?workspaceId=\${workspaceId}&userId=\${userId}\`;
    
    try {
      eventSourceRef.current = new EventSource(url);
      
      eventSourceRef.current.onopen = () => {
        setState(prev => ({
          ...prev,
          isConnected: true,
          reconnectAttempts: 0
        }));
      };

      eventSourceRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          setState(prev => ({
            ...prev,
            lastEventId: event.lastEventId
          }));
          
          if (event.type === 'heartbeat') {
            setState(prev => ({
              ...prev,
              lastHeartbeat: new Date()
            }));
          }
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };

      eventSourceRef.current.onerror = () => {
        setState(prev => ({
          ...prev,
          isConnected: false
        }));
        
        if (state.reconnectAttempts < defaultConfig.maxReconnectAttempts) {
          scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('Failed to create SSE connection:', error);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimerRef.current) return;
    
    const delay = defaultConfig.reconnectInterval * Math.pow(2, state.reconnectAttempts);
    
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      setState(prev => ({
        ...prev,
        reconnectAttempts: prev.reconnectAttempts + 1
      }));
      connect();
    }, delay);
  };

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      isConnected: false
    }));
  };

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [workspaceId, userId]);

  return {
    state,
    connect,
    disconnect
  };
}
`;
  }

  /**
   * Validate SSE configuration
   */
  validateConfig(config: SSEClientConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.reconnectInterval < 100) {
      errors.push('Reconnect interval must be at least 100ms');
    }

    if (config.maxReconnectAttempts < 1) {
      errors.push('Max reconnect attempts must be at least 1');
    }

    if (config.heartbeatTimeout < 5000) {
      errors.push('Heartbeat timeout must be at least 5 seconds');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}


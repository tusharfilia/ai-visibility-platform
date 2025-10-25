/**
 * Copilot executor with plugin architecture
 * Executes actions via CMS/CRM integrations
 */

import { CopilotAction, CopilotActionType, CopilotActionStatus, AuditLog } from '@ai-visibility/shared';
import { ProposedAction } from './planner';

export interface ExecutionContext {
  workspaceId: string;
  userId?: string;
  targetUrl: string;
  actionType: CopilotActionType;
  diff: string;
  metadata: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  actionId: string;
  status: CopilotActionStatus;
  error?: string;
  executionTime: number;
  auditLog: AuditLog;
}

export interface CmsPlugin {
  name: string;
  version: string;
  supportedActions: CopilotActionType[];
  
  execute(context: ExecutionContext): Promise<ExecutionResult>;
  testConnection(): Promise<boolean>;
  getCapabilities(): string[];
}

export interface PluginRegistry {
  register(plugin: CmsPlugin): void;
  unregister(name: string): void;
  get(name: string): CmsPlugin | undefined;
  getAll(): CmsPlugin[];
  getForAction(actionType: CopilotActionType): CmsPlugin[];
}

export class CopilotExecutor {
  private plugins: Map<string, CmsPlugin> = new Map();
  private auditLogs: AuditLog[] = [];

  constructor() {
    this.registerDefaultPlugins();
  }

  /**
   * Execute a proposed action
   */
  async executeAction(
    proposedAction: ProposedAction,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Find appropriate plugin
      const plugin = this.findPluginForAction(proposedAction.actionType);
      if (!plugin) {
        throw new Error(`No plugin found for action type: ${proposedAction.actionType}`);
      }
      
      // Test plugin connection
      const isConnected = await plugin.testConnection();
      if (!isConnected) {
        throw new Error(`Plugin ${plugin.name} connection failed`);
      }
      
      // Execute action
      const result = await plugin.execute(context);
      
      // Record audit log
      const auditLog: AuditLog = {
        id: `audit_${Date.now()}`,
        workspaceId: context.workspaceId,
        actorUserId: context.userId,
        action: `EXECUTE_${proposedAction.actionType}`,
        payload: {
          targetUrl: context.targetUrl,
          plugin: plugin.name,
          result: result.success,
          executionTime: result.executionTime,
        },
        createdAt: new Date(),
      };
      
      this.auditLogs.push(auditLog);
      
      return {
        ...result,
        executionTime: Date.now() - startTime,
        auditLog,
      };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Record error in audit log
      const auditLog: AuditLog = {
        id: `audit_${Date.now()}`,
        workspaceId: context.workspaceId,
        actorUserId: context.userId,
        action: `EXECUTE_${proposedAction.actionType}_ERROR`,
        payload: {
          targetUrl: context.targetUrl,
          error: errorMessage,
          executionTime,
        },
        createdAt: new Date(),
      };
      
      this.auditLogs.push(auditLog);
      
      return {
        success: false,
        actionId: `action_${Date.now()}`,
        status: CopilotActionStatus.FAILED,
        error: errorMessage,
        executionTime,
        auditLog,
      };
    }
  }

  /**
   * Register a plugin
   */
  registerPlugin(plugin: CmsPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Unregister a plugin
   */
  unregisterPlugin(name: string): void {
    this.plugins.delete(name);
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): CmsPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): CmsPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins for action type
   */
  getPluginsForAction(actionType: CopilotActionType): CmsPlugin[] {
    return Array.from(this.plugins.values())
      .filter(plugin => plugin.supportedActions.includes(actionType));
  }

  /**
   * Find plugin for action type
   */
  private findPluginForAction(actionType: CopilotActionType): CmsPlugin | undefined {
    const plugins = this.getPluginsForAction(actionType);
    return plugins[0]; // Return first available plugin
  }

  /**
   * Register default plugins
   */
  private registerDefaultPlugins(): void {
    // WordPress plugin
    this.registerPlugin(new WordPressPlugin());
    
    // Webflow plugin
    this.registerPlugin(new WebflowPlugin());
    
    // Notion plugin
    this.registerPlugin(new NotionPlugin());
  }

  /**
   * Get audit logs
   */
  getAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }

  /**
   * Clear audit logs
   */
  clearAuditLogs(): void {
    this.auditLogs = [];
  }
}

/**
 * WordPress plugin implementation
 */
class WordPressPlugin implements CmsPlugin {
  name = 'wordpress';
  version = '1.0.0';
  supportedActions = [
    CopilotActionType.ADD_FAQ,
    CopilotActionType.ADD_TLDR,
    CopilotActionType.ADD_CITATIONS,
    CopilotActionType.FIX_SCHEMA,
  ];

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    // Simulate WordPress API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      actionId: `wp_${Date.now()}`,
      status: CopilotActionStatus.EXECUTED,
      executionTime: 1000,
      auditLog: {
        id: `audit_${Date.now()}`,
        workspaceId: context.workspaceId,
        actorUserId: context.userId,
        action: 'WORDPRESS_EXECUTE',
        payload: { actionType: context.actionType, targetUrl: context.targetUrl },
        createdAt: new Date(),
      },
    };
  }

  async testConnection(): Promise<boolean> {
    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  }

  getCapabilities(): string[] {
    return ['content-update', 'schema-markup', 'seo-optimization'];
  }
}

/**
 * Webflow plugin implementation
 */
class WebflowPlugin implements CmsPlugin {
  name = 'webflow';
  version = '1.0.0';
  supportedActions = [
    CopilotActionType.ADD_FAQ,
    CopilotActionType.ADD_TLDR,
    CopilotActionType.FIX_SCHEMA,
  ];

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    // Simulate Webflow API call
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    return {
      success: true,
      actionId: `wf_${Date.now()}`,
      status: CopilotActionStatus.EXECUTED,
      executionTime: 1200,
      auditLog: {
        id: `audit_${Date.now()}`,
        workspaceId: context.workspaceId,
        actorUserId: context.userId,
        action: 'WEBFLOW_EXECUTE',
        payload: { actionType: context.actionType, targetUrl: context.targetUrl },
        createdAt: new Date(),
      },
    };
  }

  async testConnection(): Promise<boolean> {
    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 600));
    return true;
  }

  getCapabilities(): string[] {
    return ['content-update', 'schema-markup', 'design-sync'];
  }
}

/**
 * Notion plugin implementation
 */
class NotionPlugin implements CmsPlugin {
  name = 'notion';
  version = '1.0.0';
  supportedActions = [
    CopilotActionType.ADD_FAQ,
    CopilotActionType.ADD_TLDR,
    CopilotActionType.REVIEW_CAMPAIGN,
  ];

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    // Simulate Notion API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
      success: true,
      actionId: `notion_${Date.now()}`,
      status: CopilotActionStatus.EXECUTED,
      executionTime: 800,
      auditLog: {
        id: `audit_${Date.now()}`,
        workspaceId: context.workspaceId,
        actorUserId: context.userId,
        action: 'NOTION_EXECUTE',
        payload: { actionType: context.actionType, targetUrl: context.targetUrl },
        createdAt: new Date(),
      },
    };
  }

  async testConnection(): Promise<boolean> {
    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 400));
    return true;
  }

  getCapabilities(): string[] {
    return ['content-update', 'collaboration', 'document-management'];
  }
}

/**
 * Create executor instance
 */
export function createExecutor(): CopilotExecutor {
  return new CopilotExecutor();
}

/**
 * Get default executor
 */
export const defaultExecutor = new CopilotExecutor();

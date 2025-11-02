import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Redis } from 'ioredis';

export interface WhiteLabelConfig {
  id: string;
  clientId: string;
  clientName: string;
  domain: string;
  branding: {
    logo: string;
    favicon: string;
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    customCss?: string;
  };
  features: {
    customDomain: boolean;
    customEmail: boolean;
    customReports: boolean;
    customIntegrations: boolean;
    apiAccess: boolean;
    sso: boolean;
  };
  limits: {
    maxWorkspaces: number;
    maxUsers: number;
    maxApiCalls: number;
    maxStorage: number; // GB
  };
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  clientId: string;
  name: string;
  key: string;
  secret: string;
  permissions: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  status: 'active' | 'inactive' | 'revoked';
  lastUsed?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ApiUsage {
  keyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  workspaceId?: string;
  userId?: string;
}

export interface MarketplaceApp {
  id: string;
  name: string;
  description: string;
  version: string;
  category: 'integration' | 'automation' | 'analytics' | 'reporting';
  developer: {
    name: string;
    email: string;
    website?: string;
  };
  pricing: {
    model: 'free' | 'freemium' | 'paid' | 'enterprise';
    price?: number;
    currency?: string;
    billingCycle?: 'monthly' | 'yearly';
  };
  features: string[];
  screenshots: string[];
  documentation: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended';
  downloads: number;
  rating: number;
  reviews: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketplaceInstallation {
  id: string;
  appId: string;
  workspaceId: string;
  userId: string;
  status: 'installing' | 'installed' | 'failed' | 'uninstalled';
  config: Record<string, any>;
  installedAt: Date;
  uninstalledAt?: Date;
}

@Injectable()
export class WhiteLabelService {
  private redis: Redis;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  /**
   * Create white-label configuration
   */
  async createWhiteLabelConfig(config: Omit<WhiteLabelConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<WhiteLabelConfig> {
    const whiteLabelConfig: WhiteLabelConfig = {
      ...config,
      id: this.generateConfigId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.redis.hset(
      'whitelabel:configs',
      whiteLabelConfig.id,
      JSON.stringify(whiteLabelConfig)
    );

    this.eventEmitter.emit('whitelabel.config.created', {
      configId: whiteLabelConfig.id,
      clientId: whiteLabelConfig.clientId,
    });

    return whiteLabelConfig;
  }

  /**
   * Get white-label configuration
   */
  async getWhiteLabelConfig(configId: string): Promise<WhiteLabelConfig | null> {
    const data = await this.redis.hget('whitelabel:configs', configId);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get white-label configuration by client ID
   */
  async getWhiteLabelConfigByClient(clientId: string): Promise<WhiteLabelConfig | null> {
    const configs = await this.redis.hgetall('whitelabel:configs');
    
    for (const data of Object.values(configs)) {
      const config: WhiteLabelConfig = JSON.parse(data);
      if (config.clientId === clientId) {
        return config;
      }
    }
    
    return null;
  }

  /**
   * Update white-label configuration
   */
  async updateWhiteLabelConfig(
    configId: string,
    updates: Partial<WhiteLabelConfig>
  ): Promise<WhiteLabelConfig | null> {
    const data = await this.redis.hget('whitelabel:configs', configId);
    if (!data) return null;

    const config: WhiteLabelConfig = JSON.parse(data);
    const updatedConfig = {
      ...config,
      ...updates,
      updatedAt: new Date(),
    };

    await this.redis.hset(
      'whitelabel:configs',
      configId,
      JSON.stringify(updatedConfig)
    );

    this.eventEmitter.emit('whitelabel.config.updated', {
      configId,
      updates,
    });

    return updatedConfig;
  }

  /**
   * Validate white-label domain
   */
  async validateDomain(domain: string): Promise<{ valid: boolean; message?: string }> {
    // Check if domain is already in use
    const configs = await this.redis.hgetall('whitelabel:configs');
    
    for (const data of Object.values(configs)) {
      const config: WhiteLabelConfig = JSON.parse(data);
      if (config.domain === domain && config.status === 'active') {
        return { valid: false, message: 'Domain is already in use' };
      }
    }

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return { valid: false, message: 'Invalid domain format' };
    }

    return { valid: true };
  }

  /**
   * Generate white-label CSS
   */
  generateWhiteLabelCSS(config: WhiteLabelConfig): string {
    return `
      :root {
        --primary-color: ${config.branding.primaryColor};
        --secondary-color: ${config.branding.secondaryColor};
        --font-family: ${config.branding.fontFamily};
      }
      
      .whitelabel-logo {
        background-image: url('${config.branding.logo}');
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
      }
      
      .whitelabel-primary {
        background-color: ${config.branding.primaryColor};
        color: white;
      }
      
      .whitelabel-secondary {
        background-color: ${config.branding.secondaryColor};
        color: white;
      }
      
      body {
        font-family: ${config.branding.fontFamily}, sans-serif;
      }
      
      ${config.branding.customCss || ''}
    `;
  }

  /**
   * Generate unique config ID
   */
  private generateConfigId(): string {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

@Injectable()
export class ApiMarketplaceService {
  private redis: Redis;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  /**
   * Generate API key
   */
  async generateApiKey(
    clientId: string,
    name: string,
    permissions: string[],
    rateLimit: { requestsPerMinute: number; requestsPerDay: number }
  ): Promise<ApiKey> {
    const apiKey: ApiKey = {
      id: this.generateApiKeyId(),
      clientId,
      name,
      key: this.generateApiKeyString(),
      secret: this.generateApiSecretString(),
      permissions,
      rateLimit,
      status: 'active',
      createdAt: new Date(),
    };

    await this.redis.hset(
      `api:keys:${clientId}`,
      apiKey.id,
      JSON.stringify(apiKey)
    );

    this.eventEmitter.emit('api.key.generated', {
      keyId: apiKey.id,
      clientId,
      name,
    });

    return apiKey;
  }

  /**
   * Validate API key
   */
  async validateApiKey(key: string): Promise<{ valid: boolean; apiKey?: ApiKey; message?: string }> {
    // Search through all client API keys
    const clientKeys = await this.redis.keys('api:keys:*');
    
    for (const clientKey of clientKeys) {
      const keys = await this.redis.hgetall(clientKey);
      
      for (const data of Object.values(keys)) {
        const apiKey: ApiKey = JSON.parse(data);
        if (apiKey.key === key && apiKey.status === 'active') {
          // Check expiration
          if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            return { valid: false, message: 'API key has expired' };
          }
          
          return { valid: true, apiKey };
        }
      }
    }
    
    return { valid: false, message: 'Invalid API key' };
  }

  /**
   * Record API usage
   */
  async recordApiUsage(usage: Omit<ApiUsage, 'timestamp'>): Promise<void> {
    const timestampedUsage: ApiUsage = {
      ...usage,
      timestamp: new Date(),
    };

    const key = `api:usage:${usage.keyId}:${Date.now()}`;
    await this.redis.setex(key, 86400 * 30, JSON.stringify(timestampedUsage)); // 30 days TTL

    // Update API key last used
    await this.updateApiKeyLastUsed(usage.keyId);

    this.eventEmitter.emit('api.usage.recorded', {
      keyId: usage.keyId,
      endpoint: usage.endpoint,
      statusCode: usage.statusCode,
    });
  }

  /**
   * Get API usage statistics
   */
  async getApiUsageStats(
    keyId: string,
    startTime: Date,
    endTime: Date
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    endpoints: Record<string, number>;
  }> {
    const pattern = `api:usage:${keyId}:*`;
    const keys = await this.redis.keys(pattern);
    
    const usages: ApiUsage[] = [];
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const usage: ApiUsage = JSON.parse(data);
        if (usage.timestamp >= startTime && usage.timestamp <= endTime) {
          usages.push(usage);
        }
      }
    }

    const totalRequests = usages.length;
    const successfulRequests = usages.filter(u => u.statusCode >= 200 && u.statusCode < 300).length;
    const failedRequests = totalRequests - successfulRequests;
    const averageResponseTime = usages.length > 0 
      ? usages.reduce((sum, u) => sum + u.responseTime, 0) / usages.length 
      : 0;

    const endpoints: Record<string, number> = {};
    usages.forEach(usage => {
      const endpoint = `${usage.method} ${usage.endpoint}`;
      endpoints[endpoint] = (endpoints[endpoint] || 0) + 1;
    });

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: Math.round(averageResponseTime),
      endpoints,
    };
  }

  /**
   * Create marketplace app
   */
  async createMarketplaceApp(app: Omit<MarketplaceApp, 'id' | 'downloads' | 'rating' | 'reviews' | 'createdAt' | 'updatedAt'>): Promise<MarketplaceApp> {
    const marketplaceApp: MarketplaceApp = {
      ...app,
      id: this.generateAppId(),
      downloads: 0,
      rating: 0,
      reviews: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.redis.hset(
      'marketplace:apps',
      marketplaceApp.id,
      JSON.stringify(marketplaceApp)
    );

    this.eventEmitter.emit('marketplace.app.created', {
      appId: marketplaceApp.id,
      developer: marketplaceApp.developer.name,
    });

    return marketplaceApp;
  }

  /**
   * Get marketplace apps
   */
  async getMarketplaceApps(category?: string, status?: string): Promise<MarketplaceApp[]> {
    const appsData = await this.redis.hgetall('marketplace:apps');
    let apps = Object.values(appsData).map(data => JSON.parse(data));

    if (category) {
      apps = apps.filter(app => app.category === category);
    }

    if (status) {
      apps = apps.filter(app => app.status === status);
    }

    return apps.sort((a, b) => b.downloads - a.downloads);
  }

  /**
   * Install marketplace app
   */
  async installMarketplaceApp(
    appId: string,
    workspaceId: string,
    userId: string,
    config: Record<string, any> = {}
  ): Promise<MarketplaceInstallation> {
    const installation: MarketplaceInstallation = {
      id: this.generateInstallationId(),
      appId,
      workspaceId,
      userId,
      status: 'installing',
      config,
      installedAt: new Date(),
    };

    await this.redis.hset(
      `marketplace:installations:${workspaceId}`,
      installation.id,
      JSON.stringify(installation)
    );

    // Simulate installation process
    setTimeout(async () => {
      installation.status = 'installed';
      await this.redis.hset(
        `marketplace:installations:${workspaceId}`,
        installation.id,
        JSON.stringify(installation)
      );

      // Update app download count
      await this.updateAppDownloadCount(appId);

      this.eventEmitter.emit('marketplace.app.installed', {
        appId,
        workspaceId,
        userId,
        installationId: installation.id,
      });
    }, 2000);

    return installation;
  }

  /**
   * Get workspace app installations
   */
  async getWorkspaceInstallations(workspaceId: string): Promise<MarketplaceInstallation[]> {
    const installationsData = await this.redis.hgetall(`marketplace:installations:${workspaceId}`);
    return Object.values(installationsData).map(data => JSON.parse(data));
  }

  /**
   * Private helper methods
   */
  private async updateApiKeyLastUsed(keyId: string): Promise<void> {
    const clientKeys = await this.redis.keys('api:keys:*');
    
    for (const clientKey of clientKeys) {
      const keys = await this.redis.hgetall(clientKey);
      
      for (const [id, data] of Object.entries(keys)) {
        const apiKey: ApiKey = JSON.parse(data);
        if (apiKey.id === keyId) {
          apiKey.lastUsed = new Date();
          await this.redis.hset(clientKey, id, JSON.stringify(apiKey));
          break;
        }
      }
    }
  }

  private async updateAppDownloadCount(appId: string): Promise<void> {
    const data = await this.redis.hget('marketplace:apps', appId);
    if (data) {
      const app: MarketplaceApp = JSON.parse(data);
      app.downloads++;
      app.updatedAt = new Date();
      
      await this.redis.hset('marketplace:apps', appId, JSON.stringify(app));
    }
  }

  private generateConfigId(): string {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateApiKeyId(): string {
    return `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateApiKeyString(): string {
    return `ak_${Math.random().toString(36).substr(2, 32)}`;
  }

  private generateApiSecretString(): string {
    return `as_${Math.random().toString(36).substr(2, 64)}`;
  }

  private generateAppId(): string {
    return `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateInstallationId(): string {
    return `install_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}


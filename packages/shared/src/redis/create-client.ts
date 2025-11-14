import Redis, { RedisOptions } from 'ioredis';

export function redisRequiresTls(redisUrl: string): boolean {
  if (redisUrl.startsWith('rediss://')) {
    return true;
  }

  if (process.env.REDIS_TLS === 'true') {
    return true;
  }

  try {
    const hostname = new URL(redisUrl).hostname;
    if (
      hostname.endsWith('.railway.app') ||
      hostname.endsWith('.up.railway.app') ||
      hostname.endsWith('.proxy.rlwy.net')
    ) {
      return true;
    }
  } catch (error) {
    console.warn('[Redis] Failed to parse REDIS_URL while checking TLS requirement:', (error as Error).message);
  }

  return false;
}

export function createRedisClient(label: string, overrides: RedisOptions = {}): Redis {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error(`[${label}] REDIS_URL is not configured`);
  }

  const options: RedisOptions = {
    // Connection timeout (default is 10s, increase for Railway network latency)
    connectTimeout: 60000, // 60 seconds
    // Retry strategy for reconnection
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      console.log(`[Redis] ${label} retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    // Maximum retries per request
    maxRetriesPerRequest: 3,
    // Enable ready check
    enableReadyCheck: true,
    // Retry delay on failover
    retryDelayOnFailover: 100,
    // Lazy connect - don't connect immediately, wait for first command
    lazyConnect: false,
    // Keep alive
    keepAlive: 30000,
    ...overrides,
  };

  if (redisRequiresTls(redisUrl)) {
    options.tls = {
      rejectUnauthorized: false,
      ...(overrides.tls ?? {}),
    };
  }

  try {
    const parsed = new URL(redisUrl);
    const endpoint = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
    console.log(`[Redis] ${label} using endpoint ${endpoint} (tls=${Boolean(options.tls)}, timeout=${options.connectTimeout}ms)`);
  } catch (error) {
    console.warn(`[Redis] ${label} failed to parse REDIS_URL for logging:`, (error as Error).message);
  }

  const client = new Redis(redisUrl, options);

  // Add error handlers for better debugging
  client.on('error', (err: Error) => {
    console.error(`[Redis] ${label} connection error:`, err.message);
  });

  client.on('connect', () => {
    console.log(`[Redis] ${label} connected successfully`);
  });

  client.on('ready', () => {
    console.log(`[Redis] ${label} ready to accept commands`);
  });

  client.on('close', () => {
    console.warn(`[Redis] ${label} connection closed`);
  });

  return client;
}


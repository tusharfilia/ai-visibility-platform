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

  const options: RedisOptions = { ...overrides };

  if (redisRequiresTls(redisUrl)) {
    options.tls = {
      rejectUnauthorized: false,
      ...(overrides.tls ?? {}),
    };
  }

  try {
    const parsed = new URL(redisUrl);
    const endpoint = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
    console.log(`[Redis] ${label} using endpoint ${endpoint} (tls=${Boolean(options.tls)})`);
  } catch (error) {
    console.warn(`[Redis] ${label} failed to parse REDIS_URL for logging:`, (error as Error).message);
  }

  return new Redis(redisUrl, options);
}


import Redis, { RedisOptions } from 'ioredis';

export function redisRequiresTls(redisUrl: string): boolean {
  if (redisUrl.startsWith('rediss://')) {
    return true;
  }

  if (process.env.REDIS_TLS === 'true') {
    return true;
  }

  return redisUrl.includes('.proxy.rlwy.net');
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

  return new Redis(redisUrl, options);
}


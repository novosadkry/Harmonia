import Redis from 'ioredis';

const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

const globalForRedis = globalThis as unknown as { redis?: Redis; redisSub?: Redis };

export const redis: Redis =
  globalForRedis.redis ??
  new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });

export function createSubscriber(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
}

if (process.env['NODE_ENV'] !== 'production') globalForRedis.redis = redis;

import Redis from 'ioredis'

export const RATE_LIMIT_REDIS = 'RateLimitRedis'

export function creerClientRedisRateLimit(url: string): Redis {
  return new Redis(url, {
    keyPrefix: 'connect:',
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0
  })
}

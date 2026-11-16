import Redis from 'ioredis'

export const RATE_LIMIT_REDIS = 'RateLimitRedis'

export function creerClientRedisRateLimit(url: string): Redis {
  const client = new Redis(url, {
    keyPrefix: 'connect:',
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0
  })
  // Sans listener, ioredis écrit chaque erreur de reconnexion sur la console.
  // Les échecs sont déjà logués (1/min) par RateLimitRedisStorage, en fail-open.
  client.on('error', () => undefined)
  return client
}

import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import { Redis } from 'ioredis'
import { RedisInjectionToken } from './redis.provider'

@Injectable()
export class RedisClient implements OnModuleDestroy {
  constructor(@Inject(RedisInjectionToken) private readonly redis: Redis) {}

  onModuleDestroy(): void {
    this.redis.disconnect()
  }

  async get(prefix: string, key: string): Promise<string | null> {
    return this.redis.get(`${prefix}:${key}`)
  }

  async set(prefix: string, key: string, value: string): Promise<void> {
    await this.redis.set(`${prefix}:${key}`, value)
  }

  async delete(prefix: string, key: string): Promise<void> {
    await this.redis.del(`${prefix}:${key}`)
  }

  async deletePattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(`*${pattern}*`)
    for (const key of keys) {
      await this.redis.del(key.replace('oidc:', ''))
    }
  }

  // ioredis applique le keyPrefix 'oidc:' aux commandes mais SCAN renvoie les clés
  // complètes (avec le préfixe). On le retire pour que les helpers *Raw ci-dessous,
  // qui passent par les commandes ioredis, ne le ré-ajoutent pas en double.
  async scanKeys(match: string): Promise<string[]> {
    const found: string[] = []
    let cursor = '0'
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        match,
        'COUNT',
        100
      )
      cursor = nextCursor
      for (const key of keys) {
        found.push(key.replace('oidc:', ''))
      }
    } while (cursor !== '0')
    return found
  }

  async hgetAllRaw(key: string): Promise<Record<string, string>> {
    return this.redis.hgetall(key)
  }

  async delRaw(key: string): Promise<void> {
    await this.redis.del(key)
  }

  async setWithExpiry(
    prefix: string,
    key: string,
    value: string,
    expiryInSeconds: number
  ): Promise<void> {
    const redisExpiryOption = 'EX'
    await this.redis.set(
      `${prefix}:${key}`,
      value,
      redisExpiryOption,
      expiryInSeconds
    )
  }

  async acquireLock(key: string, value: string): Promise<boolean> {
    const lockExpiryInSeconds = 30
    const redisExpiryOption = 'EX'
    const redisSetOnlyIfNotExistingOption = 'NX'
    const result = await this.redis.set(
      key,
      value,
      redisExpiryOption,
      lockExpiryInSeconds,
      redisSetOnlyIfNotExistingOption
    )
    return result === 'OK'
  }

  async releaseLock(key: string, lockId: string): Promise<void> {
    const currentValue = await this.redis.get(key)
    if (currentValue === lockId) {
      await this.redis.del(key)
    }
  }
}

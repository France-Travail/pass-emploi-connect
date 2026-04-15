import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { Redis } from 'ioredis'
import { RedisInjectionToken } from './redis.provider.js'

@Injectable()
export class RedisClient implements OnModuleDestroy {
  private readonly logger: Logger

  constructor(@Inject(RedisInjectionToken) private readonly redis: Redis) {
    this.logger = new Logger('RedisClient')
  }

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

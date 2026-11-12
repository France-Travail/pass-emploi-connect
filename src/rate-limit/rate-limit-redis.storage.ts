import { Injectable, Inject } from '@nestjs/common'
import { ThrottlerStorage } from '@nestjs/throttler'
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface'
import { Redis } from 'ioredis'
import { RedisInjectionToken } from '../redis/redis.provider'
import { rootLogger, toEcsError } from '../utils/monitoring/logger.module'

const REDIS_TIMEOUT_MS = 200
const LOG_THROTTLE_MS = 60000

@Injectable()
export class RateLimitRedisStorage implements ThrottlerStorage {
  private lastErrorLog = 0

  constructor(@Inject(RedisInjectionToken) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    _throttlerName: string
  ): Promise<ThrottlerStorageRecord> {
    try {
      const result = await Promise.race([
        this.redisIncrement(key, ttl),
        this.timeout()
      ])

      if (result === null) {
        this.logError(new Error('Redis timeout after 200ms'))
        return this.neutralRecord()
      }

      const [totalHits, timeToExpireMs] = result
      const timeToExpire = Math.ceil(timeToExpireMs / 1000)

      return {
        totalHits,
        timeToExpire,
        isBlocked: totalHits > limit,
        timeToBlockExpire: timeToExpire
      }
    } catch (error) {
      this.logError(error)
      return this.neutralRecord()
    }
  }

  private async redisIncrement(
    key: string,
    ttl: number
  ): Promise<[number, number]> {
    const results = await this.redis
      .multi()
      .incr(key)
      .pexpire(key, ttl, 'NX')
      .pttl(key)
      .exec()

    if (!results) {
      throw new Error('Redis multi exec returned null')
    }

    const totalHits = results[0]?.[1] as number
    const ttlResult = results[2]?.[1] as number

    return [totalHits, ttlResult]
  }

  private timeout(): Promise<null> {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(null), REDIS_TIMEOUT_MS)
      timer.unref()
    })
  }

  private neutralRecord(): ThrottlerStorageRecord {
    return {
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0
    }
  }

  private logError(error: unknown): void {
    const now = Date.now()
    if (now - this.lastErrorLog >= LOG_THROTTLE_MS) {
      this.lastErrorLog = now
      rootLogger.error(
        {
          context: 'RateLimitRedisStorage',
          event: { action: 'rate_limit_storage_failed', outcome: 'failure' },
          error: toEcsError(error)
        },
        'rate_limit_storage_failed'
      )
    }
  }
}

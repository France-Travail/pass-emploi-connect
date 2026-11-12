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
    let timeoutHandle: NodeJS.Timeout | undefined
    try {
      const result = await Promise.race([
        this.redisIncrement(key, ttl),
        this.timeout().then(timer => {
          timeoutHandle = timer
          return null
        })
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
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
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

    const [incrErr, totalHits] = results[0] ?? []
    const [pttlErr, ttlResult] = results[2] ?? []

    if (incrErr) {
      throw incrErr
    }
    if (pttlErr) {
      throw pttlErr
    }
    if (typeof totalHits !== 'number' || typeof ttlResult !== 'number') {
      throw new Error(
        `Invalid Redis response: totalHits=${totalHits}, ttl=${ttlResult}`
      )
    }

    return [totalHits, ttlResult]
  }

  private timeout(): Promise<NodeJS.Timeout> {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(timer), REDIS_TIMEOUT_MS)
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

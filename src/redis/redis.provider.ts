import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { rootLogger, toEcsError } from '../utils/monitoring/logger.module'
import { getAPMInstance } from '../utils/monitoring/apm.init'

export const RedisInjectionToken = 'RedisClient'

export const RedisProvider = {
  provide: RedisInjectionToken,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService): Promise<Redis> => {
    const redisUrl = configService.get<string>('redis.url')!
    const redisInstance = new Redis(redisUrl, {
      keyPrefix: 'oidc:',
      lazyConnect: true
    })
    const apmService = getAPMInstance()

    try {
      rootLogger.info({ context: 'Redis' }, 'redis_connecting')
      await redisInstance.connect()
      redisInstance.on('error', e => {
        rootLogger.error(
          { context: 'Redis', error: toEcsError(e) },
          'redis_error'
        )
        throw new Error(`Redis error: ${e}`)
      })
      rootLogger.info({ context: 'Redis' }, 'redis_connected')
      return redisInstance
    } catch (e) {
      rootLogger.error(
        { context: 'Redis', error: toEcsError(e) },
        'redis_connection_failed'
      )
      apmService.captureError(e instanceof Error ? e : new Error(String(e)))
      throw e
    }
  }
}

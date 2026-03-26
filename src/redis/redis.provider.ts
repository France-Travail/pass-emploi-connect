import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { buildError } from '../utils/monitoring/logger.module'
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
    const logger = new Logger('Redis')
    const apmService = getAPMInstance()

    try {
      logger.log('Connecting to Redis')
      await redisInstance.connect()
      redisInstance.on('error', e => {
        logger.error(buildError('Redis error', e))
        throw new Error(`Redis error: ${e}`)
      })
      logger.log('Connection with the Redis is OK')
      return redisInstance
    } catch (e) {
      logger.error(buildError('Error connecting to the Redis', e))
      apmService.captureError(e instanceof Error ? e : new Error(String(e)))
      throw e
    }
  }
}

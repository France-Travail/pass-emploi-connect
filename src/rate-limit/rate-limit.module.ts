import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import Redis from 'ioredis'
import { lireClientsServeur } from './client-serveur'
import {
  lireRateLimitConfig,
  RATE_LIMIT_CONFIG,
  RateLimitConfig
} from './rate-limit.config'
import {
  creerClientRedisRateLimit,
  RATE_LIMIT_REDIS
} from './rate-limit-redis.client'
import { RateLimitRedisStorage } from './rate-limit-redis.storage'
import { creerThrottlers } from './rate-limit.throttlers'

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RATE_LIMIT_CONFIG,
      inject: [ConfigService],
      useFactory: lireRateLimitConfig
    },
    {
      provide: RATE_LIMIT_REDIS,
      inject: [RATE_LIMIT_CONFIG],
      useFactory: (config: RateLimitConfig | undefined): Redis | undefined =>
        config && creerClientRedisRateLimit(config.redisUrl)
    }
  ],
  exports: [RATE_LIMIT_CONFIG, RATE_LIMIT_REDIS]
})
class RateLimitConfigModule {}

@Module({
  imports: [
    RateLimitConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [RateLimitConfigModule, ConfigModule],
      inject: [RATE_LIMIT_CONFIG, RATE_LIMIT_REDIS, ConfigService],
      useFactory: (
        config: RateLimitConfig | undefined,
        redis: Redis | undefined,
        configService: ConfigService
      ) =>
        config && redis
          ? {
              storage: new RateLimitRedisStorage(redis),
              throttlers: creerThrottlers(
                config,
                lireClientsServeur(configService)
              )
            }
          : { throttlers: [] }
    })
  ],
  exports: [RateLimitConfigModule]
})
export class RateLimitModule {}

import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { RedisProvider } from '../redis/redis.provider'
import {
  lireRateLimitConfig,
  RATE_LIMIT_CONFIG,
  RateLimitConfig
} from './rate-limit.config'
import { RateLimitRedisStorage } from './rate-limit-redis.storage'
import { lireClientsServeur } from './client-serveur'
import { creerThrottlers } from './rate-limit.throttlers'

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RATE_LIMIT_CONFIG,
      inject: [ConfigService],
      useFactory: lireRateLimitConfig
    },
    RedisProvider,
    RateLimitRedisStorage
  ],
  exports: [RATE_LIMIT_CONFIG, RateLimitRedisStorage]
})
class RateLimitConfigModule {}

@Module({
  imports: [
    RateLimitConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [RateLimitConfigModule, ConfigModule],
      inject: [RATE_LIMIT_CONFIG, RateLimitRedisStorage, ConfigService],
      useFactory: (
        config: RateLimitConfig | undefined,
        storage: RateLimitRedisStorage,
        configService: ConfigService
      ) => ({
        storage,
        throttlers: creerThrottlers(config, lireClientsServeur(configService))
      })
    })
  ],
  exports: [RateLimitConfigModule]
})
export class RateLimitModule {}

import { Module } from '@nestjs/common'

import { ConfigModule } from '@nestjs/config'
import { RedisClient } from '../redis/redis.client.js'
import { RedisProvider } from '../redis/redis.provider.js'
import { DateService } from '../utils/date.service.js'
import { GetAccessTokenUsecase } from './get-access-token.usecase.js'
import { TokenService } from './token.service.js'
import { ValidateJWTUsecase } from './verify-jwt.usecase.js'

@Module({
  imports: [ConfigModule],
  providers: [
    RedisProvider,
    RedisClient,
    TokenService,
    ValidateJWTUsecase,
    GetAccessTokenUsecase,
    DateService
  ],
  exports: [
    RedisProvider,
    TokenService,
    ValidateJWTUsecase,
    GetAccessTokenUsecase
  ]
})
export class TokenModule {}

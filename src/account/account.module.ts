import { Module } from '@nestjs/common'

import { ConfigModule } from '@nestjs/config'
import { RedisClient } from '../redis/redis.client.js'
import { DateService } from '../utils/date.service.js'
import { DeleteAccountUsecase } from './delete-account.usecase.js'
import { RedisProvider } from '../redis/redis.provider.js'

@Module({
  imports: [ConfigModule],
  providers: [DeleteAccountUsecase, DateService, RedisProvider, RedisClient],
  exports: [DeleteAccountUsecase]
})
export class AccountModule {}

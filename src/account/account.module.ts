import { Module } from '@nestjs/common'

import { ConfigModule } from '@nestjs/config'
import { OidcModule } from '../oidc-provider/oidc.module'
import { RedisClient } from '../redis/redis.client'
import { DateService } from '../utils/date.service'
import { DeleteAccountUsecase } from './delete-account.usecase'
import { RedisProvider } from '../redis/redis.provider'

@Module({
  imports: [ConfigModule, OidcModule],
  providers: [DeleteAccountUsecase, DateService, RedisProvider, RedisClient],
  exports: [DeleteAccountUsecase]
})
export class AccountModule {}

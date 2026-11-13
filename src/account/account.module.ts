import { Module } from '@nestjs/common'

import { ConfigModule } from '@nestjs/config'
import { OidcModule } from '../oidc-provider/oidc.module'
import { RedisClient } from '../redis/redis.client'
import { DateService } from '../utils/date.service'
import { DeleteAccountUsecase } from './delete-account.usecase'
import { RedisProvider } from '../redis/redis.provider'
import { RevoquerTokensIdpUsecase } from './revoquer-tokens-idp.usecase'
import { TokenService } from '../token/token.service'

@Module({
  imports: [ConfigModule, OidcModule],
  providers: [
    DeleteAccountUsecase,
    RevoquerTokensIdpUsecase,
    TokenService,
    DateService,
    RedisProvider,
    RedisClient
  ],
  exports: [DeleteAccountUsecase, RevoquerTokensIdpUsecase]
})
export class AccountModule {}

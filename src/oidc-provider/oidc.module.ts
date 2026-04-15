import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TokenModule } from '../token/token.module.js'
import { OidcController } from './oidc.controller.js'
import { OidcService } from './oidc.service.js'
import { OidcProviderModuleProvider } from './provider.js'
import { TokenExchangeGrant } from './token-exchange.grant.js'
import { APIModule } from '../api/api.module.js'

@Module({
  imports: [ConfigModule, TokenModule, APIModule],
  providers: [OidcService, OidcProviderModuleProvider, TokenExchangeGrant],
  exports: [OidcService, TokenExchangeGrant],
  controllers: [OidcController]
})
export class OidcModule {}

import { Module } from '@nestjs/common'

import { ConfigModule } from '@nestjs/config'
import { APIModule } from '../../api/api.module'
import { OidcModule } from '../../oidc-provider/oidc.module'
import { InviteController } from './invite.controller'
import { InviteService } from './invite.service'

// Pas de TokenModule : l'invité n'a pas d'IDP, donc aucun token IDP à stocker.
@Module({
  imports: [ConfigModule, OidcModule, APIModule],
  providers: [InviteService],
  exports: [],
  controllers: [InviteController]
})
export class InviteModule {}

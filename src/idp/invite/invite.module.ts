import { Module } from '@nestjs/common'

import { ConfigModule } from '@nestjs/config'
import { APIModule } from '../../api/api.module'
import { OidcModule } from '../../oidc-provider/oidc.module'
import { InviteController } from './invite.controller'
import { InviteService } from './invite.service'

@Module({
  imports: [ConfigModule, OidcModule, APIModule],
  providers: [InviteService],
  exports: [],
  controllers: [InviteController]
})
export class InviteModule {}

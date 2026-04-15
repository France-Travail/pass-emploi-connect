import { Module } from '@nestjs/common'

import { ConfigModule } from '@nestjs/config'
import { APIModule } from '../../api/api.module.js'
import { OidcModule } from '../../oidc-provider/oidc.module.js'
import { TokenModule } from '../../token/token.module.js'
import { ConseilDepartementalConseillerController } from './conseildepartemental-conseiller.controller.js'
import { ConseilDepartementalConseillerService } from './conseildepartemental-conseiller.service.js'

@Module({
  imports: [ConfigModule, OidcModule, TokenModule, APIModule],
  providers: [ConseilDepartementalConseillerService],
  exports: [],
  controllers: [ConseilDepartementalConseillerController]
})
export class ConseilDepartementalConseillerModule {}

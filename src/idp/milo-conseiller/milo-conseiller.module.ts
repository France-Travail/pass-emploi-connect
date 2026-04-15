import { Module } from '@nestjs/common'

import { ConfigModule } from '@nestjs/config'
import { APIModule } from '../../api/api.module.js'
import { OidcModule } from '../../oidc-provider/oidc.module.js'
import { TokenModule } from '../../token/token.module.js'
import { MiloConseillerController } from './milo-conseiller.controller.js'
import { MiloConseillerService } from './milo-conseiller.service.js'

@Module({
  imports: [ConfigModule, OidcModule, TokenModule, APIModule],
  providers: [MiloConseillerService],
  exports: [],
  controllers: [MiloConseillerController]
})
export class MiloConseillerModule {}

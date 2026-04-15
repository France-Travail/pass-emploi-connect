import { Module } from '@nestjs/common'

import { ConfigModule } from '@nestjs/config'
import { APIModule } from '../../api/api.module.js'
import { OidcModule } from '../../oidc-provider/oidc.module.js'
import { TokenModule } from '../../token/token.module.js'
import { MiloJeuneController } from './milo-jeune.controller.js'
import { MiloJeuneService } from './milo-jeune.service.js'

@Module({
  imports: [ConfigModule, OidcModule, TokenModule, APIModule],
  providers: [MiloJeuneService],
  exports: [],
  controllers: [MiloJeuneController]
})
export class MiloJeuneModule {}

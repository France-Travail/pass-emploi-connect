import { Module } from '@nestjs/common'

import { ConfigModule } from '@nestjs/config'
import { APIModule } from '../../api/api.module.js'
import { OidcModule } from '../../oidc-provider/oidc.module.js'
import { TokenModule } from '../../token/token.module.js'
import { FrancetravailAIJService } from './francetravail-aij.service.js'
import { FrancetravailBeneficiaireService } from './francetravail-beneficiaire.service.js'
import { FrancetravailBRSAService } from './francetravail-brsa.service.js'
import { FrancetravailJeuneController } from './francetravail-jeune.controller.js'
import { FrancetravailJeuneCEJService } from './francetravail-jeune.service.js'

@Module({
  imports: [ConfigModule, OidcModule, TokenModule, APIModule],
  providers: [
    FrancetravailJeuneCEJService,
    FrancetravailAIJService,
    FrancetravailBRSAService,
    FrancetravailBeneficiaireService
  ],
  exports: [],
  controllers: [FrancetravailJeuneController]
})
export class FrancetravailJeuneModule {}

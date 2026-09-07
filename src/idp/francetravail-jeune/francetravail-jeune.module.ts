import { Module } from '@nestjs/common'

import { ConfigModule } from '@nestjs/config'
import { APIModule } from '../../api/api.module'
import { OidcModule } from '../../oidc-provider/oidc.module'
import { TokenModule } from '../../token/token.module'
import { FrancetravailBeneficiaireService } from './francetravail-beneficiaire.service'
import { FrancetravailJeuneController } from './francetravail-jeune.controller'

@Module({
  imports: [ConfigModule, OidcModule, TokenModule, APIModule],
  providers: [FrancetravailBeneficiaireService],
  exports: [],
  controllers: [FrancetravailJeuneController]
})
export class FrancetravailJeuneModule {}

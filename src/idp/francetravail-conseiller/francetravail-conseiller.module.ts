import { Module } from '@nestjs/common'

import { ConfigModule } from '@nestjs/config'
import { FrancetravailConseillerAccompagnementIntensifService } from './francetravail-conseiller-accompagnement-intensif.service.js'
import { FrancetravailConseillerAccompagnementGlobalService } from './francetravail-conseiller-accompagnement-global.service.js'
import { FrancetravailConseillerEquipEmploiRecrutService } from './francetravail-conseiller-equip-emploi-recrut.service.js'
import { APIModule } from '../../api/api.module.js'
import { OidcModule } from '../../oidc-provider/oidc.module.js'
import { TokenModule } from '../../token/token.module.js'
import { FrancetravailConseillerAIJService } from './francetravail-conseiller-aij.service.js'
import { FrancetravailConseillerBRSAService } from './francetravail-conseiller-brsa.service.js'
import { FrancetravailConseillerCEJService } from './francetravail-conseiller-cej.service.js'
import { FrancetravailConseillerController } from './francetravail-conseiller.controller.js'
import { FrancetravailConseillerAvenirProService } from './francetravail-conseiller-avenirpro.service.js'
import { FrancetravailConseillerService } from './francetravail-conseiller.service.js'

@Module({
  imports: [ConfigModule, OidcModule, TokenModule, APIModule],
  providers: [
    FrancetravailConseillerService,
    FrancetravailConseillerCEJService,
    FrancetravailConseillerAIJService,
    FrancetravailConseillerBRSAService,
    FrancetravailConseillerAvenirProService,
    FrancetravailConseillerAccompagnementIntensifService,
    FrancetravailConseillerAccompagnementGlobalService,
    FrancetravailConseillerEquipEmploiRecrutService
  ],
  exports: [],
  controllers: [FrancetravailConseillerController]
})
export class FrancetravailConseillerModule {}

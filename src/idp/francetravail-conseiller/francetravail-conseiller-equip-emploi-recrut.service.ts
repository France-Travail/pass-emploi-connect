import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassEmploiAPIClient } from '../../api/pass-emploi-api.client'
import { User } from '../../domain/user'
import { OidcService } from '../../oidc-provider/oidc.service'
import { TokenService } from '../../token/token.service'
import { IdpService } from '../service/idp.service'

@Injectable()
export class FrancetravailConseillerEquipEmploiRecrutService extends IdpService {
  constructor(
    configService: ConfigService,
    oidcService: OidcService,
    tokenService: TokenService,
    passemploiapi: PassEmploiAPIClient
  ) {
    super(
      'FrancetravailConseillerEquipEmploiRecrutService',
      'francetravail-conseiller',
      User.Type.CONSEILLER,
      User.Structure.FT_EQUIP_EMPLOI_RECRUT,
      configService,
      oidcService,
      tokenService,
      passemploiapi
    )
  }
}

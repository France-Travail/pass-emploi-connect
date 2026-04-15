import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassEmploiAPIClient } from '../../api/pass-emploi-api.client.js'
import { User } from '../../domain/user.js'
import { OidcService } from '../../oidc-provider/oidc.service.js'
import { TokenService } from '../../token/token.service.js'
import { IdpService } from '../service/idp.service.js'

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
      User.Type.CONSEILLER,
      User.Structure.FT_EQUIP_EMPLOI_RECRUT,
      configService,
      oidcService,
      tokenService,
      passemploiapi
    )
  }
}

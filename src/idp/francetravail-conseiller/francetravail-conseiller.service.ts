import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassEmploiAPIClient } from '../../api/pass-emploi-api.client'
import { User } from '../../domain/user'
import { OidcService } from '../../oidc-provider/oidc.service'
import { TokenService } from '../../token/token.service'
import { IdpService } from '../service/idp.service'

@Injectable()
export class FrancetravailConseillerService extends IdpService {
  constructor(
    configService: ConfigService,
    oidcService: OidcService,
    tokenService: TokenService,
    passemploiapi: PassEmploiAPIClient
  ) {
    super(
      'FrancetravailConseillerService',
      'francetravail-conseiller',
      User.Type.CONSEILLER,
      User.Structure.FRANCE_TRAVAIL,
      configService,
      oidcService,
      tokenService,
      passemploiapi
    )
  }
}

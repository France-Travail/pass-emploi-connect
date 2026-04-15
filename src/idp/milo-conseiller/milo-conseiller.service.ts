import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassEmploiAPIClient } from '../../api/pass-emploi-api.client.js'
import { User } from '../../domain/user.js'
import { OidcService } from '../../oidc-provider/oidc.service.js'
import { TokenService } from '../../token/token.service.js'
import { IdpService } from '../service/idp.service.js'

@Injectable()
export class MiloConseillerService extends IdpService {
  constructor(
    configService: ConfigService,
    oidcService: OidcService,
    tokenService: TokenService,
    passemploiapi: PassEmploiAPIClient
  ) {
    super(
      'MiloConseillerService',
      User.Type.CONSEILLER,
      User.Structure.MILO,
      configService,
      oidcService,
      tokenService,
      passemploiapi
    )
  }
}

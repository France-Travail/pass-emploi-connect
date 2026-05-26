import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassEmploiAPIClient } from '../../api/pass-emploi-api.client'
import { User } from '../../domain/user'
import { OidcService } from '../../oidc-provider/oidc.service'
import { TokenService } from '../../token/token.service'
import { RequestContext } from '../../utils/monitoring/request-context'
import { IdpService } from '../service/idp.service'

@Injectable()
export class FrancetravailConseillerAIJService extends IdpService {
  constructor(
    configService: ConfigService,
    oidcService: OidcService,
    tokenService: TokenService,
    passemploiapi: PassEmploiAPIClient,
    requestContext: RequestContext
  ) {
    super(
      'FrancetravailConseillerAIJService',
      'francetravail-conseiller',
      User.Type.CONSEILLER,
      User.Structure.POLE_EMPLOI_AIJ,
      configService,
      oidcService,
      tokenService,
      passemploiapi,
      undefined,
      requestContext
    )
  }
}

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassEmploiAPIClient } from '../../api/pass-emploi-api.client'
import { User } from '../../domain/user'
import { OidcService } from '../../oidc-provider/oidc.service'
import { TokenService } from '../../token/token.service'
import { RequestContext } from '../../utils/monitoring/request-context'
import { IdpService } from '../service/idp.service'

@Injectable()
export class FrancetravailConseillerCEJService extends IdpService {
  constructor(
    configService: ConfigService,
    oidcService: OidcService,
    tokenService: TokenService,
    passemploiapi: PassEmploiAPIClient,
    requestContext: RequestContext
  ) {
    super(
      'FrancetravailConseillerCEJService',
      User.Type.CONSEILLER,
      User.Structure.POLE_EMPLOI_CEJ,
      configService,
      oidcService,
      tokenService,
      passemploiapi,
      undefined,
      requestContext
    )
  }
}

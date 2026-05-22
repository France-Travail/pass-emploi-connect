import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FrancetravailAPIClient } from '../../api/francetravail-api.client'
import { PassEmploiAPIClient } from '../../api/pass-emploi-api.client'
import { User } from '../../domain/user'
import { OidcService } from '../../oidc-provider/oidc.service'
import { TokenService } from '../../token/token.service'
import { RequestContext } from '../../utils/monitoring/request-context'
import { IdpService } from '../service/idp.service'

@Injectable()
export class FrancetravailBeneficiaireService extends IdpService {
  constructor(
    configService: ConfigService,
    oidcService: OidcService,
    tokenService: TokenService,
    passemploiapi: PassEmploiAPIClient,
    francetravailAPIClient: FrancetravailAPIClient,
    requestContext: RequestContext
  ) {
    super(
      'FrancetravailBeneficiaireService',
      User.Type.BENEFICIAIRE,
      User.Structure.FRANCE_TRAVAIL,
      configService,
      oidcService,
      tokenService,
      passemploiapi,
      francetravailAPIClient,
      requestContext
    )
  }
}

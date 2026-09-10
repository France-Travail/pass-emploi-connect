import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { UserinfoResponse } from 'openid-client'
import { FrancetravailAPIClient } from '../../api/francetravail-api.client'
import { PassEmploiAPIClient } from '../../api/pass-emploi-api.client'
import { User } from '../../domain/user'
import { OidcService } from '../../oidc-provider/oidc.service'
import { TokenService } from '../../token/token.service'
import { AuthError } from '../../utils/result/error'
import { failure, isFailure, Result, success } from '../../utils/result/result'
import {
  IdpService,
  RAISON_FRANCE_TRAVAIL_INDISPONIBLE
} from '../service/idp.service'

@Injectable()
export class FrancetravailJeuneService extends IdpService {
  constructor(
    configService: ConfigService,
    oidcService: OidcService,
    tokenService: TokenService,
    passemploiapi: PassEmploiAPIClient,
    francetravailAPIClient: FrancetravailAPIClient
  ) {
    super(
      'FrancetravailJeuneService',
      'francetravail-jeune',
      User.Type.JEUNE,
      User.Structure.FRANCE_TRAVAIL,
      configService,
      oidcService,
      tokenService,
      passemploiapi,
      francetravailAPIClient
    )
  }

  protected async resoudreStructureNonAccompagne(
    _userInfo: UserinfoResponse,
    accessToken: string
  ): Promise<Result<User.Structure | undefined>> {
    const statutResult = await this.francetravailapi!.getStatut(accessToken)

    if (isFailure(statutResult)) {
      return failure(new AuthError(RAISON_FRANCE_TRAVAIL_INDISPONIBLE))
    }

    return success(
      statutResult.data.estDemandeurEmploi
        ? User.Structure.FT_DEMANDEUR_D_EMPLOI
        : User.Structure.FT_ESPACE_CANDIDAT
    )
  }
}

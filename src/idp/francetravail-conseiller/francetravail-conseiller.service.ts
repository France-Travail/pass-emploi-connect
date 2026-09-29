import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassEmploiAPIClient } from '../../api/pass-emploi-api.client'
import { Profil, User } from '../../domain/user'
import { OidcService } from '../../oidc-provider/oidc.service'
import { TokenService } from '../../token/token.service'
import { IdpService } from '../service/idp.service'

const DISPOSITIFS_CONSEILLER_FT: readonly Profil.Dispositif[] = [
  Profil.Dispositif.CEJ,
  Profil.Dispositif.BRSA,
  Profil.Dispositif.AIJ,
  Profil.Dispositif.AVENIR_PRO,
  Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF,
  Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
  Profil.Dispositif.EQUIP_EMPLOI_RECRUT
]

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

  // Première visite : le dispositif choisi sur le web arrive par le /authorize ; sinon bouton unique
  protected profilDeConnexion(params: Record<string, unknown>): Profil {
    return {
      structure: Profil.Structure.FRANCE_TRAVAIL,
      dispositif: dispositifConseillerFT(params.dispositif)
    }
  }
}

function dispositifConseillerFT(valeur: unknown): Profil.Dispositif | null {
  const dispositif = valeur as Profil.Dispositif
  return DISPOSITIFS_CONSEILLER_FT.includes(dispositif) ? dispositif : null
}

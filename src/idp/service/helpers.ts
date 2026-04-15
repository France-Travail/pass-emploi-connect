import { ConfigService } from '@nestjs/config'
import type { ClientAuthMethod } from 'oidc-provider'
import { ClientMetadata, IssuerMetadata } from 'openid-client'
import { IdpConfig, IdpConfigIdentifier } from '../../config/configuration.js'
import { User } from '../../domain/user.js'
import { OidcService } from '../../oidc-provider/oidc.service.js'

export async function generateNewGrantId(
  configService: ConfigService,
  oidcService: OidcService,
  accountId: string,
  clientId: string,
  grantId?: string
): Promise<string> {
  let grant
  if (grantId) {
    // modification du grant existant dans la session
    grant = await oidcService.findGrant(grantId)
  }
  if (!grantId || !grant) {
    grant = oidcService.createGrant(accountId, clientId)
  }

  grant.addOIDCScope('openid')
  grant.addOIDCScope('profile')
  grant.addOIDCScope('email')
  grant.addResourceScope(
    configService.get('ressourceServer.url')!,
    configService.get('ressourceServer.scopes')!
  )

  return grant.save()
}

function getIdpConfigIdentifier(
  type: User.Type,
  structure: User.Structure
): IdpConfigIdentifier {
  switch (type) {
    case User.Type.JEUNE:
    case User.Type.BENEFICIAIRE:
      return ((): IdpConfigIdentifier => {
        switch (structure) {
          case User.Structure.MILO:
            return IdpConfigIdentifier.MILO_JEUNE
          case User.Structure.FRANCE_TRAVAIL:
          case User.Structure.POLE_EMPLOI_CEJ:
          case User.Structure.POLE_EMPLOI_BRSA:
          case User.Structure.POLE_EMPLOI_AIJ:
          case User.Structure.CONSEIL_DEPT:
          case User.Structure.AVENIR_PRO:
          case User.Structure.FT_ACCOMPAGNEMENT_INTENSIF:
          case User.Structure.FT_ACCOMPAGNEMENT_GLOBAL:
          case User.Structure.FT_EQUIP_EMPLOI_RECRUT:
            return IdpConfigIdentifier.FT_BENEFICIAIRE
        }
      })()
    case User.Type.CONSEILLER:
      return ((): IdpConfigIdentifier => {
        switch (structure) {
          case User.Structure.MILO:
            return IdpConfigIdentifier.MILO_CONSEILLER
          case User.Structure.CONSEIL_DEPT:
            return IdpConfigIdentifier.CONSEILLER_DEPT
          case User.Structure.FRANCE_TRAVAIL:
          case User.Structure.POLE_EMPLOI_CEJ:
          case User.Structure.POLE_EMPLOI_BRSA:
          case User.Structure.POLE_EMPLOI_AIJ:
          case User.Structure.AVENIR_PRO:
          case User.Structure.FT_ACCOMPAGNEMENT_INTENSIF:
          case User.Structure.FT_ACCOMPAGNEMENT_GLOBAL:
          case User.Structure.FT_EQUIP_EMPLOI_RECRUT:
            return IdpConfigIdentifier.FT_CONSEILLER
        }
      })()
  }
}

export function getIdpConfig(
  configService: ConfigService,
  userType: User.Type,
  userStructure: User.Structure
): IdpConfig {
  return configService.get('idps')[
    getIdpConfigIdentifier(userType, userStructure)
  ]
}

export function createIdpIssuerConfig(idp: IdpConfig): IssuerMetadata {
  return {
    issuer: idp.issuer,
    authorization_endpoint: idp.authorizationUrl,
    token_endpoint: idp.tokenUrl,
    jwks_uri: idp.jwks,
    userinfo_endpoint: idp.userinfo
  }
}

export function createIdpClientConfig(idp: IdpConfig): ClientMetadata {
  return {
    client_id: idp.clientId,
    client_secret: idp.clientSecret,
    redirect_uris: [idp.redirectUri],
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    scope: idp.scopes,
    token_endpoint_auth_method: 'client_secret_post' as ClientAuthMethod
  }
}

import { ConfigService } from '@nestjs/config'
import * as APM from 'elastic-apm-node'
import { Request, Response } from 'express'
import { InteractionResults } from 'oidc-provider'
import {
  AuthorizationParameters,
  BaseClient,
  Issuer,
  UserinfoResponse
} from 'openid-client'
import { FrancetravailAPIClient } from '../../api/francetravail-api.client'
import { PassEmploiAPIClient } from '../../api/pass-emploi-api.client'
import { IdpConfig } from '../../config/configuration'
import { Account } from '../../domain/account'
import {
  User,
  estBeneficiaireFTConnect,
  estConseillerDept
} from '../../domain/user'
import { OidcService } from '../../oidc-provider/oidc.service'
import { TokenService, TokenType } from '../../token/token.service'
import { getAPMInstance } from '../../utils/monitoring/apm.init'
import { logExternalCall } from '../../utils/monitoring/external-call.logger'
import { rootLogger, toEcsError } from '../../utils/monitoring/logger.module'
import {
  ContextKey,
  RequestContext
} from '../../utils/monitoring/request-context'
import { AuthError } from '../../utils/result/error'
import {
  Result,
  emptySuccess,
  failure,
  isFailure,
  isSuccess,
  success
} from '../../utils/result/result'
import {
  createIdpClientConfig,
  createIdpIssuerConfig,
  generateNewGrantId,
  getIdpConfig
} from './helpers'

export abstract class IdpService {
  private idpName: string
  private idpLabel: string
  private userType: User.Type
  private userStructure: User.Structure
  private idp: IdpConfig
  private client: BaseClient
  protected apmService: APM.Agent

  constructor(
    idpName: string,
    idpLabel: string,
    userType: User.Type,
    userStructure: User.Structure,
    private readonly configService: ConfigService,
    private readonly oidcService: OidcService,
    private readonly tokenService: TokenService,
    private readonly passemploiapi: PassEmploiAPIClient,
    private readonly francetravailapi?: FrancetravailAPIClient,
    private readonly requestContext?: RequestContext
  ) {
    this.apmService = getAPMInstance()
    this.idpName = idpName
    this.idpLabel = idpLabel
    this.userType = userType
    this.userStructure = userStructure
    this.idp = getIdpConfig(this.configService, userType, userStructure)

    const clientConfig = createIdpClientConfig(this.idp)
    const issuerConfig = createIdpIssuerConfig(this.idp)

    const issuer = new Issuer(issuerConfig)
    this.client = new issuer.Client(clientConfig)
  }

  getAuthorizationUrl(interactionId: string, state?: string): Result<string> {
    try {
      const params: AuthorizationParameters = {
        nonce: interactionId,
        scope: this.idp.scopes,
        state
      }
      if (this.idp.realm) {
        params.realm = this.idp.realm
      }
      const url = this.client.authorizationUrl(params)
      rootLogger.info(
        {
          context: this.idpName,
          event: { action: 'login_redirected', outcome: 'success' },
          labels: { idp: this.idpLabel }
        },
        'login_redirected'
      )
      return success(url)
    } catch (e) {
      this.apmService.captureError(
        e instanceof Error ? e : new Error(String(e))
      )
      rootLogger.error(
        {
          context: this.idpName,
          event: { action: 'login_redirected', outcome: 'failure' },
          labels: { idp: this.idpLabel },
          error: toEcsError(e)
        },
        'login_redirected'
      )
      return failure(new AuthError('AUTHORIZE'))
    }
  }

  async callback(request: Request, response: Response): Promise<Result> {
    let codeErreur = 'none'
    try {
      codeErreur = 'CallbackParams'
      const params = this.client.callbackParams(request)

      codeErreur = 'SessionNotFound'

      const interactionDetails = await this.oidcService.interactionDetails(
        request,
        response
      )

      this.requestContext?.set(
        ContextKey.INTERACTION_ID,
        interactionDetails.uid
      )

      codeErreur = 'Callback'
      const tokenSet = await logExternalCall(
        { target: this.idpName, operation: 'token' },
        () =>
          this.client.callback(this.idp.redirectUri, params, {
            nonce: interactionDetails.uid,
            state: request.query.state
              ? (request.query.state as string)
              : undefined
          })
      )

      codeErreur = 'UserInfo'
      let userInfoOptions: { params?: object } | undefined
      if (this.idp.realm) {
        userInfoOptions = { params: { realm: this.idp.realm } }
      }
      const userInfo = await logExternalCall(
        { target: this.idpName, operation: 'userinfo' },
        () => this.client.userinfo(tokenSet, userInfoOptions)
      )

      codeErreur = 'Coordonnees'
      const { nom, prenom, email } = await this.getCoordonnees(
        userInfo,
        tokenSet.access_token!
      )

      codeErreur = 'VerificationConseillerDepartemental'
      verifierQueLUtilisateurEstUnConseillerDepartementalLegitime(
        this.userType,
        this.userStructure,
        this.configService.get('authorizedConseillersDept')!,
        email
      )

      codeErreur = 'ApiPassEmploi'
      // besoin de persister le preferred_username parce que le get token n'a pas cette info dans le context
      const apiUserResult = await this.passemploiapi.putUser(userInfo.sub, {
        nom,
        prenom,
        email,
        structure: this.userStructure,
        type: this.userType,
        username: userInfo.preferred_username
      })

      if (isFailure(apiUserResult)) {
        rootLogger.error(
          {
            context: this.idpName,
            event: { action: 'login_failed', outcome: 'failure' },
            labels: { idp: this.idpLabel },
            login: { step: 'ApiPassEmploi' }
          },
          'login_failed'
        )
        this.apmService.captureError(new Error('Callback PUT user error'))
        return apiUserResult
      }

      this.requestContext?.set(ContextKey.USER, {
        id: apiUserResult.data.userId,
        type: apiUserResult.data.userType,
        structure: apiUserResult.data.userStructure
      })

      codeErreur = 'UserPassEmploi'
      const typeUtilisateurFinal = apiUserResult.data.userType
      const structureUtilisateurFinal = apiUserResult.data.userStructure
      const account = {
        sub: userInfo.sub,
        type: typeUtilisateurFinal,
        structure: structureUtilisateurFinal
      }
      codeErreur = 'AccountId'
      const accountId = Account.fromAccountToAccountId(account)

      codeErreur = 'Grant'
      const { grantId } = interactionDetails
      const newGrantId = await generateNewGrantId(
        this.configService,
        this.oidcService,
        accountId,
        interactionDetails.params.client_id as string,
        grantId
      )

      codeErreur = 'CreateSession'
      const result: InteractionResults = {
        login: { accountId },
        consent: { grantId: newGrantId },
        userType: typeUtilisateurFinal,
        userStructure: structureUtilisateurFinal,
        email: email,
        family_name: nom,
        given_name: prenom,
        userRoles: apiUserResult.data.userRoles,
        userId: apiUserResult.data.userId,
        preferred_username: userInfo.preferred_username
      }

      codeErreur = 'SetAccess'
      await this.tokenService.setToken(account, TokenType.ACCESS, {
        token: tokenSet.access_token!,
        expiresIn: tokenSet.expires_in || this.idp.accessTokenMaxAge,
        scope: tokenSet.scope,
        expiresAt: tokenSet.expires_at
      })

      codeErreur = 'SetRefresh'
      if (tokenSet.refresh_token) {
        await this.tokenService.setToken(account, TokenType.REFRESH, {
          token: tokenSet.refresh_token,
          expiresIn: this.idp.refreshTokenMaxAge,
          scope: tokenSet.scope
        })
      }

      codeErreur = 'SaveSession'
      await this.oidcService.interactionFinished(request, response, result)
      rootLogger.info(
        {
          context: this.idpName,
          event: { action: 'login_completed', outcome: 'success' },
          labels: { idp: this.idpLabel }
        },
        'login_completed'
      )
      return emptySuccess()
    } catch (e) {
      this.apmService.captureError(
        e instanceof Error ? e : new Error(String(e))
      )
      rootLogger.error(
        {
          context: this.idpName,
          event: { action: 'login_failed', outcome: 'failure' },
          labels: { idp: this.idpLabel },
          login: { step: codeErreur },
          error: toEcsError(e)
        },
        'login_failed'
      )

      if (codeErreur === 'SessionNotFound') {
        response.clearCookie('_session', { httpOnly: true, secure: true })
        response.clearCookie('_session.legacy', {
          httpOnly: true,
          secure: true
        })
        response.clearCookie('_interaction', { httpOnly: true, secure: true })
        response.clearCookie('_interaction.legacy', {
          httpOnly: true,
          secure: true
        })
      }
      return failure(new AuthError(codeErreur))
    }
  }

  private async getCoordonnees(
    userInfoFromIdToken: UserinfoResponse,
    accessToken: string
  ): Promise<{
    nom?: string
    prenom?: string
    email?: string
  }> {
    let coordonnees
    if (estBeneficiaireFTConnect(this.userType, this.userStructure)) {
      const coordonneesResult = await this.francetravailapi!.getCoordonness(
        accessToken
      )
      if (isSuccess(coordonneesResult)) {
        coordonnees = coordonneesResult.data
      }
    }
    const nom = coordonnees?.nom ?? userInfoFromIdToken.family_name
    const prenom = coordonnees?.prenom ?? userInfoFromIdToken.given_name
    const email = coordonnees?.email ?? userInfoFromIdToken.email

    return { nom, prenom, email }
  }
}

function verifierQueLUtilisateurEstUnConseillerDepartementalLegitime(
  userType: User.Type,
  userStructure: User.Structure,
  _authorizedList: string[],
  email?: string
): void {
  if (estConseillerDept(userType, userStructure)) {
    // TODO mettre en place vérification pattern
    if (!email) {
      throw new Error('Conseiller Départemental non autorisé')
    }
  }
}

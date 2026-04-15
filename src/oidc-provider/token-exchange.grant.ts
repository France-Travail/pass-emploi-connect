import { Inject, Injectable, Logger } from '@nestjs/common'
import { KoaContextWithOIDC } from 'oidc-provider'
import { User } from '../domain/user.js'
import { GetAccessTokenUsecase } from '../token/get-access-token.usecase.js'
import { ValidateJWTUsecase } from '../token/verify-jwt.usecase.js'
import { OIDC_PROVIDER_MODULE, OidcProviderModule } from './provider.js'
import { Account } from '../domain/account.js'
import { isFailure } from '../utils/result/result.js'
import { buildError } from '../utils/monitoring/logger.module.js'
import * as APM from 'elastic-apm-node'
import { getAPMInstance } from '../utils/monitoring/apm.init.js'

export const gty = 'token_exchange'
export const grantType = 'urn:ietf:params:oauth:grant-type:token-exchange'
export const parameters = new Set([
  'resource', // optional : uri of the resource to which the token should be issued
  'requested_token_type', // optional
  'subject_token', // required : the sub of the token to be exchanged
  'subject_token_type', // required : urn:ietf:params:oauth:token-type:access_token
  // Probablement inutile :
  'audience', // optional
  'scope', // optional :
  'actor_token', // optional : probablement inutile
  'actor_token_type', // optional : probablement inutile
  'requested_token_sub', // si on veut récupérer un token pour un autre utilisateur, préciser son sub
  'requested_sub_type' // si on veut récupérer un token pour un autre utilisateur, préciser son type
])

@Injectable()
export class TokenExchangeGrant {
  private logger: Logger
  protected apmService: APM.Agent

  constructor(
    @Inject(OIDC_PROVIDER_MODULE) private readonly opm: OidcProviderModule,
    private readonly validateJWTUsecase: ValidateJWTUsecase,
    private readonly getAccessTokenUsecase: GetAccessTokenUsecase
  ) {
    this.logger = new Logger('TokenExchangeGrant')
    this.apmService = getAPMInstance()
  }

  // This approach has the advantage of not creating a new function instance on each call to TokenExchangeGrant.handler, since this will be called a lot, you might want to go with this version to minimize memory allocations.
  handler = async (context: KoaContextWithOIDC): Promise<void> => {
    const subjectToken = context.oidc?.params?.subject_token as string
    if (!subjectToken) {
      const message = 'subject token not found'
      this.logger.error(message)
      this.apmService.captureError(new Error(message))
      throw new this.opm.errors.InvalidGrant(message)
    }

    const tokenPayloadResult = await this.validateJWTUsecase.execute({
      token: subjectToken
    })

    if (isFailure(tokenPayloadResult)) {
      const message = 'subject token is invalid'
      this.logger.error(
        buildError(message, new Error(tokenPayloadResult.error.code))
      )
      this.apmService.captureError(new Error(tokenPayloadResult.error.code))
      throw new this.opm.errors.InvalidGrant(message)
    }

    const account: Account = {
      sub: Account.getSubFromAccountId(tokenPayloadResult.data.sub!),
      type: tokenPayloadResult.data.userType! as User.Type,
      structure: tokenPayloadResult.data.userStructure! as User.Structure
    }

    const requestedTokenSub = context.oidc?.params
      ?.requested_token_sub as string
    const requestedSubType = context.oidc?.params?.requested_sub_type as string
    const isConseiller = account.type === User.Type.CONSEILLER

    // Getting access token for a specific sub
    if (requestedTokenSub) {
      account.sub = requestedTokenSub
      if (requestedSubType) account.type = requestedSubType as User.Type
      else account.type = isConseiller ? User.Type.JEUNE : User.Type.CONSEILLER
    }

    const resultTokenData = await this.getAccessTokenUsecase.execute({
      account
    })

    if (isFailure(resultTokenData)) {
      const message = 'unable to find an access_token'
      this.logger.error(resultTokenData.error.message)
      this.logger.error(message)
      this.apmService.captureError(new Error(message))
      throw new this.opm.errors.InvalidTarget(message)
    }

    context.body = {
      issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      access_token: resultTokenData.data.token,
      token_type: 'bearer',
      expires_in: resultTokenData.data.expiresIn,
      scope: resultTokenData.data.scope
    }
  }
}

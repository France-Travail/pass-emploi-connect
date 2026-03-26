import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as APM from 'elastic-apm-node'
import { Issuer } from 'openid-client'
import { IdpConfig } from '../config/configuration'
import { Account } from '../domain/account'
import {
  createIdpClientConfig,
  createIdpIssuerConfig,
  getIdpConfig
} from '../idp/service/helpers'
import { getAPMInstance } from '../utils/monitoring/apm.init'
import { buildError } from '../utils/monitoring/logger.module'
import { AuthError, NonTrouveError } from '../utils/result/error'
import { failure, Result, success } from '../utils/result/result'
import { TokenData, TokenService, TokenType } from './token.service'
import * as uuid from 'uuid'

interface Inputs {
  account: Account
}

@Injectable()
export class GetAccessTokenUsecase {
  private readonly logger: Logger
  protected apmService: APM.Agent

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService
  ) {
    this.logger = new Logger('GetAccessTokenUsecase')
    this.apmService = getAPMInstance()
  }

  async execute(query: Inputs): Promise<Result<TokenData>> {
    try {
      const storedAccessTokenData = await this.tokenService.getToken(
        query.account,
        TokenType.ACCESS
      )

      if (storedAccessTokenData) {
        return success(storedAccessTokenData)
      }

      return this.refreshAccessTokenWithLock(query.account)
    } catch (e) {
      this.logger.error(buildError('Erreur inconnue GET AccessTokenUsecase', e))
      this.apmService.captureError(
        e instanceof Error ? e : new Error(String(e))
      )
      return failure(new NonTrouveError('AcessToken'))
    }
  }

  private async refreshAccessTokenWithLock(
    account: Account
  ): Promise<Result<TokenData>> {
    const lockId = uuid.v4()
    const isAccessTokenLocked = await this.tokenService.setAccessTokenLock(
      account,
      lockId
    )

    if (isAccessTokenLocked) {
      const result = await this.refresh(account)
      await this.tokenService.releaseAccessTokenLock(account, lockId)
      return result
    } else {
      return this.waitForRefresh(account)
    }
  }

  private async refresh(account: Account): Promise<Result<TokenData>> {
    const refreshToken = await this.tokenService.getToken(
      account,
      TokenType.REFRESH
    )

    if (!refreshToken) {
      this.logger.error("L'utilisateur n'a pas de refresh token")
      this.apmService.captureError(
        new Error("L'utilisateur n'a pas de refresh token")
      )
      return failure(new NonTrouveError('Refresh token'))
    }

    const idp: IdpConfig = getIdpConfig(
      this.configService,
      account.type,
      account.structure
    )

    const clientConfig = createIdpClientConfig(idp)
    const issuerConfig = createIdpIssuerConfig(idp)

    try {
      const issuer = new Issuer(issuerConfig)
      const client = new issuer.Client(clientConfig)

      this.logger.debug(
        `user ${account.type} ${account.structure} ${account.sub}`
      )
      this.logger.debug(`Refresh token utilisé ${JSON.stringify(refreshToken)}`)

      const tokenSet = await client.refresh(refreshToken.token)

      this.logger.debug(`TokenSet ${JSON.stringify(tokenSet)}`)

      const tokenData: TokenData = {
        token: tokenSet.access_token!,
        expiresIn: tokenSet.expires_in || idp.accessTokenMaxAge,
        expiresAt: tokenSet.expires_at,
        scope: tokenSet.scope
      }

      await this.tokenService.setToken(account, TokenType.ACCESS, tokenData)
      if (tokenSet.refresh_token) {
        await this.tokenService.setToken(account, TokenType.REFRESH, {
          token: tokenSet.refresh_token,
          expiresIn: idp.refreshTokenMaxAge,
          scope: tokenSet.scope
        })
      } else {
        this.logger.warn('Pas de refresh token dans le tokenSet')
      }
      return success(tokenData)
    } catch (e) {
      this.logger.debug(`issuer utilisé ${JSON.stringify(issuerConfig)}`)

      this.logger.error(
        `Erreur refresh token ${account.type} ${account.structure}`
      )
      this.logger.error(
        buildError(
          `Erreur refresh token ${account.type} ${account.structure}`,
          e
        )
      )
      this.apmService.captureError(
        e instanceof Error ? e : new Error(String(e))
      )
      return failure(
        new AuthError(
          `ERROR_REFRESH_TOKEN_IDP_${account.type}_${account.structure}`
        )
      )
    }
  }

  private async waitForRefresh(account: Account): Promise<Result<TokenData>> {
    let retries = 3
    let waitInMillis = 150
    while (retries > 0) {
      const storedAccessTokenData = await this.tokenService.getToken(
        account,
        TokenType.ACCESS
      )
      if (storedAccessTokenData) {
        return success(storedAccessTokenData)
      }
      waitInMillis *= retries
      retries--
      await new Promise(resolve => setTimeout(resolve, waitInMillis))
    }
    return failure(new NonTrouveError('AcessToken'))
  }
}

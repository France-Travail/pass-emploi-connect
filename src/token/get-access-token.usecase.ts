import { Injectable } from '@nestjs/common'
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
import {
  rootLogger,
  serializeBodyForLog,
  toEcsError
} from '../utils/monitoring/logger.module'
import { AuthError, NonTrouveError } from '../utils/result/error'
import { failure, Result, success } from '../utils/result/result'
import { TokenData, TokenService, TokenType } from './token.service'
import * as uuid from 'uuid'

interface Inputs {
  account: Account
}

@Injectable()
export class GetAccessTokenUsecase {
  protected apmService: APM.Agent

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService
  ) {
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
      rootLogger.error(
        {
          context: 'GetAccessTokenUsecase',
          event: { action: 'token_refreshed', outcome: 'failure' },
          error: toEcsError(e instanceof Error ? e : new Error(String(e)))
        },
        'token_refreshed'
      )
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
      rootLogger.error(
        {
          context: 'GetAccessTokenUsecase',
          event: { action: 'token_refreshed', outcome: 'failure' },
          error: toEcsError(new Error("L'utilisateur n'a pas de refresh token"))
        },
        'token_refreshed'
      )
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

      rootLogger.debug(
        {
          context: 'GetAccessTokenUsecase',
          data: serializeBodyForLog({
            type: account.type,
            structure: account.structure
          })
        },
        'refresh_token_debug'
      )

      const tokenSet = await client.refresh(refreshToken.token)

      rootLogger.debug(
        {
          context: 'GetAccessTokenUsecase',
          data: serializeBodyForLog(tokenSet)
        },
        'token_set_debug'
      )

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
        rootLogger.info(
          { context: 'GetAccessTokenUsecase' },
          'refresh_token_absent_in_token_set'
        )
      }

      rootLogger.info(
        {
          context: 'GetAccessTokenUsecase',
          event: { action: 'token_refreshed', outcome: 'success' }
        },
        'token_refreshed'
      )
      return success(tokenData)
    } catch (e) {
      rootLogger.debug(
        {
          context: 'GetAccessTokenUsecase',
          data: serializeBodyForLog(issuerConfig)
        },
        'issuer_debug'
      )

      rootLogger.error(
        {
          context: 'GetAccessTokenUsecase',
          event: { action: 'token_refreshed', outcome: 'failure' },
          error: toEcsError(e instanceof Error ? e : new Error(String(e)))
        },
        'token_refreshed'
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

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as APM from 'elastic-apm-node'
import { errors, Issuer } from 'openid-client'
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
import {
  AuthError,
  ErreurReseauIDP,
  NonTrouveError
} from '../utils/result/error'
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
          labels: {
            account_id: Account.fromAccountToAccountId(query.account)
          },
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
          labels: { account_id: Account.fromAccountToAccountId(account) },
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
          event: { action: 'idp_refresh_requested' },
          labels: { account_id: Account.fromAccountToAccountId(account) }
        },
        'idp_refresh_requested'
      )

      const tokenSet = await client.refresh(refreshToken.token)

      rootLogger.debug(
        {
          context: 'GetAccessTokenUsecase',
          event: { action: 'idp_token_set_received' },
          labels: {
            account_id: Account.fromAccountToAccountId(account),
            token_set: serializeBodyForLog(tokenSet)
          }
        },
        'idp_token_set_received'
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
          {
            context: 'GetAccessTokenUsecase',
            event: {
              action: 'refresh_token_absent_in_token_set',
              outcome: 'success'
            },
            labels: { account_id: Account.fromAccountToAccountId(account) }
          },
          'refresh_token_absent_in_token_set'
        )
      }

      rootLogger.info(
        {
          context: 'GetAccessTokenUsecase',
          event: { action: 'token_refreshed', outcome: 'success' },
          labels: { account_id: Account.fromAccountToAccountId(account) }
        },
        'token_refreshed'
      )
      return success(tokenData)
    } catch (e) {
      rootLogger.debug(
        {
          context: 'GetAccessTokenUsecase',
          event: { action: 'idp_issuer_config_inspected' },
          labels: {
            account_id: Account.fromAccountToAccountId(account),
            issuer_config: serializeBodyForLog(issuerConfig)
          }
        },
        'idp_issuer_config_inspected'
      )

      rootLogger.error(
        {
          context: 'GetAccessTokenUsecase',
          event: { action: 'token_refreshed', outcome: 'failure' },
          labels: { account_id: Account.fromAccountToAccountId(account) },
          error: toEcsError(e instanceof Error ? e : new Error(String(e)))
        },
        'token_refreshed'
      )
      this.apmService.captureError(
        e instanceof Error ? e : new Error(String(e))
      )

      const log = `ERROR_REFRESH_TOKEN_IDP_${account.type}_${account.structure}`
      if (erreurReseauIDP(e)) {
        return failure(new ErreurReseauIDP(log))
      }
      return failure(new AuthError(log))
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
    rootLogger.error(
      {
        context: 'GetAccessTokenUsecase',
        event: { action: 'token_refreshed', outcome: 'failure' },
        labels: { account_id: Account.fromAccountToAccountId(account) },
        error: toEcsError(
          new Error('Attente du refresh concurrent épuisée sans access token')
        )
      },
      'token_refreshed'
    )
    return failure(new NonTrouveError('AcessToken'))
  }
}

function erreurReseauIDP(e: unknown): boolean {
  if (e instanceof errors.OPError) {
    return false
  }
  if (e instanceof Error) {
    const erreursReseau = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNABORTED'
    ]
    return erreursReseau.includes((e as NodeJS.ErrnoException).code ?? '')
  }
  return false
}

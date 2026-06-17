import { Injectable } from '@nestjs/common'
import * as APM from 'elastic-apm-node'
import { Account } from '../domain/account'
import { RedisClient } from '../redis/redis.client'
import { getAPMInstance } from '../utils/monitoring/apm.init'
import { rootLogger, toEcsError } from '../utils/monitoring/logger.module'
import { AuthError } from '../utils/result/error'
import { Result, emptySuccess, failure } from '../utils/result/result'

interface Inputs {
  idAuth: string
}

// Payload (partiel) d'un RefreshToken OIDC stocké par RedisAdapter.
interface RefreshTokenPayload {
  accountId?: string
}

@Injectable()
export class DeleteAccountUsecase {
  protected apmService: APM.Agent

  constructor(private readonly redisClient: RedisClient) {
    this.apmService = getAPMInstance()
  }

  async execute(inputs: Inputs): Promise<Result> {
    try {
      // Tokens IDP (couche connect <-> IDP), indexés par accountId
      await this.redisClient.deletePattern(inputs.idAuth)
      // RefreshTokens OIDC (couche app <-> connect) : seul artefact à révoquer
      // pour déconnecter. Au prochain refresh -> invalid_grant -> re-login.
      // (AccessToken inutile : JWT validé par signature, jamais relu en Redis ;
      // Session couverte par le check policy account_not_found.)
      const refreshTokens = await this.revokeOidcRefreshTokens(inputs.idAuth)
      rootLogger.info(
        {
          context: 'DeleteAccountUsecase',
          event: { action: 'account_deleted', outcome: 'success' },
          refreshTokens
        },
        'account_deleted'
      )
      return emptySuccess()
    } catch (e) {
      rootLogger.error(
        {
          context: 'DeleteAccountUsecase',
          event: { action: 'account_deleted', outcome: 'failure' },
          error: toEcsError(e)
        },
        'account_deleted'
      )
      this.apmService.captureError(
        e instanceof Error ? e : new Error(String(e))
      )
      return failure(new AuthError('DELETE_TOKENS'))
    }
  }

  private async revokeOidcRefreshTokens(idAuth: string): Promise<number> {
    let count = 0
    for (const key of await this.redisClient.scanKeys('*RefreshToken:*')) {
      const hash = await this.redisClient.hgetAllRaw(key)
      if (!hash?.payload) continue
      const payload: RefreshTokenPayload = JSON.parse(hash.payload)
      if (Account.getSubFromAccountId(payload.accountId ?? '') !== idAuth) {
        continue
      }
      await this.redisClient.delRaw(key)
      count++
    }
    return count
  }
}

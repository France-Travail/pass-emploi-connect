import { Injectable } from '@nestjs/common'
import * as APM from 'elastic-apm-node'
import { Account } from '../domain/account'
import { User } from '../domain/user'
import { OidcService } from '../oidc-provider/oidc.service'
import { RedisClient } from '../redis/redis.client'
import { getAPMInstance } from '../utils/monitoring/apm.init'
import { rootLogger, toEcsError } from '../utils/monitoring/logger.module'
import { AuthError } from '../utils/result/error'
import { Result, emptySuccess, failure } from '../utils/result/result'

interface Inputs {
  idAuth: string
}

@Injectable()
export class DeleteAccountUsecase {
  protected apmService: APM.Agent

  constructor(
    private readonly redisClient: RedisClient,
    private readonly oidcService: OidcService
  ) {
    this.apmService = getAPMInstance()
  }

  async execute(inputs: Inputs): Promise<Result> {
    let step = 'grant_invite'
    try {
      // L'API ne transmet que le sub : on tente le grant invité pour tout le
      // monde, l'index n'existe que pour les invités.
      const accountIdInvite = Account.fromAccountToAccountId({
        sub: inputs.idAuth,
        type: User.Type.JEUNE,
        structure: User.Structure.INVITE
      })
      const grantInviteRevoque = await this.oidcService.revoquerGrantInvite(
        accountIdInvite
      )

      step = 'tokens_idp'
      await this.redisClient.deletePattern(inputs.idAuth)

      rootLogger.info(
        {
          context: 'DeleteAccountUsecase',
          event: { action: 'account_deleted', outcome: 'success' },
          labels: { grant_invite: grantInviteRevoque ? 'revoque' : 'absent' }
        },
        'account_deleted'
      )
      return emptySuccess()
    } catch (e) {
      rootLogger.error(
        {
          context: 'DeleteAccountUsecase',
          event: { action: 'account_deleted', outcome: 'failure' },
          labels: { step },
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
}

import { Injectable } from '@nestjs/common'
import * as APM from 'elastic-apm-node'
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

  constructor(private readonly redisClient: RedisClient) {
    this.apmService = getAPMInstance()
  }

  async execute(inputs: Inputs): Promise<Result> {
    try {
      await this.redisClient.deletePattern(inputs.idAuth)
      rootLogger.info(
        {
          context: 'DeleteAccountUsecase',
          event: { action: 'account_deleted', outcome: 'success' }
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
}

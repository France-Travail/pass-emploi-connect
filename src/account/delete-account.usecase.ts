import { Injectable, Logger } from '@nestjs/common'
import * as APM from 'elastic-apm-node'
import { RedisClient } from '../redis/redis.client.js'
import { getAPMInstance } from '../utils/monitoring/apm.init.js'
import { buildError } from '../utils/monitoring/logger.module.js'
import { AuthError } from '../utils/result/error.js'
import { emptySuccess, failure } from '../utils/result/result.js'
import type { Result } from '../utils/result/result.js'

interface Inputs {
  idAuth: string
}

@Injectable()
export class DeleteAccountUsecase {
  private readonly logger: Logger
  protected apmService: APM.Agent

  constructor(private readonly redisClient: RedisClient) {
    this.logger = new Logger('DeleteUserUsecase')
    this.apmService = getAPMInstance()
  }

  async execute(inputs: Inputs): Promise<Result> {
    try {
      await this.redisClient.deletePattern(inputs.idAuth)
      return emptySuccess()
    } catch (e) {
      this.logger.error(buildError('Erreur suppression tokens utilisateur', e))
      this.apmService.captureError(
        e instanceof Error ? e : new Error(String(e))
      )
      return failure(new AuthError('DELETE_TOKENS'))
    }
  }
}

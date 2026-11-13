import { Injectable } from '@nestjs/common'
import * as APM from 'elastic-apm-node'
import { TokenService } from '../token/token.service'
import { getAPMInstance } from '../utils/monitoring/apm.init'
import { rootLogger, toEcsError } from '../utils/monitoring/logger.module'
import { AuthError } from '../utils/result/error'
import { Result, emptySuccess, failure } from '../utils/result/result'

interface Inputs {
  subs: string[]
}

// Ne touche qu'aux tokens IdP : les grants et sessions oidc-provider restent,
// mais le prochain échange de token vers l'IdP échoue et force une reconnexion.
@Injectable()
export class RevoquerTokensIdpUsecase {
  protected apmService: APM.Agent

  constructor(private readonly tokenService: TokenService) {
    this.apmService = getAPMInstance()
  }

  async execute(inputs: Inputs): Promise<Result> {
    try {
      await this.tokenService.supprimerTokensIdp(inputs.subs)
      rootLogger.info(
        {
          context: 'RevoquerTokensIdpUsecase',
          event: { action: 'tokens_idp_revoques', outcome: 'success' },
          labels: { nb_subs: inputs.subs.length }
        },
        'tokens_idp_revoques'
      )
      return emptySuccess()
    } catch (e) {
      rootLogger.error(
        {
          context: 'RevoquerTokensIdpUsecase',
          event: { action: 'tokens_idp_revoques', outcome: 'failure' },
          labels: { nb_subs: inputs.subs.length },
          error: toEcsError(e)
        },
        'tokens_idp_revoques'
      )
      this.apmService.captureError(
        e instanceof Error ? e : new Error(String(e))
      )
      return failure(new AuthError('DELETE_TOKENS'))
    }
  }
}

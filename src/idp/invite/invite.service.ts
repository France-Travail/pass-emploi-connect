import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as APM from 'elastic-apm-node'
import { Response } from 'express'
import { InteractionResults } from 'oidc-provider'
import * as uuid from 'uuid'
import { PassEmploiAPIClient } from '../../api/pass-emploi-api.client'
import { Account } from '../../domain/account'
import { User } from '../../domain/user'
import { OidcService } from '../../oidc-provider/oidc.service'
import { getAPMInstance } from '../../utils/monitoring/apm.init'
import { rootLogger, toEcsError } from '../../utils/monitoring/logger.module'
import { AuthError } from '../../utils/result/error'
import {
  emptySuccess,
  failure,
  isFailure,
  Result
} from '../../utils/result/result'
import { generateNewGrantId } from '../service/helpers'

const IDP_LABEL = 'invite'

/**
 * Mode invité.
 *
 * Contrairement aux autres IdpService, il n'y a aucun IDP externe : l'invité ne
 * revendique aucune identité et ne présente aucune preuve, il n'y a donc rien à
 * vérifier. Connect *fabrique* l'identité (sub anonyme), la fait enregistrer par
 * l'API, puis termine l'interaction — sans le moindre aller-retour réseau vers
 * un fournisseur d'identité, et sans stocker de token IDP.
 */
@Injectable()
export class InviteService {
  protected apmService: APM.Agent

  constructor(
    private readonly configService: ConfigService,
    private readonly oidcService: OidcService,
    private readonly passemploiapi: PassEmploiAPIClient
  ) {
    this.apmService = getAPMInstance()
  }

  async connect(interactionId: string, response: Response): Promise<Result> {
    let codeErreur = 'none'
    try {
      rootLogger.info(
        {
          context: 'InviteService',
          event: { action: 'login_initiated', outcome: 'success' },
          labels: { idp: IDP_LABEL }
        },
        'login_initiated'
      )

      codeErreur = 'SessionNotFound'
      const interaction = await this.oidcService.findInteraction(interactionId)
      if (!interaction) {
        throw new Error(`Interaction ${interactionId} introuvable`)
      }

      // Identité fabriquée côté serveur : le sub n'est jamais fourni par le
      // client (un id envoyé par le mobile serait forgeable). Ce qui rattache
      // durablement l'invité à l'appareil, c'est le refresh token émis ensuite.
      codeErreur = 'ApiPassEmploi'
      const sub = uuid.v4()
      const apiUserResult = await this.passemploiapi.putUtilisateurInvite(sub)

      if (isFailure(apiUserResult)) {
        rootLogger.error(
          {
            context: 'InviteService',
            event: { action: 'login_failed', outcome: 'failure' },
            labels: { idp: IDP_LABEL },
            login: { step: 'ApiPassEmploi' },
            error: toEcsError(apiUserResult.error)
          },
          'login_failed'
        )
        this.apmService.captureError(new Error('Invite PUT user error'))
        return apiUserResult
      }

      codeErreur = 'AccountId'
      const account: Account = {
        sub,
        type: User.Type.JEUNE,
        structure: User.Structure.INVITE
      }
      const accountId = Account.fromAccountToAccountId(account)

      codeErreur = 'Grant'
      const grantId = await generateNewGrantId(
        this.configService,
        this.oidcService,
        accountId,
        interaction.params.client_id as string,
        interaction.grantId
      )

      codeErreur = 'CreateSession'
      const result: InteractionResults = {
        login: { accountId },
        consent: { grantId },
        userType: User.Type.JEUNE,
        userStructure: User.Structure.INVITE,
        userRoles: apiUserResult.data.userRoles,
        userId: apiUserResult.data.userId
      }

      // Aucun token IDP à stocker : l'invité n'a pas d'IDP.
      codeErreur = 'SaveSession'
      await this.oidcService.finishInteraction(response, interaction, result)

      rootLogger.info(
        {
          context: 'InviteService',
          event: { action: 'login_completed', outcome: 'success' },
          labels: { idp: IDP_LABEL }
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
          context: 'InviteService',
          event: { action: 'login_failed', outcome: 'failure' },
          labels: { idp: IDP_LABEL },
          login: { step: codeErreur },
          error: toEcsError(e)
        },
        'login_failed'
      )
      return failure(new AuthError(codeErreur))
    }
  }
}

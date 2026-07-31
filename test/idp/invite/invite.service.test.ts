import { ConfigService } from '@nestjs/config'
import { Response } from 'express'
import sinon from 'sinon'
import { PassEmploiAPIClient } from '../../../src/api/pass-emploi-api.client'
import { Account } from '../../../src/domain/account'
import { User } from '../../../src/domain/user'
import { InviteService } from '../../../src/idp/invite/invite.service'
import { OidcService } from '../../../src/oidc-provider/oidc.service'
import { UtilisateurNonTraitable } from '../../../src/utils/result/error'
import {
  failure,
  isFailure,
  isSuccess,
  success
} from '../../../src/utils/result/result'
import { RequestContext } from '../../../src/utils/monitoring/request-context'
import { StubbedClass, stubClass } from '../../test-utils'
import { testConfig } from '../../test-utils/module-for-testing'

describe('InviteService', () => {
  let inviteService: InviteService
  let oidcService: StubbedClass<OidcService>
  let passEmploiAPIClient: StubbedClass<PassEmploiAPIClient>
  let response: Response
  const configService = testConfig()

  const interactionId = 'une-interaction'
  // L'invité n'a ni family_name ni email : les claims sont absents, pas vides.
  const unInvite = (): User => ({
    userId: 'id-en-base',
    userType: User.Type.JEUNE,
    userStructure: User.Structure.INVITE,
    userRoles: [],
    given_name: 'Invité'
  })

  // Grant minimal : generateNewGrantId enchaîne addOIDCScope/addResourceScope/save
  const unGrant = (): {
    addOIDCScope: sinon.SinonStub
    addResourceScope: sinon.SinonStub
    save: sinon.SinonStub
  } => ({
    addOIDCScope: sinon.stub(),
    addResourceScope: sinon.stub(),
    save: sinon.stub().resolves('un-grant-id')
  })

  const uneInteraction = (
    grantId?: string
  ): Awaited<ReturnType<OidcService['findInteraction']>> =>
    ({
      uid: interactionId,
      params: { client_id: 'app' },
      grantId
    } as unknown as Awaited<ReturnType<OidcService['findInteraction']>>)

  beforeEach(() => {
    oidcService = stubClass(OidcService)
    passEmploiAPIClient = stubClass(PassEmploiAPIClient)
    response = {} as Response
    inviteService = new InviteService(
      configService,
      oidcService,
      passEmploiAPIClient
    )
    // Injecté par Nest en production. `set` est best-effort (no-op hors
    // requête), un vrai contexte suffit donc ici.
    ;(
      inviteService as unknown as { requestContext: RequestContext }
    ).requestContext = new RequestContext()
  })

  describe('quand le mode app jeune est désactivé', () => {
    it("échoue sans créer d'utilisateur ni chercher l'interaction", async () => {
      // Given
      const serviceDesactive = new InviteService(
        new ConfigService({ appJeuneActif: false }),
        oidcService,
        passEmploiAPIClient
      )

      // When
      const result = await serviceDesactive.connect(interactionId, response)

      // Then
      expect(isFailure(result)).toBe(true)
      sinon.assert.notCalled(passEmploiAPIClient.putUtilisateurInvite)
      sinon.assert.notCalled(oidcService.findInteraction)
    })
  })

  describe('connect', () => {
    it("crée l'invité, ouvre la session et termine l'interaction", async () => {
      // Given
      oidcService.findInteraction.resolves(uneInteraction())
      oidcService.createGrant.returns(
        unGrant() as unknown as ReturnType<OidcService['createGrant']>
      )
      passEmploiAPIClient.putUtilisateurInvite.resolves(success(unInvite()))

      // When
      const result = await inviteService.connect(interactionId, response)

      // Then
      expect(isSuccess(result)).toBe(true)

      // Le sub est fabriqué côté serveur, jamais fourni par le client
      const subAppele =
        passEmploiAPIClient.putUtilisateurInvite.firstCall.args[0]
      expect(subAppele).toBeTruthy()

      const [, , interactionResults] = oidcService.finishInteraction.firstCall
        .args as unknown as [Response, unknown, Record<string, unknown>]

      expect(interactionResults.login).toEqual({
        accountId: Account.fromAccountToAccountId({
          sub: subAppele,
          type: User.Type.JEUNE,
          structure: User.Structure.INVITE
        })
      })
      expect(interactionResults.consent).toEqual({ grantId: 'un-grant-id' })
      expect(interactionResults.userType).toEqual(User.Type.JEUNE)
      expect(interactionResults.userStructure).toEqual(User.Structure.INVITE)
      // userId = l'id en base : c'est lui que le mobile utilisera vers l'API
      expect(interactionResults.userId).toEqual('id-en-base')
    })

    // Régression : l'invité fabrique un accountId neuf à chaque fois. Réutiliser
    // le grant d'une session précédente y laisserait l'ancien accountId, et
    // oidc-provider rejetterait l'autorisation en `accountId mismatch`.
    it('crée un grant neuf même si une session précédente en a déjà un', async () => {
      // Given : une interaction qui porte déjà le grant d'une session précédente
      oidcService.findInteraction.resolves(uneInteraction('grant-precedent'))
      oidcService.createGrant.returns(
        unGrant() as unknown as ReturnType<OidcService['createGrant']>
      )
      passEmploiAPIClient.putUtilisateurInvite.resolves(success(unInvite()))

      // When
      const result = await inviteService.connect(interactionId, response)

      // Then : on ne va jamais rechercher le grant existant
      expect(isSuccess(result)).toBe(true)
      expect(oidcService.findGrant.notCalled).toBe(true)

      // et le grant créé porte bien l'accountId de l'invité
      const subAppele =
        passEmploiAPIClient.putUtilisateurInvite.firstCall.args[0]
      expect(oidcService.createGrant.firstCall.args[0]).toEqual(
        Account.fromAccountToAccountId({
          sub: subAppele,
          type: User.Type.JEUNE,
          structure: User.Structure.INVITE
        })
      )
    })

    it('génère un sub différent à chaque enregistrement', async () => {
      // Given
      oidcService.findInteraction.resolves(uneInteraction())
      oidcService.createGrant.returns(
        unGrant() as unknown as ReturnType<OidcService['createGrant']>
      )
      passEmploiAPIClient.putUtilisateurInvite.resolves(success(unInvite()))

      // When
      await inviteService.connect(interactionId, response)
      await inviteService.connect(interactionId, response)

      // Then
      const premierSub =
        passEmploiAPIClient.putUtilisateurInvite.firstCall.args[0]
      const deuxiemeSub =
        passEmploiAPIClient.putUtilisateurInvite.secondCall.args[0]
      expect(premierSub).not.toEqual(deuxiemeSub)
    })

    it("ne stocke aucun token IDP : l'invité n'a pas d'IDP", async () => {
      // Given
      oidcService.findInteraction.resolves(uneInteraction())
      oidcService.createGrant.returns(
        unGrant() as unknown as ReturnType<OidcService['createGrant']>
      )
      passEmploiAPIClient.putUtilisateurInvite.resolves(success(unInvite()))

      // When
      await inviteService.connect(interactionId, response)

      // Then : aucun aller-retour vers un IDP externe
      expect(passEmploiAPIClient.putUser.notCalled).toBe(true)
    })

    it("échoue quand l'interaction est introuvable", async () => {
      // Given
      oidcService.findInteraction.resolves(undefined)

      // When
      const result = await inviteService.connect(interactionId, response)

      // Then
      expect(isFailure(result)).toBe(true)
      if (isFailure(result)) {
        expect(result.error.reason).toEqual('SessionNotFound')
      }
      expect(oidcService.finishInteraction.notCalled).toBe(true)
    })

    it("remonte l'échec quand l'API refuse de créer l'invité", async () => {
      // Given
      oidcService.findInteraction.resolves(uneInteraction())
      passEmploiAPIClient.putUtilisateurInvite.resolves(
        failure(new UtilisateurNonTraitable())
      )

      // When
      const result = await inviteService.connect(interactionId, response)

      // Then
      expect(isFailure(result)).toBe(true)
      expect(oidcService.finishInteraction.notCalled).toBe(true)
    })
  })
})

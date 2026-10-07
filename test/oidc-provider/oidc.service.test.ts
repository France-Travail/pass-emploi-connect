import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { Request, Response } from 'express'
import { InteractionResults } from 'oidc-provider'
import { PassEmploiAPIClient } from '../../src/api/pass-emploi-api.client'
import { Account } from '../../src/domain/account'
import { OidcService } from '../../src/oidc-provider/oidc.service'
import {
  ErreurReseauIDP,
  NonTrouveError,
  UtilisateurNonTraitable
} from '../../src/utils/result/error'
import { failure, success } from '../../src/utils/result/result'
import { createSandbox, sinon, StubbedClass, stubClass } from '../test-utils'
import { unAccount, unUser } from '../test-utils/fixtures'

// On instancie OidcService SANS son constructeur (qui monte un vrai Provider oidc-provider)
// puis on lui injecte un provider mocké, afin de tester unitairement la récupération
// d'interaction via le state et la reprise sans cookie.
function buildOidcServiceWithProvider(oidc: object): OidcService {
  const service = Object.create(OidcService.prototype) as OidcService
  ;(service as unknown as { oidc: object }).oidc = oidc
  return service
}

// Même principe pour la relecture de l'utilisateur hors authorize : seuls Redis et le client API sont injectés
function buildOidcServiceWithApi(dependances: {
  redisClient: object
  passemploiapiService: object
  apmService?: object
}): OidcService {
  const service = Object.create(OidcService.prototype) as OidcService
  Object.assign(service, dependances)
  return service
}

const TTL_42_JOURS = 3600 * 24 * 42

type FinishableInteraction = Parameters<OidcService['finishInteraction']>[1]

describe('OidcService', () => {
  const sandbox = createSandbox()

  afterEach(() => {
    sandbox.restore()
  })

  describe('recoverInteraction', () => {
    it("récupère l'interaction via le state sans toucher au cookie", async () => {
      // Given
      const interaction = { uid: 'uid-123' }
      const find = sandbox.stub().resolves(interaction)
      const interactionDetails = sandbox.stub()
      const service = buildOidcServiceWithProvider({
        Interaction: { find },
        interactionDetails
      })
      const req = { query: { state: 'uid-123' } } as unknown as Request
      const res = {} as unknown as Response

      // When
      const result = await service.recoverInteraction(req, res)

      // Then
      expect(result).toBe(interaction)
      sinon.assert.calledOnceWithExactly(find, 'uid-123')
      sinon.assert.notCalled(interactionDetails)
    })

    it('retombe sur le cookie (interactionDetails) si le state ne résout aucune interaction', async () => {
      // Given
      const fromCookie = { uid: 'uid-cookie' }
      const find = sandbox.stub().resolves(undefined)
      const interactionDetails = sandbox.stub().resolves(fromCookie)
      const service = buildOidcServiceWithProvider({
        Interaction: { find },
        interactionDetails
      })
      const req = { query: { state: 'uid-123' } } as unknown as Request
      const res = {} as unknown as Response

      // When
      const result = await service.recoverInteraction(req, res)

      // Then
      expect(result).toBe(fromCookie)
      sinon.assert.calledOnceWithExactly(find, 'uid-123')
      sinon.assert.calledOnceWithExactly(interactionDetails, req, res)
    })

    it('retombe sur le cookie (interactionDetails) si le state est absent', async () => {
      // Given
      const fromCookie = { uid: 'uid-cookie' }
      const find = sandbox.stub()
      const interactionDetails = sandbox.stub().resolves(fromCookie)
      const service = buildOidcServiceWithProvider({
        Interaction: { find },
        interactionDetails
      })
      const req = { query: {} } as unknown as Request
      const res = {} as unknown as Response

      // When
      const result = await service.recoverInteraction(req, res)

      // Then
      expect(result).toBe(fromCookie)
      sinon.assert.notCalled(find)
      sinon.assert.calledOnceWithExactly(interactionDetails, req, res)
    })
  })

  describe('finishInteraction', () => {
    it('écrit le résultat, re-pose les 2 cookies et redirige vers returnTo', async () => {
      // Given
      const nowSeconds = Math.floor(Date.now() / 1000)
      const returnTo =
        'https://id.pass-emploi.test/auth/realms/pass-emploi/protocol/openid-connect/auth/uid-123'
      const save = sandbox.stub().resolves('jti')
      const interaction = {
        uid: 'uid-123',
        exp: nowSeconds + 3600,
        returnTo,
        lastSubmission: undefined,
        save
      } as unknown as FinishableInteraction
      const result: InteractionResults = {
        login: { accountId: 'compte-1' },
        consent: { grantId: 'grant-1' }
      }
      const res: StubbedType<Response> = stubInterface(sandbox)
      const service = buildOidcServiceWithProvider({})

      // When
      await service.finishInteraction(res, interaction, result)

      // Then
      expect(interaction.result).toEqual(result)
      sinon.assert.calledOnce(save)

      sinon.assert.calledWith(
        res.cookie as sinon.SinonStub,
        '_interaction',
        'uid-123',
        sinon.match({
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax'
        })
      )
      sinon.assert.calledWith(
        res.cookie as sinon.SinonStub,
        '_interaction_resume',
        'uid-123',
        sinon.match({
          path: '/auth/realms/pass-emploi/protocol/openid-connect/auth/uid-123',
          httpOnly: true,
          secure: true,
          sameSite: 'lax'
        })
      )
      sinon.assert.calledOnceWithExactly(
        res.redirect as sinon.SinonStub,
        303,
        returnTo
      )
    })

    it('fusionne le résultat avec lastSubmission existant', async () => {
      // Given
      const interaction = {
        uid: 'uid-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
        returnTo: 'https://id.pass-emploi.test/x/auth/uid-123',
        lastSubmission: { login: { accountId: 'ancien' }, foo: 'bar' },
        save: sandbox.stub().resolves('jti')
      } as unknown as FinishableInteraction
      const result: InteractionResults = { login: { accountId: 'nouveau' } }
      const res: StubbedType<Response> = stubInterface(sandbox)
      const service = buildOidcServiceWithProvider({})

      // When
      await service.finishInteraction(res, interaction, result)

      // Then : le nouveau login écrase l'ancien, le reste est conservé
      expect(interaction.result).toEqual({
        login: { accountId: 'nouveau' },
        foo: 'bar'
      })
    })
  })

  describe('application du grant', () => {
    it('mémorise l’application du grant pour la durée de vie du grant', async () => {
      // Given
      const set = sandbox.stub().resolves('OK')
      const service = buildOidcServiceWithApi({
        redisClient: { set },
        passemploiapiService: {}
      })

      // When
      await service.memoriserApplicationDuGrant('grant-1', '1j1s')

      // Then
      sinon.assert.calledOnceWithExactly(
        set,
        'application:grant-1',
        '1j1s',
        'EX',
        TTL_42_JOURS
      )
    })

    it('retrouve l’application mémorisée au login', async () => {
      // Given
      const get = sandbox.stub().resolves('pass-emploi')
      const service = buildOidcServiceWithApi({
        redisClient: { get },
        passemploiapiService: {}
      })

      // When
      const application = await service.applicationDuGrant('grant-1')

      // Then
      expect(application).toBe('pass-emploi')
      sinon.assert.calledOnceWithExactly(get, 'application:grant-1')
    })

    it('renvoie undefined quand aucune application n’a été mémorisée (ancien login)', async () => {
      // Given
      const service = buildOidcServiceWithApi({
        redisClient: { get: sandbox.stub().resolves(null) },
        passemploiapiService: {}
      })

      // When
      const application = await service.applicationDuGrant('grant-1')

      // Then
      expect(application).toBeUndefined()
    })
  })

  describe('recupererUtilisateurDepuisApi (refresh, token, userinfo)', () => {
    const account = unAccount()
    const accountId = Account.fromAccountToAccountId(account)
    let passemploiapiService: StubbedClass<PassEmploiAPIClient>
    let captureError: sinon.SinonStub
    let service: OidcService

    beforeEach(() => {
      passemploiapiService = stubClass(PassEmploiAPIClient)
      captureError = sandbox.stub()
      service = buildOidcServiceWithApi({
        redisClient: { get: sandbox.stub().resolves('pass-emploi') },
        passemploiapiService,
        apmService: { captureError }
      })
    })

    it('relit l’utilisateur dans l’API avec l’application mémorisée pour le grant', async () => {
      // Given
      passemploiapiService.getUser.resolves(success(unUser()))

      // When
      const utilisateur = await service.recupererUtilisateurDepuisApi(
        accountId,
        'grant-1'
      )

      // Then
      expect(utilisateur).toEqual(unUser())
      sinon.assert.calledOnceWithExactly(
        passemploiapiService.getUser,
        account,
        'pass-emploi'
      )
    })

    it('relit sans application quand aucun grant n’est en jeu', async () => {
      // Given
      passemploiapiService.getUser.resolves(success(unUser()))

      // When
      await service.recupererUtilisateurDepuisApi(accountId)

      // Then
      sinon.assert.calledOnceWithExactly(
        passemploiapiService.getUser,
        account,
        undefined
      )
    })

    it('renvoie undefined quand le compte est introuvable (404) : invalid_grant au refresh', async () => {
      // Given
      passemploiapiService.getUser.resolves(
        failure(new NonTrouveError('Utilisateur', account.sub))
      )

      // When
      const utilisateur = await service.recupererUtilisateurDepuisApi(
        accountId,
        'grant-1'
      )

      // Then
      expect(utilisateur).toBeUndefined()
    })

    it('renvoie undefined quand l’API refuse l’utilisateur (jeune migré) : invalid_grant au refresh, l’app déconnecte', async () => {
      // Given
      passemploiapiService.getUser.resolves(
        failure(new UtilisateurNonTraitable('MIGRATION_PARCOURS_EMPLOI'))
      )

      // When
      const utilisateur = await service.recupererUtilisateurDepuisApi(
        accountId,
        'grant-1'
      )

      // Then
      expect(utilisateur).toBeUndefined()
      sinon.assert.notCalled(captureError)
    })

    it('lève une erreur (pas de déconnexion) quand l’API est en échec', async () => {
      // Given
      passemploiapiService.getUser.resolves(
        failure(new ErreurReseauIDP('API KO'))
      )

      // When / Then
      await expect(
        service.recupererUtilisateurDepuisApi(accountId, 'grant-1')
      ).rejects.toThrow('Could not get user from API')
      sinon.assert.calledOnce(captureError)
    })
  })
})

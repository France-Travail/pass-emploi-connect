import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { Request, Response } from 'express'
import { InteractionResults } from 'oidc-provider'
import { OidcService } from '../../src/oidc-provider/oidc.service'
import { createSandbox, sinon } from '../test-utils'

// On instancie OidcService SANS son constructeur (qui monte un vrai Provider oidc-provider)
// puis on lui injecte un provider mocké, afin de tester unitairement la récupération
// d'interaction via le state et la reprise sans cookie.
function buildOidcServiceWithProvider(oidc: object): OidcService {
  const service = Object.create(OidcService.prototype) as OidcService
  ;(service as unknown as { oidc: object }).oidc = oidc
  return service
}

function buildOidcServiceAvecRedis(
  oidc: object,
  redisClient: object
): OidcService {
  const service = buildOidcServiceWithProvider(oidc)
  ;(service as unknown as { redisClient: object }).redisClient = redisClient
  return service
}

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

  describe('indexerGrantInvite', () => {
    it("indexe le grant par l'accountId de l'invité, sans expiration", async () => {
      // Given
      const redisClient = { set: sandbox.stub().resolves('OK') }
      const service = buildOidcServiceAvecRedis({}, redisClient)

      // When
      await service.indexerGrantInvite('JEUNE|INVITE|sub-invite', 'grant-1')

      // Then
      sinon.assert.calledOnceWithExactly(
        redisClient.set,
        'grant_invite:JEUNE|INVITE|sub-invite',
        'grant-1'
      )
    })
  })

  describe('revoquerGrantInvite', () => {
    const accountId = 'JEUNE|INVITE|sub-invite'
    const cleIndex = 'grant_invite:JEUNE|INVITE|sub-invite'

    it("révoque les tokens, détruit le grant puis supprime l'index", async () => {
      // Given
      const grant = { destroy: sandbox.stub().resolves() }
      const oidc = {
        RefreshToken: { revokeByGrantId: sandbox.stub().resolves() },
        Grant: { find: sandbox.stub().resolves(grant) }
      }
      const redisClient = {
        get: sandbox.stub().resolves('grant-1'),
        del: sandbox.stub().resolves(1)
      }
      const service = buildOidcServiceAvecRedis(oidc, redisClient)

      // When
      const revoque = await service.revoquerGrantInvite(accountId)

      // Then
      expect(revoque).toBe(true)
      sinon.assert.calledOnceWithExactly(redisClient.get, cleIndex)
      sinon.assert.calledOnceWithExactly(
        oidc.RefreshToken.revokeByGrantId,
        'grant-1'
      )
      sinon.assert.calledOnceWithExactly(oidc.Grant.find, 'grant-1')
      sinon.assert.calledOnceWithExactly(redisClient.del, cleIndex)
      // index en dernier : si une étape casse, le job de purge pourra rejouer
      sinon.assert.callOrder(
        oidc.RefreshToken.revokeByGrantId,
        grant.destroy,
        redisClient.del
      )
    })

    it("supprime l'index même si le grant a déjà été détruit", async () => {
      // Given
      const oidc = {
        RefreshToken: { revokeByGrantId: sandbox.stub().resolves() },
        Grant: { find: sandbox.stub().resolves(undefined) }
      }
      const redisClient = {
        get: sandbox.stub().resolves('grant-1'),
        del: sandbox.stub().resolves(1)
      }
      const service = buildOidcServiceAvecRedis(oidc, redisClient)

      // When
      const revoque = await service.revoquerGrantInvite(accountId)

      // Then
      expect(revoque).toBe(true)
      sinon.assert.calledOnceWithExactly(redisClient.del, cleIndex)
    })

    it("ne révoque rien quand l'invité n'a pas d'index", async () => {
      // Given
      const oidc = {
        RefreshToken: { revokeByGrantId: sandbox.stub() },
        Grant: { find: sandbox.stub() }
      }
      const redisClient = {
        get: sandbox.stub().resolves(null),
        del: sandbox.stub()
      }
      const service = buildOidcServiceAvecRedis(oidc, redisClient)

      // When
      const revoque = await service.revoquerGrantInvite(accountId)

      // Then
      expect(revoque).toBe(false)
      sinon.assert.notCalled(oidc.RefreshToken.revokeByGrantId)
      sinon.assert.notCalled(redisClient.del)
    })
  })
})

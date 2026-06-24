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

type FinishableInteraction = Parameters<OidcService['finishInteraction']>[1]

describe('OidcService', () => {
  const sandbox = createSandbox()

  afterEach(() => {
    sandbox.restore()
  })

  describe('recoverInteraction', () => {
    it("récupère l'interaction via le state (sans type) sans toucher au cookie", async () => {
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

    it("récupère l'interaction via le state encodé `${type}.${uid}`", async () => {
      // Given
      const interaction = { uid: 'uid-123' }
      const find = sandbox.stub().resolves(interaction)
      const service = buildOidcServiceWithProvider({
        Interaction: { find },
        interactionDetails: sandbox.stub()
      })
      const req = { query: { state: 'cej.uid-123' } } as unknown as Request

      // When
      const result = await service.recoverInteraction(
        req,
        {} as unknown as Response
      )

      // Then
      expect(result).toBe(interaction)
      sinon.assert.calledOnceWithExactly(find, 'uid-123')
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
      const req = { query: { state: 'cej.uid-123' } } as unknown as Request
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
})

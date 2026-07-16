import nock from 'nock'
import { PassEmploiAPIClient } from '../../src/api/pass-emploi-api.client'
import { ExternalApiLoggerService } from '../../src/utils/monitoring/external-api-logger.service'
import { ErreurReseauIDP, NonTrouveError } from '../../src/utils/result/error'
import {
  failure,
  isFailure,
  isSuccess,
  success
} from '../../src/utils/result/result'
import { unAccount, unPassEmploiUser, unUser } from '../test-utils/fixtures'
import { testConfig } from '../test-utils/module-for-testing'

describe('PassEmploiAPIClient', () => {
  let passEmploiAPIClient: PassEmploiAPIClient
  const configService = testConfig()

  beforeEach(() => {
    const externalApiLogger = new ExternalApiLoggerService()
    passEmploiAPIClient = new PassEmploiAPIClient(
      configService,
      externalApiLogger
    )
  })
  describe('putUser', () => {
    it("retourne l'utilisateur lorsque l'appel est ok", async () => {
      // Given
      const apiUser = {
        id: 'un-id',
        type: 'CONSEILLER',
        structure: 'MILO',
        prenom: 'Bruno',
        roles: [],
        nom: 'Dumont',
        email: 'zema@octo.com',
        username: 'b.dumont'
      }

      nock('https://api.pass-emploi.fr')
        .put(
          '/auth/users/un-sub',
          unPassEmploiUser() as unknown as nock.RequestBodyMatcher
        )
        .reply(200, apiUser)
        .isDone()

      // When
      const response = await passEmploiAPIClient.putUser(
        'un-sub',
        unPassEmploiUser()
      )

      // Then
      expect(response).toEqual(success(unUser()))
    })
    it("retourne une failure quand l'appel d'API échoue avec un code NonTraitable connu", async () => {
      // Given
      const utilisateur = unPassEmploiUser({
        prenom: 'Bruno',
        nom: 'Dumont',
        email: 'dumont@octo.com'
      })
      nock('https://api.pass-emploi.fr')
        .put(
          '/auth/users/un-sub',
          utilisateur as unknown as nock.RequestBodyMatcher
        )
        .reply(422, {
          reason: 'UTILISATEUR_INEXISTANT',
          email: utilisateur.email
        })
        .isDone()

      // When

      const response = await passEmploiAPIClient.putUser('un-sub', utilisateur)

      // Then
      expect(response).toEqual({
        _isSuccess: false,
        error: {
          code: 'UTILISATEUR_NON_TRAITABLE',
          email: 'dumont@octo.com',
          message: 'Utilisateur non traitable',
          nom: 'Dumont',
          prenom: 'Bruno',
          reason: 'UTILISATEUR_INEXISTANT'
        }
      })
    })
    it("retourne une failure quand l'appel d'API échoue avec un code NonTraitable inconnu", async () => {
      // Given
      const utilisateur = unPassEmploiUser({
        prenom: 'Bruno',
        nom: 'Dumont',
        email: 'dumont@octo.com'
      })
      nock('https://api.pass-emploi.fr')
        .put(
          '/auth/users/un-sub',
          utilisateur as unknown as nock.RequestBodyMatcher
        )
        .reply(422, { code: 'INCONNU', email: utilisateur.email })
        .isDone()

      // When
      const response = await passEmploiAPIClient.putUser('un-sub', utilisateur)

      // Then
      expect(response).toEqual({
        _isSuccess: false,
        error: {
          code: 'UTILISATEUR_NON_TRAITABLE',
          email: 'dumont@octo.com',
          message: 'Utilisateur non traitable',
          nom: 'Dumont',
          prenom: 'Bruno',
          reason: 'INCONNU'
        }
      })
    })
  })
  describe('putUtilisateurInvite', () => {
    it("crée l'invité et retourne l'utilisateur, sans données d'IDP", async () => {
      // Given : l'API renvoie le jeune invité (prenom -> given_name du JWT)
      const apiUser = {
        id: 'id-en-base',
        type: 'JEUNE',
        structure: 'INVITE',
        prenom: 'Invité',
        nom: '',
        roles: []
      }

      nock('https://api.pass-emploi.fr')
        .put('/auth/users/invite/un-sub-invite', {})
        .reply(200, apiUser)
        .isDone()

      // When
      const response = await passEmploiAPIClient.putUtilisateurInvite(
        'un-sub-invite'
      )

      // Then
      expect(response).toEqual(
        success({
          userId: 'id-en-base',
          userType: 'JEUNE',
          userStructure: 'INVITE',
          userRoles: [],
          given_name: 'Invité'
        })
      )

      // family_name et email sont absents (pas vides) : les claims seront omis du JWT
      expect(isSuccess(response)).toBe(true)
      if (isSuccess(response)) {
        expect('family_name' in response.data).toBe(false)
        expect('email' in response.data).toBe(false)
      }
    })

    it("retourne un échec quand l'API refuse", async () => {
      // Given
      nock('https://api.pass-emploi.fr')
        .put('/auth/users/invite/un-sub-invite', {})
        .reply(400, { reason: 'STRUCTURE_UTILISATEUR_NON_TRAITABLE' })
        .isDone()

      // When
      const response = await passEmploiAPIClient.putUtilisateurInvite(
        'un-sub-invite'
      )

      // Then
      expect(isFailure(response)).toBe(true)
    })
  })

  describe('getUser', () => {
    it("retourne l'utilisateur lorsque l'appel est ok", async () => {
      // Given
      const account = unAccount()
      const apiUser = {
        id: 'un-id',
        type: 'CONSEILLER',
        structure: 'MILO',
        prenom: 'Bruno',
        roles: [],
        nom: 'Dumont',
        email: 'zema@octo.com',
        username: 'b.dumont'
      }
      nock('https://api.pass-emploi.fr')
        .get('/auth/users/un-sub')
        .query({
          typeUtilisateur: account.type,
          structureUtilisateur: account.structure
        })
        .reply(200, apiUser)
        .isDone()

      // When
      const response = await passEmploiAPIClient.getUser(account)

      // Then
      expect(response).toEqual(success(unUser()))
    })
    it('retourne une NonTrouveError quand le compte est introuvable (404)', async () => {
      // Given
      const account = unAccount()
      nock('https://api.pass-emploi.fr')
        .get('/auth/users/un-sub')
        .query({
          typeUtilisateur: account.type,
          structureUtilisateur: account.structure
        })
        .reply(404)
        .isDone()

      // When
      const response = await passEmploiAPIClient.getUser(unAccount())

      // Then
      expect(response).toEqual(
        failure(new NonTrouveError('Utilisateur', account.sub))
      )
    })
    it("retourne une ErreurReseauIDP quand l'API échoue autrement (5xx)", async () => {
      // Given
      const account = unAccount()
      nock('https://api.pass-emploi.fr')
        .get('/auth/users/un-sub')
        .query({
          typeUtilisateur: account.type,
          structureUtilisateur: account.structure
        })
        .reply(500)
        .isDone()

      // When
      const response = await passEmploiAPIClient.getUser(unAccount())

      // Then
      expect(isFailure(response)).toBe(true)
      if (isFailure(response)) {
        expect(response.error.code).toBe(ErreurReseauIDP.CODE)
      }
    })
  })
})

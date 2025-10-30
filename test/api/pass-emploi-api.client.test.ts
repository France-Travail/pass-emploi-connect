import { HttpService } from '@nestjs/axios'
import { expect } from 'chai'
import * as nock from 'nock'
import { PassEmploiAPIClient } from '../../src/api/pass-emploi-api.client'
import {
  NonTrouveError,
  UtilisateurNonTraitable
} from '../../src/utils/result/error'
import { failure, Result, success } from '../../src/utils/result/result'
import { unAccount, unPassEmploiUser, unUser } from '../test-utils/fixtures'
import { testConfig } from '../test-utils/module-for-testing'
import { User } from '../../src/domain/user'

describe('PassEmploiAPIClient', () => {
  let passEmploiAPIClient: PassEmploiAPIClient
  const configService = testConfig()

  beforeEach(() => {
    const httpService = new HttpService()
    passEmploiAPIClient = new PassEmploiAPIClient(configService, httpService)
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
      expect(response).to.deep.equal(success(unUser()))
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
      expect(response).to.deep.equal({
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
      expect(response).to.deep.equal({
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
      expect(response).to.deep.equal(success(unUser()))
    })
    it("retourne une failure quand l'appel d'API échoue", async () => {
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
      expect(response).to.deep.equal(
        failure(new NonTrouveError('Utilisateur', account.sub))
      )
    })
  })
})

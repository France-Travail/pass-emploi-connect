import nock from 'nock'
import { FrancetravailAPIClient } from '../../src/api/francetravail-api.client'
import { ExternalApiLoggerService } from '../../src/utils/monitoring/external-api-logger.service'
import { failure, success } from '../../src/utils/result/result'
import { testConfig } from '../test-utils/module-for-testing'
import { NonTrouveError } from '../../src/utils/result/error'

describe('FrancetravailAPIClient', () => {
  let francetravailAPIClient: FrancetravailAPIClient
  const configService = testConfig()

  beforeEach(() => {
    const externalApiLogger = new ExternalApiLoggerService()
    francetravailAPIClient = new FrancetravailAPIClient(
      configService,
      externalApiLogger
    )
  })
  describe('getCoordonness', () => {
    it("retourne les coordonnees lorsque l'appel est ok", async () => {
      // Given
      const token = 'tok'

      nock('https://pe.qvr', {
        reqheaders: {
          Authorization: () => true
        }
      })
        .get('/peconnect-coordonnees/v1/coordonnees')
        .reply(200, { nom: 'toto', prenom: 'titi', email: 'tata' })
        .isDone()

      // When
      const result = await francetravailAPIClient.getCoordonness(token)

      // Then
      expect(result).toEqual(
        success({ nom: 'toto', prenom: 'titi', email: 'tata' })
      )
    })
    it("retourne failure lorsque l'appel est ko", async () => {
      // Given
      const token = 'tok'

      nock('https://pe.qvr', {
        reqheaders: {
          Authorization: () => true
        }
      })
        .get('/peconnect-coordonnees/v1/coordonnees')
        .reply(500)
        .isDone()

      // When
      const result = await francetravailAPIClient.getCoordonness(token)

      // Then
      expect(result).toEqual(failure(new NonTrouveError('Coordonnées FT')))
    })
  })

  describe('getStatut', () => {
    it('retourne estDemandeurEmploi=true quand codeStatutIndividu vaut 1', async () => {
      // Given
      nock('https://pe.qvr', { reqheaders: { Authorization: () => true } })
        .get('/peconnect-statut/v1/statut')
        .reply(200, {
          codeStatutIndividu: '1',
          libelleStatutIndividu: "Demandeur d'emploi"
        })
        .isDone()

      // When
      const result = await francetravailAPIClient.getStatut('tok')

      // Then
      expect(result).toEqual(success({ estDemandeurEmploi: true }))
    })

    it('retourne estDemandeurEmploi=false quand codeStatutIndividu vaut 0', async () => {
      // Given
      nock('https://pe.qvr', { reqheaders: { Authorization: () => true } })
        .get('/peconnect-statut/v1/statut')
        .reply(200, {
          codeStatutIndividu: '0',
          libelleStatutIndividu: "Non demandeur d'emploi"
        })
        .isDone()

      // When
      const result = await francetravailAPIClient.getStatut('tok')

      // Then
      expect(result).toEqual(success({ estDemandeurEmploi: false }))
    })

    it("retourne failure lorsque l'appel est ko", async () => {
      // Given
      nock('https://pe.qvr', { reqheaders: { Authorization: () => true } })
        .get('/peconnect-statut/v1/statut')
        .reply(500)
        .isDone()

      // When
      const result = await francetravailAPIClient.getStatut('tok')

      // Then
      expect(result).toEqual(failure(new NonTrouveError('Statut FT')))
    })
  })
})

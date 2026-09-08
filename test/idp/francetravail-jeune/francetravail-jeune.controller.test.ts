import sinon from 'sinon'
import { HttpStatus, INestApplication } from '@nestjs/common'
import request from 'supertest'
import {
  emptySuccess,
  failure,
  success
} from '../../../src/utils/result/result'
import { StubbedClass } from '../../test-utils'
import {
  getApplicationWithStubbedDependencies,
  resetSandbox
} from '../../test-utils/module-for-testing'
import { AuthError } from '../../../src/utils/result/error'
import { FrancetravailJeuneService } from '../../../src/idp/francetravail-jeune/francetravail-jeune.service'

describe('FrancetravailJeuneController', () => {
  let francetravailJeuneService: StubbedClass<FrancetravailJeuneService>
  let app: INestApplication
  beforeAll(async () => {
    app = await getApplicationWithStubbedDependencies()

    francetravailJeuneService = app.get(FrancetravailJeuneService)
  })

  afterEach(() => {
    resetSandbox()
  })

  describe('GET /francetravail-jeune/connect/:interactionId', () => {
    describe('default - ft jeune', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        francetravailJeuneService.getAuthorizationUrl.returns(
          success('une-url')
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-jeune/connect/interactionId')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        sinon.assert.calledOnceWithExactly(
          francetravailJeuneService.getAuthorizationUrl,
          'interactionId'
        )
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailJeuneService.getAuthorizationUrl.returns(
          failure(new AuthError('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-jeune/connect/interactionId')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=JEUNE&structureUtilisateur=FRANCE_TRAVAIL'
          )

        sinon.assert.calledOnceWithExactly(
          francetravailJeuneService.getAuthorizationUrl,
          'interactionId'
        )
      })
    })
  })

  describe('GET /auth/realms/pass-emploi/broker/pe-jeune/endpoint', () => {
    describe('default - ft jeune', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        francetravailJeuneService.callback.resolves(emptySuccess())

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-jeune/endpoint')
          .query({ state: 'interaction-id' })
          .expect(HttpStatus.OK)

        sinon.assert.calledOnce(francetravailJeuneService.callback)
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailJeuneService.callback.resolves(
          failure(new AuthError('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-jeune/endpoint')
          .query({ state: 'interaction-id' })
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=JEUNE&structureUtilisateur=FRANCE_TRAVAIL'
          )

        sinon.assert.calledOnce(francetravailJeuneService.callback)
      })
    })
  })
})

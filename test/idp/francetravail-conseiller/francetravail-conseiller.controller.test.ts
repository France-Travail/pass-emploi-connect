import sinon from 'sinon'
import { HttpStatus, INestApplication } from '@nestjs/common'
import request from 'supertest'
import { FrancetravailConseillerService } from '../../../src/idp/francetravail-conseiller/francetravail-conseiller.service'
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

describe('FrancetravailConseillerController', () => {
  let francetravailConseillerService: StubbedClass<FrancetravailConseillerService>
  let app: INestApplication
  beforeAll(async () => {
    app = await getApplicationWithStubbedDependencies()
    francetravailConseillerService = app.get(FrancetravailConseillerService)
  })

  afterEach(() => {
    resetSandbox()
  })

  describe('GET /francetravail-conseiller/connect/:interactionId', () => {
    it('renvoie une url quand tout va bien', async () => {
      // Given
      francetravailConseillerService.getAuthorizationUrl.returns(
        success('une-url')
      )

      // When - Then
      await request(app.getHttpServer())
        .get('/francetravail-conseiller/connect/interactionId')
        .expect(HttpStatus.TEMPORARY_REDIRECT)
        .expect('Location', 'une-url')

      sinon.assert.calledOnceWithExactly(
        francetravailConseillerService.getAuthorizationUrl,
        'interactionId'
      )
    })

    it('redirige vers le web en cas de failure', async () => {
      // Given
      francetravailConseillerService.getAuthorizationUrl.returns(
        failure(new AuthError('NO_REASON'))
      )

      // When - Then
      await request(app.getHttpServer())
        .get('/francetravail-conseiller/connect/interactionId')
        .expect(HttpStatus.TEMPORARY_REDIRECT)
        .expect(
          'Location',
          'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=CONSEILLER&structureUtilisateur=FRANCE_TRAVAIL'
        )
    })
  })

  describe('GET /auth/realms/pass-emploi/broker/pe-conseiller/endpoint', () => {
    it('termine sans erreur quand tout va bien', async () => {
      // Given
      francetravailConseillerService.callback.resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
        .query({ state: 'interaction-id' })
        .expect(HttpStatus.OK)

      sinon.assert.calledOnce(francetravailConseillerService.callback)
    })

    it('redirige vers le web en cas de failure', async () => {
      // Given
      francetravailConseillerService.callback.resolves(
        failure(new AuthError('NO_REASON'))
      )

      // When - Then
      await request(app.getHttpServer())
        .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
        .query({ state: 'interaction-id' })
        .expect(HttpStatus.TEMPORARY_REDIRECT)
        .expect(
          'Location',
          'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=CONSEILLER&structureUtilisateur=FRANCE_TRAVAIL'
        )
    })
  })
})

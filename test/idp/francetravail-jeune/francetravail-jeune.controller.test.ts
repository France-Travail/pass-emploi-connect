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
import { FrancetravailBeneficiaireService } from '../../../src/idp/francetravail-jeune/francetravail-beneficiaire.service'

describe('FrancetravailJeuneController', () => {
  let francetravailBeneficiaireService: StubbedClass<FrancetravailBeneficiaireService>
  let app: INestApplication
  beforeAll(async () => {
    app = await getApplicationWithStubbedDependencies()

    francetravailBeneficiaireService = app.get(FrancetravailBeneficiaireService)
  })

  afterEach(() => {
    resetSandbox()
  })

  describe('GET /francetravail-jeune/connect/:interactionId', () => {
    describe('default - ft beneficiaire', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        francetravailBeneficiaireService.getAuthorizationUrl.returns(
          success('une-url')
        )

        // When - Then
        await request(app.getHttpServer())
          .get(
            '/francetravail-jeune/connect/interactionId?type=ft-beneficiaire'
          )
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        sinon.assert.calledOnceWithExactly(
          francetravailBeneficiaireService.getAuthorizationUrl,
          'interactionId',
          'ft-beneficiaire'
        )
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailBeneficiaireService.getAuthorizationUrl.returns(
          failure(new AuthError('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get(
            '/francetravail-jeune/connect/interactionId?type=ft-beneficiaire'
          )
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=JEUNE&structureUtilisateur=FRANCE_TRAVAIL'
          )

        sinon.assert.calledOnceWithExactly(
          francetravailBeneficiaireService.getAuthorizationUrl,
          'interactionId',
          'ft-beneficiaire'
        )
      })
    })
  })

  describe('GET /auth/realms/pass-emploi/broker/pe-jeune/endpoint', () => {
    describe('defualt - ft beneficiaire', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        francetravailBeneficiaireService.callback.resolves(emptySuccess())

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-jeune/endpoint')
          .query({ state: 'ft-beneficiaire.interaction-id' })
          .expect(HttpStatus.OK)

        sinon.assert.calledOnce(francetravailBeneficiaireService.callback)
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailBeneficiaireService.callback.resolves(
          failure(new AuthError('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-jeune/endpoint')
          .query({ state: 'ft-beneficiaire.interaction-id' })
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=JEUNE&structureUtilisateur=FRANCE_TRAVAIL'
          )

        sinon.assert.calledOnce(francetravailBeneficiaireService.callback)
      })
    })
  })
})

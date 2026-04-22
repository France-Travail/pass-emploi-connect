import sinon from 'sinon'
import { HttpStatus, INestApplication } from '@nestjs/common'
import request from 'supertest'
import { FrancetravailJeuneCEJService } from '../../../src/idp/francetravail-jeune/francetravail-jeune.service'
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
import { FrancetravailBRSAService } from '../../../src/idp/francetravail-jeune/francetravail-brsa.service'
import { FrancetravailAIJService } from '../../../src/idp/francetravail-jeune/francetravail-aij.service'
import {
  AuthError,
  UtilisateurNonTraitable,
  NonTrouveError
} from '../../../src/utils/result/error'
import { FrancetravailBeneficiaireService } from '../../../src/idp/francetravail-jeune/francetravail-beneficiaire.service'

describe('FrancetravailJeuneController', () => {
  let francetravailJeuneCEJService: StubbedClass<FrancetravailJeuneCEJService>
  let francetravailBeneficiaireService: StubbedClass<FrancetravailBeneficiaireService>
  let francetravailAIJService: StubbedClass<FrancetravailAIJService>
  let francetravailBRSAService: StubbedClass<FrancetravailBRSAService>
  let app: INestApplication
  beforeAll(async () => {
    app = await getApplicationWithStubbedDependencies()

    francetravailJeuneCEJService = app.get(FrancetravailJeuneCEJService)
    francetravailBeneficiaireService = app.get(FrancetravailBeneficiaireService)
    francetravailAIJService = app.get(FrancetravailAIJService)
    francetravailBRSAService = app.get(FrancetravailBRSAService)
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
    describe('CEJ', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        francetravailJeuneCEJService.getAuthorizationUrl.returns(
          success('une-url')
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-jeune/connect/interactionId?type=cej')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        sinon.assert.calledOnceWithExactly(
          francetravailJeuneCEJService.getAuthorizationUrl,
          'interactionId',
          'cej'
        )
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailJeuneCEJService.getAuthorizationUrl.returns(
          failure(new AuthError('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-jeune/connect/interactionId?type=cej')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=JEUNE&structureUtilisateur=POLE_EMPLOI'
          )

        sinon.assert.calledOnceWithExactly(
          francetravailJeuneCEJService.getAuthorizationUrl,
          'interactionId',
          'cej'
        )
      })
    })
    describe('BRSA', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        francetravailBRSAService.getAuthorizationUrl.returns(success('une-url'))

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-jeune/connect/interactionId?type=brsa')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        sinon.assert.calledOnceWithExactly(
          francetravailBRSAService.getAuthorizationUrl,
          'interactionId',
          'brsa'
        )
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailBRSAService.getAuthorizationUrl.returns(
          failure(new NonTrouveError('User'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-jeune/connect/interactionId?type=brsa')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NON_TROUVE&typeUtilisateur=JEUNE&structureUtilisateur=POLE_EMPLOI_BRSA'
          )

        sinon.assert.calledOnceWithExactly(
          francetravailBRSAService.getAuthorizationUrl,
          'interactionId',
          'brsa'
        )
      })
    })
    describe('AIJ', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        francetravailAIJService.getAuthorizationUrl.returns(success('une-url'))

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-jeune/connect/interactionId?type=aij')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        sinon.assert.calledOnceWithExactly(
          francetravailAIJService.getAuthorizationUrl,
          'interactionId',
          'aij'
        )
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailAIJService.getAuthorizationUrl.returns(
          failure(new UtilisateurNonTraitable('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-jeune/connect/interactionId?type=aij')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=JEUNE&structureUtilisateur=POLE_EMPLOI_AIJ'
          )

        sinon.assert.calledOnceWithExactly(
          francetravailAIJService.getAuthorizationUrl,
          'interactionId',
          'aij'
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
          .query({ state: 'ft-beneficiaire' })
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
          .query({ state: 'ft-beneficiaire' })
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=JEUNE&structureUtilisateur=FRANCE_TRAVAIL'
          )

        sinon.assert.calledOnce(francetravailBeneficiaireService.callback)
      })
    })
    describe('CEJ', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        francetravailJeuneCEJService.callback.resolves(emptySuccess())

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-jeune/endpoint')
          .query({ state: 'cej' })
          .expect(HttpStatus.OK)

        sinon.assert.calledOnce(francetravailJeuneCEJService.callback)
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailJeuneCEJService.callback.resolves(
          failure(new AuthError('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-jeune/endpoint')
          .query({ state: 'cej' })
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=JEUNE&structureUtilisateur=POLE_EMPLOI'
          )

        sinon.assert.calledOnce(francetravailJeuneCEJService.callback)
      })
    })
    describe('BRSA', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        francetravailBRSAService.callback.resolves(emptySuccess())

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-jeune/endpoint')
          .query({ state: 'brsa' })
          .expect(HttpStatus.OK)

        sinon.assert.calledOnce(francetravailBRSAService.callback)
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailBRSAService.callback.resolves(
          failure(new NonTrouveError('User'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-jeune/endpoint')
          .query({ state: 'brsa' })
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NON_TROUVE&typeUtilisateur=JEUNE&structureUtilisateur=POLE_EMPLOI_BRSA'
          )

        sinon.assert.calledOnce(francetravailBRSAService.callback)
      })
    })
    describe('AIJ', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        francetravailAIJService.callback.resolves(emptySuccess())

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-jeune/endpoint')
          .query({ state: 'aij' })
          .expect(HttpStatus.OK)

        sinon.assert.calledOnce(francetravailAIJService.callback)
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailAIJService.callback.resolves(
          failure(new UtilisateurNonTraitable('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-jeune/endpoint')
          .query({ state: 'aij' })
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=JEUNE&structureUtilisateur=POLE_EMPLOI_AIJ'
          )

        sinon.assert.calledOnce(francetravailAIJService.callback)
      })
    })
  })
})

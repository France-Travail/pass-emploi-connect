import sinon from 'sinon'
import { HttpStatus, INestApplication } from '@nestjs/common'
import { FrancetravailConseillerAccompagnementGlobalService } from 'src/idp/francetravail-conseiller/francetravail-conseiller-accompagnement-global.service'
import { FrancetravailConseillerAccompagnementIntensifService } from 'src/idp/francetravail-conseiller/francetravail-conseiller-accompagnement-intensif.service'
import { FrancetravailConseillerEquipEmploiRecrutService } from 'src/idp/francetravail-conseiller/francetravail-conseiller-equip-emploi-recrut.service'
import request from 'supertest'
import { FrancetravailConseillerCEJService } from '../../../src/idp/francetravail-conseiller/francetravail-conseiller-cej.service'
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
import { FrancetravailConseillerBRSAService } from '../../../src/idp/francetravail-conseiller/francetravail-conseiller-brsa.service'
import { FrancetravailConseillerAIJService } from '../../../src/idp/francetravail-conseiller/francetravail-conseiller-aij.service'
import {
  AuthError,
  UtilisateurNonTraitable,
  NonTrouveError
} from '../../../src/utils/result/error'

describe('FrancetravailConseillerController', () => {
  let francetravailConseillerCEJService: StubbedClass<FrancetravailConseillerCEJService>
  let francetravailConseillerAIJService: StubbedClass<FrancetravailConseillerAIJService>
  let francetravailConseillerBRSAService: StubbedClass<FrancetravailConseillerBRSAService>
  let francetravailConseillerAccompagnementIntensifService: StubbedClass<FrancetravailConseillerAccompagnementIntensifService>
  let francetravailConseillerAccompagnementGlobalService: StubbedClass<FrancetravailConseillerAccompagnementGlobalService>
  let francetravailConseillerEquipEmploiRecrutService: StubbedClass<FrancetravailConseillerEquipEmploiRecrutService>
  let app: INestApplication
  beforeAll(async () => {
    app = await getApplicationWithStubbedDependencies()

    francetravailConseillerCEJService = app.get(
      FrancetravailConseillerCEJService
    )
    francetravailConseillerAIJService = app.get(
      FrancetravailConseillerAIJService
    )
    francetravailConseillerBRSAService = app.get(
      FrancetravailConseillerBRSAService
    )
    francetravailConseillerAccompagnementIntensifService = app.get(
      FrancetravailConseillerAccompagnementIntensifService
    )
    francetravailConseillerAccompagnementGlobalService = app.get(
      FrancetravailConseillerAccompagnementGlobalService
    )
    francetravailConseillerEquipEmploiRecrutService = app.get(
      FrancetravailConseillerEquipEmploiRecrutService
    )
  })

  afterEach(() => {
    resetSandbox()
  })

  describe('GET /francetravail-conseiller/connect/:interactionId', () => {
    describe('CEJ', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        francetravailConseillerCEJService.getAuthorizationUrl.returns(
          success('une-url')
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-conseiller/connect/interactionId?type=cej')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        sinon.assert.calledOnceWithExactly(
          francetravailConseillerCEJService.getAuthorizationUrl,
          'interactionId',
          'cej'
        )
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailConseillerCEJService.getAuthorizationUrl.returns(
          failure(new AuthError('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-conseiller/connect/interactionId?type=cej')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=CONSEILLER&structureUtilisateur=POLE_EMPLOI'
          )

        sinon.assert.calledOnceWithExactly(
          francetravailConseillerCEJService.getAuthorizationUrl,
          'interactionId',
          'cej'
        )
      })
    })

    describe('BRSA', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        francetravailConseillerBRSAService.getAuthorizationUrl.returns(
          success('une-url')
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-conseiller/connect/interactionId?type=brsa')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        sinon.assert.calledOnceWithExactly(
          francetravailConseillerBRSAService.getAuthorizationUrl,
          'interactionId',
          'brsa'
        )
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailConseillerBRSAService.getAuthorizationUrl.returns(
          failure(new NonTrouveError('User'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-conseiller/connect/interactionId?type=brsa')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NON_TROUVE&typeUtilisateur=CONSEILLER&structureUtilisateur=POLE_EMPLOI_BRSA'
          )

        sinon.assert.calledOnceWithExactly(
          francetravailConseillerBRSAService.getAuthorizationUrl,
          'interactionId',
          'brsa'
        )
      })
    })

    describe('AIJ', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        francetravailConseillerAIJService.getAuthorizationUrl.returns(
          success('une-url')
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-conseiller/connect/interactionId?type=aij')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        sinon.assert.calledOnceWithExactly(
          francetravailConseillerAIJService.getAuthorizationUrl,
          'interactionId',
          'aij'
        )
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailConseillerAIJService.getAuthorizationUrl.returns(
          failure(new UtilisateurNonTraitable('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/francetravail-conseiller/connect/interactionId?type=aij')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=CONSEILLER&structureUtilisateur=POLE_EMPLOI_AIJ'
          )

        sinon.assert.calledOnceWithExactly(
          francetravailConseillerAIJService.getAuthorizationUrl,
          'interactionId',
          'aij'
        )
      })
    })

    describe('Accompagnement intensif', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        francetravailConseillerAccompagnementIntensifService.getAuthorizationUrl.returns(
          success('une-url')
        )

        // When - Then
        await request(app.getHttpServer())
          .get(
            '/francetravail-conseiller/connect/interactionId?type=accompagnement-intensif'
          )
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        sinon.assert.calledOnceWithExactly(
          francetravailConseillerAccompagnementIntensifService.getAuthorizationUrl,
          'interactionId',
          'accompagnement-intensif'
        )
      })

      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailConseillerAccompagnementIntensifService.getAuthorizationUrl.returns(
          failure(new UtilisateurNonTraitable('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get(
            '/francetravail-conseiller/connect/interactionId?type=accompagnement-intensif'
          )
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=CONSEILLER&structureUtilisateur=FT_ACCOMPAGNEMENT_INTENSIF'
          )

        sinon.assert.calledOnceWithExactly(
          francetravailConseillerAccompagnementIntensifService.getAuthorizationUrl,
          'interactionId',
          'accompagnement-intensif'
        )
      })
    })

    describe('Accompagnement global', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        francetravailConseillerAccompagnementGlobalService.getAuthorizationUrl.returns(
          success('une-url')
        )

        // When - Then
        await request(app.getHttpServer())
          .get(
            '/francetravail-conseiller/connect/interactionId?type=accompagnement-global'
          )
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        sinon.assert.calledOnceWithExactly(
          francetravailConseillerAccompagnementGlobalService.getAuthorizationUrl,
          'interactionId',
          'accompagnement-global'
        )
      })

      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailConseillerAccompagnementGlobalService.getAuthorizationUrl.returns(
          failure(new UtilisateurNonTraitable('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get(
            '/francetravail-conseiller/connect/interactionId?type=accompagnement-global'
          )
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=CONSEILLER&structureUtilisateur=FT_ACCOMPAGNEMENT_GLOBAL'
          )

        sinon.assert.calledOnceWithExactly(
          francetravailConseillerAccompagnementGlobalService.getAuthorizationUrl,
          'interactionId',
          'accompagnement-global'
        )
      })
    })

    describe('Equip’emploi / Equip’recrut', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        francetravailConseillerEquipEmploiRecrutService.getAuthorizationUrl.returns(
          success('une-url')
        )

        // When - Then
        await request(app.getHttpServer())
          .get(
            '/francetravail-conseiller/connect/interactionId?type=equip-emploi-recrut'
          )
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        sinon.assert.calledOnceWithExactly(
          francetravailConseillerEquipEmploiRecrutService.getAuthorizationUrl,
          'interactionId',
          'equip-emploi-recrut'
        )
      })

      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailConseillerEquipEmploiRecrutService.getAuthorizationUrl.returns(
          failure(new UtilisateurNonTraitable('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get(
            '/francetravail-conseiller/connect/interactionId?type=equip-emploi-recrut'
          )
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=CONSEILLER&structureUtilisateur=FT_EQUIP_EMPLOI_RECRUT'
          )

        sinon.assert.calledOnceWithExactly(
          francetravailConseillerEquipEmploiRecrutService.getAuthorizationUrl,
          'interactionId',
          'equip-emploi-recrut'
        )
      })
    })
  })

  describe('GET /auth/realms/pass-emploi/broker/pe-conseiller/endpoint', () => {
    describe('CEJ', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        francetravailConseillerCEJService.callback.resolves(emptySuccess())

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
          .query({ state: 'cej' })
          .expect(HttpStatus.OK)

        sinon.assert.calledOnce(francetravailConseillerCEJService.callback)
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailConseillerCEJService.callback.resolves(
          failure(new AuthError('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
          .query({ state: 'cej' })
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=CONSEILLER&structureUtilisateur=POLE_EMPLOI'
          )

        sinon.assert.calledOnce(francetravailConseillerCEJService.callback)
      })
    })

    describe('BRSA', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        francetravailConseillerBRSAService.callback.resolves(emptySuccess())

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
          .query({ state: 'brsa' })
          .expect(HttpStatus.OK)

        sinon.assert.calledOnce(francetravailConseillerBRSAService.callback)
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailConseillerBRSAService.callback.resolves(
          failure(new NonTrouveError('User'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
          .query({ state: 'brsa' })
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NON_TROUVE&typeUtilisateur=CONSEILLER&structureUtilisateur=POLE_EMPLOI_BRSA'
          )

        sinon.assert.calledOnce(francetravailConseillerBRSAService.callback)
      })
    })

    describe('AIJ', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        francetravailConseillerAIJService.callback.resolves(emptySuccess())

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
          .query({ state: 'aij' })
          .expect(HttpStatus.OK)

        sinon.assert.calledOnce(francetravailConseillerAIJService.callback)
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailConseillerAIJService.callback.resolves(
          failure(new UtilisateurNonTraitable('UTILISATEUR_INEXISTANT'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
          .query({ state: 'aij' })
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=UTILISATEUR_INEXISTANT&typeUtilisateur=CONSEILLER&structureUtilisateur=POLE_EMPLOI_AIJ'
          )

        sinon.assert.calledOnce(francetravailConseillerAIJService.callback)
      })
    })

    describe('Accompagnement intensif', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        francetravailConseillerAccompagnementIntensifService.callback.resolves(
          emptySuccess()
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
          .query({ state: 'accompagnement-intensif' })
          .expect(HttpStatus.OK)

        sinon.assert.calledOnce(
          francetravailConseillerAccompagnementIntensifService.callback
        )
      })

      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailConseillerAccompagnementIntensifService.callback.resolves(
          failure(new UtilisateurNonTraitable('UTILISATEUR_INEXISTANT'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
          .query({ state: 'accompagnement-intensif' })
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=UTILISATEUR_INEXISTANT&typeUtilisateur=CONSEILLER&structureUtilisateur=FT_ACCOMPAGNEMENT_INTENSIF'
          )

        sinon.assert.calledOnce(
          francetravailConseillerAccompagnementIntensifService.callback
        )
      })
    })

    describe('Accompagnement global', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        francetravailConseillerAccompagnementGlobalService.callback.resolves(
          emptySuccess()
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
          .query({ state: 'accompagnement-global' })
          .expect(HttpStatus.OK)

        sinon.assert.calledOnce(
          francetravailConseillerAccompagnementGlobalService.callback
        )
      })

      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailConseillerAccompagnementGlobalService.callback.resolves(
          failure(new UtilisateurNonTraitable('UTILISATEUR_INEXISTANT'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
          .query({ state: 'accompagnement-global' })
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=UTILISATEUR_INEXISTANT&typeUtilisateur=CONSEILLER&structureUtilisateur=FT_ACCOMPAGNEMENT_GLOBAL'
          )

        sinon.assert.calledOnce(
          francetravailConseillerAccompagnementGlobalService.callback
        )
      })
    })

    describe('Equip’emploi / Equip’recrut', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        francetravailConseillerEquipEmploiRecrutService.callback.resolves(
          emptySuccess()
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
          .query({ state: 'equip-emploi-recrut' })
          .expect(HttpStatus.OK)

        sinon.assert.calledOnce(
          francetravailConseillerEquipEmploiRecrutService.callback
        )
      })

      it('redirige vers le web en cas de failure', async () => {
        // Given
        francetravailConseillerEquipEmploiRecrutService.callback.resolves(
          failure(
            new UtilisateurNonTraitable('UTILISATEUR_INEXISTANT', 'test@test')
          )
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
          .query({ state: 'equip-emploi-recrut' })
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=UTILISATEUR_INEXISTANT&typeUtilisateur=CONSEILLER&structureUtilisateur=FT_EQUIP_EMPLOI_RECRUT&email=test@test'
          )

        sinon.assert.calledOnce(
          francetravailConseillerEquipEmploiRecrutService.callback
        )
      })
    })
  })
})

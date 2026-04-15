import { HttpStatus, INestApplication } from '@nestjs/common'
import request from 'supertest'
import { MiloConseillerService } from '../../../src/idp/milo-conseiller/milo-conseiller.service.js'
import { AuthError } from '../../../src/utils/result/error.js'
import {
  emptySuccess,
  failure,
  success
} from '../../../src/utils/result/result.js'
import { StubbedClass, expect } from '../../test-utils.js'
import { getApplicationWithStubbedDependencies } from '../../test-utils/module-for-testing.js'

describe('MiloConseillerController', () => {
  let miloConseillerService: StubbedClass<MiloConseillerService>
  let app: INestApplication
  before(async () => {
    app = await getApplicationWithStubbedDependencies()

    miloConseillerService = app.get(MiloConseillerService)
  })

  describe('GET /milo-conseiller/connect/:interactionId', () => {
    describe('CEJ', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        miloConseillerService.getAuthorizationUrl.returns(success('une-url'))

        // When - Then
        await request(app.getHttpServer())
          .get('/milo-conseiller/connect/interactionId')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        expect(
          miloConseillerService.getAuthorizationUrl
        ).to.have.been.calledOnceWithExactly('interactionId')
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        miloConseillerService.getAuthorizationUrl.returns(
          failure(new AuthError('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/milo-conseiller/connect/interactionId')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=CONSEILLER&structureUtilisateur=MILO'
          )

        expect(
          miloConseillerService.getAuthorizationUrl
        ).to.have.been.calledOnceWithExactly('interactionId')
      })
    })
  })

  describe('GET /auth/realms/pass-emploi/broker/similo-conseiller/endpoint', () => {
    describe('CEJ', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        miloConseillerService.callback.resolves(emptySuccess())

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/similo-conseiller/endpoint')
          .expect(HttpStatus.OK)

        expect(miloConseillerService.callback).to.have.been.calledOnce()
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        miloConseillerService.callback.resolves(
          failure(new AuthError('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/similo-conseiller/endpoint')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=CONSEILLER&structureUtilisateur=MILO'
          )

        expect(miloConseillerService.callback).to.have.been.calledOnce()
      })
    })
  })
})

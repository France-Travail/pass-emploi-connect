import { HttpStatus } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ConseilDepartementalConseillerService } from 'src/idp/conseildepartemental-conseiller/conseildepartemental-conseiller.service.js'
import { AuthError } from 'src/utils/result/error.js'
import { emptySuccess, failure, success } from 'src/utils/result/result.js'
import { expect } from 'test/test-utils/index.js'
import type { StubbedClass } from '../../test-utils/index.js'
import { getApplicationWithStubbedDependencies } from '../../test-utils/module-for-testing.js'

describe('MiloConseillerController', () => {
  let conseilDepartementalConseillerService: StubbedClass<ConseilDepartementalConseillerService>
  let app: INestApplication
  before(async () => {
    app = await getApplicationWithStubbedDependencies()

    conseilDepartementalConseillerService = app.get(
      ConseilDepartementalConseillerService
    )
  })

  describe('GET /conseildepartemental-conseiller/connect/:interactionId', () => {
    describe('CEJ', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        conseilDepartementalConseillerService.getAuthorizationUrl.returns(
          success('une-url')
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/conseildepartemental-conseiller/connect/interactionId')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        expect(
          conseilDepartementalConseillerService.getAuthorizationUrl
        ).to.have.been.calledOnceWithExactly('interactionId')
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        conseilDepartementalConseillerService.getAuthorizationUrl.returns(
          failure(new AuthError('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/conseildepartemental-conseiller/connect/interactionId')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=CONSEILLER&structureUtilisateur=CONSEIL_DEPT'
          )

        expect(
          conseilDepartementalConseillerService.getAuthorizationUrl
        ).to.have.been.calledOnceWithExactly('interactionId')
      })
    })
  })

  describe('GET /auth/realms/pass-emploi/broker/conseildepartemental-conseiller/endpoint', () => {
    describe('CEJ', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        conseilDepartementalConseillerService.callback.resolves(emptySuccess())

        // When - Then
        await request(app.getHttpServer())
          .get(
            '/auth/realms/pass-emploi/broker/conseildepartemental-conseiller/endpoint'
          )
          .expect(HttpStatus.OK)

        expect(
          conseilDepartementalConseillerService.callback
        ).to.have.been.calledOnce()
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        conseilDepartementalConseillerService.callback.resolves(
          failure(new AuthError('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get(
            '/auth/realms/pass-emploi/broker/conseildepartemental-conseiller/endpoint'
          )
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=CONSEILLER&structureUtilisateur=CONSEIL_DEPT'
          )

        expect(
          conseilDepartementalConseillerService.callback
        ).to.have.been.calledOnce()
      })
    })
  })
})

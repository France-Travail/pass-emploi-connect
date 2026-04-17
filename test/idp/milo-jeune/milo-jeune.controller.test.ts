import { HttpStatus, INestApplication } from '@nestjs/common'
import request from 'supertest'
import { MiloJeuneService } from '../../../src/idp/milo-jeune/milo-jeune.service'
import { AuthError } from '../../../src/utils/result/error'
import {
  emptySuccess,
  failure,
  success
} from '../../../src/utils/result/result'
import { StubbedClass, expect } from '../../test-utils'
import {
  getApplicationWithStubbedDependencies,
  resetSandbox
} from '../../test-utils/module-for-testing'

describe('MiloJeuneController', () => {
  let miloJeuneService: StubbedClass<MiloJeuneService>
  let app: INestApplication
  beforeAll(async () => {
    app = await getApplicationWithStubbedDependencies()

    miloJeuneService = app.get(MiloJeuneService)
  })

  afterEach(() => {
    resetSandbox()
  })

  describe('GET /milo-jeune/connect/:interactionId', () => {
    describe('CEJ', () => {
      it('renvoie une url quand tout va bien', async () => {
        // Given
        miloJeuneService.getAuthorizationUrl.returns(success('une-url'))

        // When - Then
        await request(app.getHttpServer())
          .get('/milo-jeune/connect/interactionId')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect('Location', 'une-url')

        expect(
          miloJeuneService.getAuthorizationUrl
        ).to.have.been.calledOnceWithExactly('interactionId')
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        miloJeuneService.getAuthorizationUrl.returns(
          failure(new AuthError('NO_REASON'))
        )

        // When - Then
        await request(app.getHttpServer())
          .get('/milo-jeune/connect/interactionId')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=JEUNE&structureUtilisateur=MILO'
          )

        expect(
          miloJeuneService.getAuthorizationUrl
        ).to.have.been.calledOnceWithExactly('interactionId')
      })
    })
  })

  describe('GET /auth/realms/pass-emploi/broker/similo-jeune/endpoint', () => {
    describe('CEJ', () => {
      it('termine sans erreur quand tout va bien', async () => {
        // Given
        miloJeuneService.callback.resolves(emptySuccess())

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/similo-jeune/endpoint')
          .expect(HttpStatus.OK)

        expect(miloJeuneService.callback).to.have.been.calledOnce
      })
      it('redirige vers le web en cas de failure', async () => {
        // Given
        miloJeuneService.callback.resolves(failure(new AuthError('NO_REASON')))

        // When - Then
        await request(app.getHttpServer())
          .get('/auth/realms/pass-emploi/broker/similo-jeune/endpoint')
          .expect(HttpStatus.TEMPORARY_REDIRECT)
          .expect(
            'Location',
            'https://web.pass-emploi.incubateur.net/autherror?reason=NO_REASON&typeUtilisateur=JEUNE&structureUtilisateur=MILO'
          )

        expect(miloJeuneService.callback).to.have.been.calledOnce
      })
    })
  })
})

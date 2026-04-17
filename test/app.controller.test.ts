import { HttpStatus, INestApplication } from '@nestjs/common'
import request from 'supertest'
import {
  getApplicationWithStubbedDependencies,
  resetSandbox
} from './test-utils/module-for-testing'
import { StubbedClass, expect } from './test-utils'
import { DeleteAccountUsecase } from '../src/account/delete-account.usecase'
import { emptySuccess } from '../src/utils/result/result'

describe('AppController', () => {
  let deleteAccountUsecase: StubbedClass<DeleteAccountUsecase>
  let app: INestApplication
  beforeAll(async () => {
    app = await getApplicationWithStubbedDependencies()
    deleteAccountUsecase = app.get(DeleteAccountUsecase)
  })

  afterEach(() => {
    resetSandbox()
  })

  describe('GET /health', () => {
    it('renvoie ok', async () => {
      // When - Then
      await request(app.getHttpServer()).get('/health').expect(HttpStatus.OK)
    })
  })

  describe('DELETE /accounts', () => {
    it('renvoie ok', async () => {
      // Given
      deleteAccountUsecase.execute.resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .delete('/accounts/acc')
        .set({ 'X-API-KEY': 'pass-emploi-back' })
        .expect(HttpStatus.NO_CONTENT)

      expect(deleteAccountUsecase.execute).to.have.been.calledOnceWithExactly({
        idAuth: 'acc'
      })
    })
    it('renvoie unauthorized sans api key', async () => {
      // Given
      deleteAccountUsecase.execute.resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .delete('/accounts/acc')
        .set({ 'X-API-KEY': 'pass-emploi-bafck' })
        .expect(HttpStatus.UNAUTHORIZED)

      expect(deleteAccountUsecase.execute).not.to.have.been.called
    })
  })
})

import { HttpStatus, INestApplication } from '@nestjs/common'
import request from 'supertest'
import { getApplicationWithStubbedDependencies } from './test-utils/module-for-testing.js'
import { StubbedClass, expect } from './test-utils.js'
import { DeleteAccountUsecase } from '../src/account/delete-account.usecase.js'
import { emptySuccess } from '../src/utils/result/result.js'

describe('AppController', () => {
  let deleteAccountUsecase: StubbedClass<DeleteAccountUsecase>
  let app: INestApplication
  before(async () => {
    app = await getApplicationWithStubbedDependencies()
    deleteAccountUsecase = app.get(DeleteAccountUsecase)
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

      expect(deleteAccountUsecase.execute).not.to.have.been.called()
    })
  })
})

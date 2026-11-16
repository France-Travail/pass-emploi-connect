import sinon from 'sinon'
import { HttpStatus, INestApplication } from '@nestjs/common'
import request from 'supertest'
import {
  getApplicationWithStubbedDependencies,
  resetSandbox
} from './test-utils/module-for-testing'
import { StubbedClass } from './test-utils'
import { DeleteAccountUsecase } from '../src/account/delete-account.usecase'
import { RevoquerTokensIdpUsecase } from '../src/account/revoquer-tokens-idp.usecase'
import { AuthError } from '../src/utils/result/error'
import { emptySuccess, failure } from '../src/utils/result/result'

describe('AppController', () => {
  let deleteAccountUsecase: StubbedClass<DeleteAccountUsecase>
  let revoquerTokensIdpUsecase: StubbedClass<RevoquerTokensIdpUsecase>
  let app: INestApplication
  beforeAll(async () => {
    app = await getApplicationWithStubbedDependencies()
    deleteAccountUsecase = app.get(DeleteAccountUsecase)
    revoquerTokensIdpUsecase = app.get(RevoquerTokensIdpUsecase)
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

      sinon.assert.calledOnceWithExactly(deleteAccountUsecase.execute, {
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

      sinon.assert.notCalled(deleteAccountUsecase.execute)
    })
  })

  describe('POST /accounts/revoquer-tokens-idp', () => {
    it('révoque les tokens IDP du lot', async () => {
      // Given
      revoquerTokensIdpUsecase.execute.resolves(emptySuccess())

      // When - Then
      await request(app.getHttpServer())
        .post('/accounts/revoquer-tokens-idp')
        .set({ 'X-API-KEY': 'pass-emploi-back' })
        .send({ subs: ['sub-1', 'sub-2'] })
        .expect(HttpStatus.NO_CONTENT)

      sinon.assert.calledOnceWithExactly(revoquerTokensIdpUsecase.execute, {
        subs: ['sub-1', 'sub-2']
      })
    })

    it('renvoie 500 si la révocation échoue', async () => {
      // Given
      revoquerTokensIdpUsecase.execute.resolves(
        failure(new AuthError('DELETE_TOKENS'))
      )

      // When - Then
      await request(app.getHttpServer())
        .post('/accounts/revoquer-tokens-idp')
        .set({ 'X-API-KEY': 'pass-emploi-back' })
        .send({ subs: ['sub-1'] })
        .expect(HttpStatus.INTERNAL_SERVER_ERROR)
    })

    const lotsInvalides: Array<[string, unknown]> = [
      ['sans subs', {}],
      ['avec une liste vide', { subs: [] }],
      ['avec un sub vide', { subs: ['sub-1', ''] }],
      ["avec un sub qui n'est pas une chaîne", { subs: [42] }],
      [
        'au-delà de la taille maximale',
        { subs: Array.from({ length: 1001 }, (_, i) => `sub-${i}`) }
      ]
    ]
    it.each(lotsInvalides)('renvoie bad request %s', async (_, body) => {
      // When - Then
      await request(app.getHttpServer())
        .post('/accounts/revoquer-tokens-idp')
        .set({ 'X-API-KEY': 'pass-emploi-back' })
        .send(body as object)
        .expect(HttpStatus.BAD_REQUEST)

      sinon.assert.notCalled(revoquerTokensIdpUsecase.execute)
    })

    it('renvoie unauthorized sans api key', async () => {
      // When - Then
      await request(app.getHttpServer())
        .post('/accounts/revoquer-tokens-idp')
        .set({ 'X-API-KEY': 'pass-emploi-bafck' })
        .send({ subs: ['sub-1'] })
        .expect(HttpStatus.UNAUTHORIZED)

      sinon.assert.notCalled(revoquerTokensIdpUsecase.execute)
    })
  })
})

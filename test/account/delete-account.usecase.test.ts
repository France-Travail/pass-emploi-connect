import sinon from 'sinon'
import { DeleteAccountUsecase } from '../../src/account/delete-account.usecase'
import { RedisClient } from '../../src/redis/redis.client'
import { isFailure, isSuccess } from '../../src/utils/result/result'
import { StubbedClass, stubClass } from '../test-utils'

describe('DeleteAccountUsecase', () => {
  let deleteAccountUsecase: DeleteAccountUsecase
  let redisClient: StubbedClass<RedisClient>

  const idAuth = 'sub-cible'
  const accountCible = `JEUNE|FT|${idAuth}`
  const accountAutre = `JEUNE|FT|autre-sub`

  beforeEach(() => {
    redisClient = stubClass(RedisClient)
    redisClient.deletePattern.resolves()
    redisClient.scanKeys.resolves([])
    deleteAccountUsecase = new DeleteAccountUsecase(redisClient)
  })

  describe('execute', () => {
    it('supprime les tokens IDP via deletePattern', async () => {
      // When
      const result = await deleteAccountUsecase.execute({ idAuth })

      // Then
      sinon.assert.calledOnceWithExactly(redisClient.deletePattern, idAuth)
      expect(isSuccess(result)).toBe(true)
    })

    it('supprime les RefreshTokens OIDC du bénéficiaire ciblé uniquement', async () => {
      // Given
      redisClient.scanKeys
        .withArgs('*RefreshToken:*')
        .resolves(['RefreshToken:r1', 'RefreshToken:r2'])
      redisClient.hgetAllRaw
        .withArgs('RefreshToken:r1')
        .resolves({ payload: JSON.stringify({ accountId: accountCible }) })
      redisClient.hgetAllRaw
        .withArgs('RefreshToken:r2')
        .resolves({ payload: JSON.stringify({ accountId: accountAutre }) })

      // When
      const result = await deleteAccountUsecase.execute({ idAuth })

      // Then
      expect(isSuccess(result)).toBe(true)
      sinon.assert.calledOnceWithExactly(redisClient.delRaw, 'RefreshToken:r1')
      sinon.assert.neverCalledWith(redisClient.delRaw, 'RefreshToken:r2')
    })

    it('ne supprime aucun RefreshToken quand aucun ne correspond', async () => {
      // Given
      redisClient.scanKeys
        .withArgs('*RefreshToken:*')
        .resolves(['RefreshToken:r2'])
      redisClient.hgetAllRaw
        .withArgs('RefreshToken:r2')
        .resolves({ payload: JSON.stringify({ accountId: accountAutre }) })

      // When
      await deleteAccountUsecase.execute({ idAuth })

      // Then
      sinon.assert.notCalled(redisClient.delRaw)
    })

    it('retourne une failure quand Redis échoue', async () => {
      // Given
      redisClient.deletePattern.rejects(new Error('Redis down'))

      // When
      const result = await deleteAccountUsecase.execute({ idAuth })

      // Then
      expect(isFailure(result)).toBe(true)
    })
  })
})

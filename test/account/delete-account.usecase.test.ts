import sinon from 'sinon'
import { DeleteAccountUsecase } from '../../src/account/delete-account.usecase'
import { OidcService } from '../../src/oidc-provider/oidc.service'
import { RedisClient } from '../../src/redis/redis.client'
import { isFailure, isSuccess } from '../../src/utils/result/result'
import { StubbedClass, stubClass } from '../test-utils'

describe('DeleteAccountUsecase', () => {
  let redisClient: StubbedClass<RedisClient>
  let oidcService: StubbedClass<OidcService>
  let usecase: DeleteAccountUsecase

  beforeEach(() => {
    redisClient = stubClass(RedisClient)
    oidcService = stubClass(OidcService)
    usecase = new DeleteAccountUsecase(redisClient, oidcService)
  })

  it('révoque le grant invité puis supprime les tokens IDP', async () => {
    // Given
    oidcService.revoquerGrantInvite.resolves(true)
    redisClient.deletePattern.resolves()

    // When
    const result = await usecase.execute({ idAuth: 'sub-invite' })

    // Then
    expect(isSuccess(result)).toBe(true)
    sinon.assert.calledOnceWithExactly(
      oidcService.revoquerGrantInvite,
      'JEUNE|INVITE|sub-invite'
    )
    sinon.assert.calledOnceWithExactly(redisClient.deletePattern, 'sub-invite')
    // deletePattern(sub) supprimerait aussi l'index : il doit passer après
    sinon.assert.callOrder(
      oidcService.revoquerGrantInvite,
      redisClient.deletePattern
    )
  })

  it("supprime les tokens IDP d'un compte qui n'est pas un invité", async () => {
    // Given
    oidcService.revoquerGrantInvite.resolves(false)
    redisClient.deletePattern.resolves()

    // When
    const result = await usecase.execute({ idAuth: 'sub-ft' })

    // Then
    expect(isSuccess(result)).toBe(true)
    sinon.assert.calledOnceWithExactly(redisClient.deletePattern, 'sub-ft')
  })

  it('échoue sans toucher aux tokens IDP si la révocation du grant échoue', async () => {
    // Given
    oidcService.revoquerGrantInvite.rejects(new Error('redis ko'))

    // When
    const result = await usecase.execute({ idAuth: 'sub-invite' })

    // Then
    expect(isFailure(result)).toBe(true)
    sinon.assert.notCalled(redisClient.deletePattern)
  })
})

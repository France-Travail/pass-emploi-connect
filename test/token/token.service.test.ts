import { expect } from '../test-utils'
import { DateService } from '../../src/utils/date.service'
import { Account } from '../../src/domain/account'
import { RedisClient } from '../../src/redis/redis.client'
import {
  TokenData,
  TokenService,
  TokenType
} from '../../src/token/token.service'
import { StubbedClass, stubClass } from '../test-utils'
import { unAccount, uneDatetime } from '../test-utils/fixtures'

describe('TokenService', () => {
  let tokenService: TokenService
  let redisClient: StubbedClass<RedisClient>
  let dateService: StubbedClass<DateService>
  const maintenant = uneDatetime()

  beforeEach(() => {
    redisClient = stubClass(RedisClient)
    dateService = stubClass(DateService)
    tokenService = new TokenService(redisClient, dateService)
  })
  describe('setToken', () => {
    it('set un SavedTokenData', async () => {
      // Given
      const tokenData: TokenData = {
        token: 'tok',
        expiresIn: 300,
        scope: ''
      }
      dateService.now.returns(maintenant)

      // When
      await tokenService.setToken(unAccount(), TokenType.ACCESS, tokenData)

      // Then
      expect(redisClient.setWithExpiry).to.have.been.calledOnceWithExactly(
        TokenType.ACCESS,
        Account.fromAccountToAccountId(unAccount()),
        JSON.stringify({
          token: tokenData.token,
          scope: tokenData.scope,
          expiresAt: 1717243500
        }),
        300
      )
    })
  })
  describe('getToken', () => {
    it('get un SavedTokenData et le transforme en TokenData', async () => {
      // Given
      const saved = {
        token: 'tok',
        scope: '',
        expiresAt: 1717243499
      }
      redisClient.get.resolves(JSON.stringify(saved))
      dateService.now.returns(maintenant)

      // When
      const tokenData = await tokenService.getToken(
        unAccount(),
        TokenType.ACCESS
      )

      // Then
      expect(redisClient.get).to.have.been.calledOnceWithExactly(
        TokenType.ACCESS,
        Account.fromAccountToAccountId(unAccount())
      )
      expect(tokenData).to.deep.equal({
        token: 'tok',
        scope: '',
        expiresIn: 299
      })
    })
    it('undefined quand token mal formé', async () => {
      // Given
      const saved = {}
      redisClient.get.resolves(JSON.stringify(saved))
      dateService.now.returns(maintenant)

      // When
      const tokenData = await tokenService.getToken(
        unAccount(),
        TokenType.ACCESS
      )

      // Then
      expect(redisClient.get).to.have.been.calledOnceWithExactly(
        TokenType.ACCESS,
        Account.fromAccountToAccountId(unAccount())
      )
      expect(tokenData).to.be.undefined
    })
  })
  describe('setAccessTokenLock', () => {
    it('set AccessTokenLock and return true', async () => {
      // When
      await tokenService.setAccessTokenLock(unAccount(), 'unLockId')

      // Then
      expect(redisClient.acquireLock).to.have.been.calledOnceWithExactly(
        `access_token_lock:${Account.fromAccountToAccountId(unAccount())}`,
        'unLockId'
      )
    })
  })
  describe('releaseAccessTokenLock', () => {
    it('set AccessTokenLock and return true', async () => {
      // When
      await tokenService.releaseAccessTokenLock(unAccount(), 'unLockId')

      // Then
      expect(redisClient.releaseLock).to.have.been.calledOnceWithExactly(
        `access_token_lock:${Account.fromAccountToAccountId(unAccount())}`,
        'unLockId'
      )
    })
  })
})

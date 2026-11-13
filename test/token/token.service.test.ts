import { randomUUID } from 'crypto'
import { Redis } from 'ioredis'
import sinon from 'sinon'
import { DateService } from '../../src/utils/date.service'
import { Account } from '../../src/domain/account'
import { User } from '../../src/domain/user'
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
      sinon.assert.calledOnceWithExactly(
        redisClient.setWithExpiry,
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
      sinon.assert.calledOnceWithExactly(
        redisClient.get,
        TokenType.ACCESS,
        Account.fromAccountToAccountId(unAccount())
      )
      expect(tokenData).toEqual({
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
      sinon.assert.calledOnceWithExactly(
        redisClient.get,
        TokenType.ACCESS,
        Account.fromAccountToAccountId(unAccount())
      )
      expect(tokenData).toBeUndefined()
    })
  })
  describe('setAccessTokenLock', () => {
    it('set AccessTokenLock and return true', async () => {
      // When
      await tokenService.setAccessTokenLock(unAccount(), 'unLockId')

      // Then
      sinon.assert.calledOnceWithExactly(
        redisClient.acquireLock,
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
      sinon.assert.calledOnceWithExactly(
        redisClient.releaseLock,
        `access_token_lock:${Account.fromAccountToAccountId(unAccount())}`,
        'unLockId'
      )
    })
  })
  describe('supprimerTokensIdp', () => {
    it('supprime les tokens et le verrou de tous les comptes possibles du sub', async () => {
      // When
      await tokenService.supprimerTokensIdp(['sub-1'])

      // Then
      const cles: string[] = redisClient.deleteMany.firstCall.args[0]
      const accountId = 'JEUNE|POLE_EMPLOI_AIJ|sub-1'
      expect(cles).toEqual(
        expect.arrayContaining([
          `access_token:${accountId}`,
          `refresh_token:${accountId}`,
          `access_token_lock:${accountId}`
        ])
      )
      expect(cles).toHaveLength(
        Object.values(User.Type).length *
          Object.values(User.Structure).length *
          3
      )
    })

    it('supprime les clés de tous les subs en un seul appel', async () => {
      // When
      await tokenService.supprimerTokensIdp(['sub-1', 'sub-2'])

      // Then
      sinon.assert.calledOnce(redisClient.deleteMany)
      const cles: string[] = redisClient.deleteMany.firstCall.args[0]
      expect(cles).toContain('refresh_token:CONSEILLER|MILO|sub-2')
    })

    describe('sur un vrai redis', () => {
      let redis: Redis
      let tokenServiceRedis: TokenService
      const tokenData: TokenData = { token: 'tok', expiresIn: 3600 }

      beforeEach(() => {
        // eslint-disable-next-line no-process-env
        redis = new Redis(process.env.REDIS_URL!, {
          keyPrefix: `test-tokens-idp-${randomUUID()}:`
        })
        tokenServiceRedis = new TokenService(
          new RedisClient(redis),
          new DateService()
        )
      })

      afterEach(async () => {
        const prefixe = redis.options.keyPrefix!
        const cles = await redis.keys(`${prefixe}*`)
        if (cles.length > 0) {
          await redis.del(...cles.map(cle => cle.slice(prefixe.length)))
        }
        await redis.quit()
      })

      it('ne laisse que les clés des autres subs', async () => {
        // Given
        const cible = unAccount({
          sub: 'sub-cible',
          type: User.Type.JEUNE,
          structure: User.Structure.POLE_EMPLOI_AIJ
        })
        // KEYS *sub-cible* aurait aussi supprimé ce compte
        const autre = unAccount({ sub: 'sub-cible-bis' })
        for (const account of [cible, autre]) {
          await tokenServiceRedis.setToken(account, TokenType.ACCESS, tokenData)
          await tokenServiceRedis.setToken(
            account,
            TokenType.REFRESH,
            tokenData
          )
          await tokenServiceRedis.setAccessTokenLock(account, 'lock')
        }

        // When
        await tokenServiceRedis.supprimerTokensIdp(['sub-cible'])

        // Then
        const prefixe = redis.options.keyPrefix!
        const restantes = (await redis.keys(`${prefixe}*`))
          .map(cle => cle.slice(prefixe.length))
          .sort()
        const idAutre = Account.fromAccountToAccountId(autre)
        expect(restantes).toEqual([
          `access_token:${idAutre}`,
          `access_token_lock:${idAutre}`,
          `refresh_token:${idAutre}`
        ])
      })
    })
  })
})

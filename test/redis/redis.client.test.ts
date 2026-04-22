import sinon from 'sinon'
import { Redis } from 'ioredis'
import { RedisClient } from '../../src/redis/redis.client'
import { StubbedClass, stubClass } from '../test-utils'

describe('RedisClient', () => {
  let redisClient: RedisClient
  let redis: StubbedClass<Redis>

  beforeEach(() => {
    redis = stubClass(Redis)
    redisClient = new RedisClient(redis)
  })
  describe('get', () => {
    it('get', async () => {
      // Given
      redis.get.resolves('res')

      // When
      const res = await redisClient.get('pref', 'key')

      // Then
      expect(res).toBe('res')
      sinon.assert.calledOnceWithExactly(
        redis.get as sinon.SinonStub,
        'pref:key'
      )
    })
  })

  describe('set', () => {
    it('set', async () => {
      // Given
      redis.set.resolves()

      // When
      await redisClient.set('pref', 'key', 'value')

      // Then
      sinon.assert.calledOnceWithExactly(
        redis.set as sinon.SinonStub,
        'pref:key',
        'value'
      )
    })
  })

  describe('delete', () => {
    it('delete', async () => {
      // Given
      redis.del.resolves()

      // When
      await redisClient.delete('pref', 'key')

      // Then
      sinon.assert.calledOnceWithExactly(
        redis.del as sinon.SinonStub,
        'pref:key'
      )
    })
  })
  describe('deletePattern', () => {
    it('deletePattern', async () => {
      // Given
      redis.keys.resolves(['oidc:ok', 'abc'])
      redis.del.resolves()

      // When
      await redisClient.deletePattern('nimp')

      // Then
      sinon.assert.calledOnceWithExactly(
        redis.keys as sinon.SinonStub,
        '*nimp*'
      )
      sinon.assert.calledTwice(redis.del)
      sinon.assert.calledWithExactly(redis.del as sinon.SinonStub, 'ok')
      sinon.assert.calledWithExactly(redis.del as sinon.SinonStub, 'abc')
    })
  })
  describe('setWithExpiry', () => {
    it('setWithExpiry', async () => {
      // Given
      redis.set.resolves()

      // When
      await redisClient.setWithExpiry('pref', 'key', 'value', 10)

      // Then
      sinon.assert.calledOnceWithExactly(
        redis.set as sinon.SinonStub,
        'pref:key',
        'value',
        'EX',
        10
      )
    })
  })
  describe('acquireLock', () => {
    it('acquireLock return true when non existant', async () => {
      // Given
      redis.set.resolves('OK')

      // When
      const result = await redisClient.acquireLock('key', 'value')

      // Then
      sinon.assert.calledOnceWithExactly(
        redis.set as sinon.SinonStub,
        'key',
        'value',
        'EX',
        30,
        'NX'
      )
      expect(result).toBe(true)
    })
  })
  describe('releaseLock', () => {
    it('releaseLock releases when value is correct', async () => {
      // Given
      redis.get.withArgs('key').resolves('value')
      redis.del.resolves()

      // When
      await redisClient.releaseLock('key', 'value')

      // Then
      sinon.assert.calledOnceWithExactly(redis.del as sinon.SinonStub, 'key')
    })
    it("releaseLock doesn't release when value is incorrect", async () => {
      // Given
      redis.get.withArgs('key').resolves('another-value')
      redis.del.resolves()

      // When
      await redisClient.releaseLock('key', 'value')

      // Then
      sinon.assert.notCalled(redis.del)
    })
  })
})

import Redis from 'ioredis'
import sinon from 'sinon'
import { randomUUID } from 'crypto'
import { vi } from 'vitest'
import { RateLimitRedisStorage } from '../../src/rate-limit/rate-limit-redis.storage'
import { rootLogger } from '../../src/utils/monitoring/logger.module'
import { stubClass, StubbedClass } from '../test-utils'

describe('RateLimitRedisStorage', () => {
  describe('avec Redis réel', () => {
    let redis: Redis
    let storage: RateLimitRedisStorage
    const keyPrefix = `test-rate-limit-${randomUUID()}:`

    beforeEach(() => {
      // eslint-disable-next-line no-process-env
      redis = new Redis(process.env.REDIS_URL!, { keyPrefix })
      storage = new RateLimitRedisStorage(redis)
    })

    afterEach(async () => {
      const prefix = redis.options.keyPrefix!
      const keys = await redis.keys(`${prefix}*`)
      if (keys.length > 0) {
        await redis.del(...keys.map(key => key.slice(prefix.length)))
      }
      await redis.quit()
    })

    it('compte les requêtes dans la fenêtre', async () => {
      // Given
      const key = 'test-key'
      const ttl = 10000
      const limit = 2

      // When
      const result1 = await storage.increment(key, ttl, limit, 0, 'test')
      const result2 = await storage.increment(key, ttl, limit, 0, 'test')
      const result3 = await storage.increment(key, ttl, limit, 0, 'test')

      // Then
      expect(result1.totalHits).toBe(1)
      expect(result1.isBlocked).toBe(false)

      expect(result2.totalHits).toBe(2)
      expect(result2.isBlocked).toBe(false)

      expect(result3.totalHits).toBe(3)
      expect(result3.isBlocked).toBe(true)
    })

    it('ouvre une nouvelle fenêtre quand le compteur expire', async () => {
      // Given
      const key = 'test-key-expiry'
      const ttl = 100
      const limit = 5

      // When
      const result1 = await storage.increment(key, ttl, limit, 0, 'test')
      await new Promise(resolve => setTimeout(resolve, 150))
      const result2 = await storage.increment(key, ttl, limit, 0, 'test')

      // Then
      expect(result1.totalHits).toBe(1)
      expect(result2.totalHits).toBe(1)
    })

    it('renvoie le temps restant en secondes', async () => {
      // Given
      const key = 'test-key-ttl'
      const ttl = 5000
      const limit = 10

      // When
      const result = await storage.increment(key, ttl, limit, 0, 'test')

      // Then
      expect(result.timeToExpire).toBeGreaterThan(0)
      expect(result.timeToExpire).toBeLessThanOrEqual(5)
      expect(result.timeToBlockExpire).toBe(result.timeToExpire)
    })

    it('repose le TTL sur une clé qui en est privée', async () => {
      // Given
      const key = 'test-key-sans-ttl'
      await redis.set(key, '5')

      // When
      const result = await storage.increment(key, 5000, 10, 0, 'test')

      // Then
      expect(result.totalHits).toBe(6)
      expect(result.timeToExpire).toBeGreaterThan(0)
      expect(await redis.pttl(key)).toBeGreaterThan(0)
    })
  })

  describe('fail-open sur timeout Redis', () => {
    let redis: StubbedClass<Redis>
    let storage: RateLimitRedisStorage

    beforeEach(() => {
      redis = stubClass(Redis)
    })

    afterEach(() => {
      sinon.restore()
    })

    it('laisse passer si Redis dépasse 200 ms', async () => {
      // Given
      const neverResolvingMulti = {
        incr: sinon.stub().returnsThis(),
        pexpire: sinon.stub().returnsThis(),
        pttl: sinon.stub().returnsThis(),
        exec: sinon.stub().returns(new Promise(() => {}))
      }
      redis.multi.returns(neverResolvingMulti as never)

      storage = new RateLimitRedisStorage(redis)
      const errorSpy = sinon.spy(rootLogger, 'error')

      // When
      const start = Date.now()
      const result = await storage.increment('key', 1000, 10, 0, 'test')
      const elapsed = Date.now() - start

      // Then
      expect(result.isBlocked).toBe(false)
      expect(result.totalHits).toBe(0)
      expect(result.timeToExpire).toBe(0)
      expect(result.timeToBlockExpire).toBe(0)
      expect(elapsed).toBeLessThan(250)
      sinon.assert.calledOnce(errorSpy)
    })

    it('laisse passer si une commande du MULTI échoue', async () => {
      // Given
      const failingMulti = {
        incr: sinon.stub().returnsThis(),
        pexpire: sinon.stub().returnsThis(),
        pttl: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves([
          [new Error('INCR failed'), null],
          [null, 1],
          [null, 100]
        ])
      }
      redis.multi.returns(failingMulti as never)

      storage = new RateLimitRedisStorage(redis)
      const errorSpy = sinon.spy(rootLogger, 'error')

      // When
      const result = await storage.increment('key', 1000, 10, 0, 'test')

      // Then
      expect(result.isBlocked).toBe(false)
      expect(result.totalHits).toBe(0)
      expect(result.timeToExpire).toBe(0)
      expect(result.timeToBlockExpire).toBe(0)
      sinon.assert.calledOnce(errorSpy)
      const firstCall = errorSpy.firstCall.args[0] as {
        error: { type: string; message: string }
      }
      expect(firstCall.error.message).toMatch(/INCR failed/)
    })

    it('repose le TTL si PTTL indique une clé sans expiration', async () => {
      // Given
      redis.multi.returns({
        incr: sinon.stub().returnsThis(),
        pexpire: sinon.stub().returnsThis(),
        pttl: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves([
          [null, 6],
          [null, 0],
          [null, -1]
        ])
      } as never)
      redis.pexpire.resolves(1)
      storage = new RateLimitRedisStorage(redis)

      // When
      const result = await storage.increment('key', 5000, 10, 0, 'test')

      // Then
      sinon.assert.calledOnce(redis.pexpire)
      expect(redis.pexpire.firstCall.args).toEqual(['key', 5000])
      expect(result.totalHits).toBe(6)
      expect(result.timeToExpire).toBe(5)
    })

    it('laisse passer si PEXPIRE échoue', async () => {
      // Given
      const failingMulti = {
        incr: sinon.stub().returnsThis(),
        pexpire: sinon.stub().returnsThis(),
        pttl: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves([
          [null, 1],
          [new Error('PEXPIRE failed'), null],
          [null, 100]
        ])
      }
      redis.multi.returns(failingMulti as never)
      storage = new RateLimitRedisStorage(redis)
      const errorSpy = sinon.spy(rootLogger, 'error')

      // When
      const result = await storage.increment('key', 1000, 10, 0, 'test')

      // Then
      expect(result.totalHits).toBe(0)
      expect(result.isBlocked).toBe(false)
      sinon.assert.calledOnce(errorSpy)
    })
  })

  describe('timer de timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
      sinon.restore()
    })

    it('est nettoyé quand Redis répond à temps', async () => {
      // Given
      const redis = stubClass(Redis)
      redis.multi.returns({
        incr: sinon.stub().returnsThis(),
        pexpire: sinon.stub().returnsThis(),
        pttl: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves([
          [null, 1],
          [null, 1],
          [null, 1000]
        ])
      } as never)
      const storage = new RateLimitRedisStorage(redis)

      // When
      await storage.increment('key', 1000, 10, 0, 'test')

      // Then
      expect(vi.getTimerCount()).toBe(0)
    })
  })

  describe('logging des pannes', () => {
    let redis: StubbedClass<Redis>
    let storage: RateLimitRedisStorage

    beforeEach(() => {
      vi.useFakeTimers()
      redis = stubClass(Redis)
    })

    afterEach(() => {
      vi.useRealTimers()
      sinon.restore()
    })

    it("ne logue la panne qu'une fois par minute", async () => {
      // Given
      const failingMulti = {
        incr: sinon.stub().returnsThis(),
        pexpire: sinon.stub().returnsThis(),
        pttl: sinon.stub().returnsThis(),
        exec: sinon.stub().rejects(new Error('Redis down'))
      }
      redis.multi.returns(failingMulti as never)

      storage = new RateLimitRedisStorage(redis)
      const errorSpy = sinon.spy(rootLogger, 'error')

      // When
      await storage.increment('key1', 1000, 10, 0, 'test')
      await storage.increment('key2', 1000, 10, 0, 'test')
      await storage.increment('key3', 1000, 10, 0, 'test')

      // Then
      sinon.assert.calledOnce(errorSpy)

      // When - 30 secondes plus tard
      vi.advanceTimersByTime(30000)
      await storage.increment('key4', 1000, 10, 0, 'test')

      // Then
      sinon.assert.calledOnce(errorSpy)

      // When - 31 secondes plus tard (total 61s)
      vi.advanceTimersByTime(31000)
      await storage.increment('key5', 1000, 10, 0, 'test')

      // Then
      sinon.assert.calledTwice(errorSpy)

      const firstCall = errorSpy.firstCall.args[0] as {
        event: { action: string; outcome: string }
        context: string
        error: { type: string; message: string }
      }
      expect(firstCall.event.action).toBe('rate_limit_storage_failed')
      expect(firstCall.event.outcome).toBe('failure')
      expect(firstCall.context).toBe('RateLimitRedisStorage')
      expect(firstCall.error.type).toBe('Error')
      expect(firstCall.error.message).toMatch(/Redis/)
    })
  })
})

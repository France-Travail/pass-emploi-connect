import sinon from 'sinon'
import { Redis } from 'ioredis'
import { RedisAdapter } from '../../src/redis/redis.adapter'
import { StubbedClass, stubClass } from '../test-utils'

describe('RedisAdapter', () => {
  let redis: StubbedClass<Redis>
  let multiStub: {
    hmset: sinon.SinonStub
    set: sinon.SinonStub
    expire: sinon.SinonStub
    rpush: sinon.SinonStub
    del: sinon.SinonStub
    exec: sinon.SinonStub
  }

  beforeEach(() => {
    redis = stubClass(Redis)
    multiStub = {
      hmset: sinon.stub().returnsThis(),
      set: sinon.stub().returnsThis(),
      expire: sinon.stub().returnsThis(),
      rpush: sinon.stub().returnsThis(),
      del: sinon.stub().returnsThis(),
      exec: sinon.stub().resolves([])
    }
    redis.multi.returns(multiStub as never)
  })

  describe('key', () => {
    it('génère la clé {name}:{id}', () => {
      const adapter = new RedisAdapter('Session', redis)

      expect(adapter.key('abc')).toBe('Session:abc')
    })
  })

  describe('upsert', () => {
    describe('type non-consumable (Session)', () => {
      let adapter: RedisAdapter

      beforeEach(() => {
        adapter = new RedisAdapter('Session', redis)
      })

      it('stocke le payload sérialisé avec set', async () => {
        // Given
        const payload = { sub: 'user1' }

        // When
        await adapter.upsert('id1', payload, 3600)

        // Then
        sinon.assert.calledWithExactly(
          multiStub.set,
          'Session:id1',
          JSON.stringify(payload)
        )
        sinon.assert.notCalled(multiStub.hmset)
      })

      it('applique expire sur la clé quand expiresIn > 0', async () => {
        // When
        await adapter.upsert('id1', {}, 3600)

        // Then
        sinon.assert.calledWithExactly(multiStub.expire, 'Session:id1', 3600)
      })

      it("n'applique pas expire quand expiresIn vaut 0", async () => {
        // When
        await adapter.upsert('id1', {}, 0)

        // Then
        sinon.assert.notCalled(multiStub.expire)
      })

      it('exécute la transaction atomiquement', async () => {
        // When
        await adapter.upsert('id1', {}, 3600)

        // Then
        sinon.assert.calledOnce(multiStub.exec)
      })

      it("ne rethrow pas si Redis échoue", async () => {
        // Given
        multiStub.exec.rejects(new Error('Redis down'))

        // When / Then
        await expect(adapter.upsert('id1', {}, 3600)).resolves.not.toThrow()
      })
    })

    describe('type consumable (RefreshToken)', () => {
      it('stocke avec hmset pour permettre le marquage consumed ultérieur', async () => {
        // Given
        const adapter = new RedisAdapter('RefreshToken', redis)
        const payload = { sub: 'user1' }

        // When
        await adapter.upsert('id1', payload, 3600)

        // Then
        sinon.assert.calledWithExactly(multiStub.hmset, 'RefreshToken:id1', {
          payload: JSON.stringify(payload)
        })
        sinon.assert.notCalled(multiStub.set)
      })
    })

    describe('type grantable avec grantId (AccessToken)', () => {
      let adapter: RedisAdapter

      beforeEach(() => {
        adapter = new RedisAdapter('AccessToken', redis)
      })

      it('ajoute la clé dans la liste du grant', async () => {
        // Given
        redis.ttl.resolves(100)

        // When
        await adapter.upsert('id1', { grantId: 'grant1' }, 3600)

        // Then
        sinon.assert.calledWithExactly(
          multiStub.rpush,
          'grant:grant1',
          'AccessToken:id1'
        )
      })

      it('rafraîchit le TTL du grant quand expiresIn > ttl du grant', async () => {
        // Given
        redis.ttl.resolves(100)

        // When
        await adapter.upsert('id1', { grantId: 'grant1' }, 3600)

        // Then
        sinon.assert.calledWithExactly(multiStub.expire, 'grant:grant1', 3600)
      })

      it("ne rafraîchit pas le TTL du grant quand expiresIn <= ttl du grant", async () => {
        // Given
        redis.ttl.resolves(7200)

        // When
        await adapter.upsert('id1', { grantId: 'grant1' }, 3600)

        // Then
        sinon.assert.neverCalledWith(
          multiStub.expire,
          'grant:grant1',
          sinon.match.any
        )
      })

      it("n'ajoute pas au grant si le payload n'a pas de grantId", async () => {
        // When
        await adapter.upsert('id1', {}, 3600)

        // Then
        sinon.assert.notCalled(multiStub.rpush)
      })
    })

    describe('payload avec userCode', () => {
      it('crée un index userCode → id avec TTL', async () => {
        // Given
        const adapter = new RedisAdapter('Session', redis)

        // When
        await adapter.upsert('id1', { userCode: 'uc123' }, 3600)

        // Then
        sinon.assert.calledWithExactly(multiStub.set, 'userCode:uc123', 'id1')
        sinon.assert.calledWithExactly(multiStub.expire, 'userCode:uc123', 3600)
      })
    })

    describe('payload avec uid', () => {
      it('crée un index uid → id avec TTL', async () => {
        // Given
        const adapter = new RedisAdapter('Session', redis)

        // When
        await adapter.upsert('id1', { uid: 'uid456' }, 3600)

        // Then
        sinon.assert.calledWithExactly(multiStub.set, 'uid:uid456', 'id1')
        sinon.assert.calledWithExactly(multiStub.expire, 'uid:uid456', 3600)
      })
    })
  })

  describe('find', () => {
    describe('type non-consumable (Session)', () => {
      let adapter: RedisAdapter

      beforeEach(() => {
        adapter = new RedisAdapter('Session', redis)
      })

      it('retourne le payload désérialisé', async () => {
        // Given
        const payload = { sub: 'user1', jti: 'abc' }
        redis.get.resolves(JSON.stringify(payload))

        // When
        const result = await adapter.find('id1')

        // Then
        sinon.assert.calledWithExactly(redis.get as sinon.SinonStub, 'Session:id1')
        expect(result).toEqual(payload)
      })

      it('retourne undefined si la clé est absente', async () => {
        // Given
        redis.get.resolves(null)

        // When
        const result = await adapter.find('id1')

        // Then
        expect(result).toBeUndefined()
      })

      it("rethrow l'erreur Redis", async () => {
        // Given
        redis.get.rejects(new Error('Redis down'))

        // When / Then
        await expect(adapter.find('id1')).rejects.toThrow('Redis down')
      })
    })

    describe('type consumable (AuthorizationCode)', () => {
      let adapter: RedisAdapter

      beforeEach(() => {
        adapter = new RedisAdapter('AuthorizationCode', redis)
      })

      it('fusionne les champs du hash avec le payload JSON', async () => {
        // Given
        const payload = { sub: 'user1' }
        redis.hgetall.resolves({
          payload: JSON.stringify(payload),
          consumed: '1234567890'
        })

        // When
        const result = await adapter.find('id1')

        // Then
        sinon.assert.calledWithExactly(
          redis.hgetall as sinon.SinonStub,
          'AuthorizationCode:id1'
        )
        expect(result).toEqual({ sub: 'user1', consumed: '1234567890' })
      })

      it('retourne undefined si le hash est vide', async () => {
        // Given
        redis.hgetall.resolves({})

        // When
        const result = await adapter.find('id1')

        // Then
        expect(result).toBeUndefined()
      })
    })
  })

  describe('findByUid', () => {
    it('retrouve le payload via index uid', async () => {
      // Given
      const adapter = new RedisAdapter('Session', redis)
      const payload = { sub: 'user1' }
      redis.get.withArgs('uid:uid456').resolves('id1')
      redis.get.withArgs('Session:id1').resolves(JSON.stringify(payload))

      // When
      const result = await adapter.findByUid('uid456')

      // Then
      expect(result).toEqual(payload)
    })

    it("retourne undefined si l'uid n'existe pas dans l'index", async () => {
      // Given
      const adapter = new RedisAdapter('Session', redis)
      redis.get.resolves(null)

      // When
      const result = await adapter.findByUid('uid-inconnu')

      // Then
      expect(result).toBeUndefined()
    })
  })

  describe('findByUserCode', () => {
    it('retrouve le payload via index userCode', async () => {
      // Given
      const adapter = new RedisAdapter('Session', redis)
      const payload = { sub: 'user1' }
      redis.get.withArgs('userCode:uc123').resolves('id1')
      redis.get.withArgs('Session:id1').resolves(JSON.stringify(payload))

      // When
      const result = await adapter.findByUserCode('uc123')

      // Then
      expect(result).toEqual(payload)
    })

    it("retourne undefined si le userCode n'existe pas dans l'index", async () => {
      // Given
      const adapter = new RedisAdapter('Session', redis)
      redis.get.resolves(null)

      // When
      const result = await adapter.findByUserCode('uc-inconnu')

      // Then
      expect(result).toBeUndefined()
    })
  })

  describe('destroy', () => {
    it('supprime la clé du token', async () => {
      // Given
      const adapter = new RedisAdapter('Session', redis)
      redis.del.resolves(1)

      // When
      await adapter.destroy('id1')

      // Then
      sinon.assert.calledOnceWithExactly(
        redis.del as sinon.SinonStub,
        'Session:id1'
      )
    })
  })

  describe('revokeByGrantId', () => {
    it('supprime tous les tokens référencés dans le grant puis la liste', async () => {
      // Given
      const adapter = new RedisAdapter('AccessToken', redis)
      redis.lrange.resolves(['AccessToken:id1', 'RefreshToken:id2'])

      // When
      await adapter.revokeByGrantId('grant1')

      // Then
      sinon.assert.calledWithExactly(
        redis.lrange as sinon.SinonStub,
        'grant:grant1',
        0,
        -1
      )
      sinon.assert.calledWithExactly(multiStub.del, 'AccessToken:id1')
      sinon.assert.calledWithExactly(multiStub.del, 'RefreshToken:id2')
      sinon.assert.calledWithExactly(multiStub.del, 'grant:grant1')
      sinon.assert.calledOnce(multiStub.exec)
    })
  })

  describe('consume', () => {
    it('marque le token comme consommé avec un timestamp Unix', async () => {
      // Given
      const adapter = new RedisAdapter('RefreshToken', redis)
      redis.hset.resolves(1)
      const before = Math.floor(Date.now() / 1000)

      // When
      await adapter.consume('id1')

      // Then
      const after = Math.floor(Date.now() / 1000)
      sinon.assert.calledOnce(redis.hset as sinon.SinonStub)
      const [key, field, value] = (redis.hset as sinon.SinonStub).firstCall.args
      expect(key).toBe('RefreshToken:id1')
      expect(field).toBe('consumed')
      expect(Number(value)).toBeGreaterThanOrEqual(before)
      expect(Number(value)).toBeLessThanOrEqual(after)
    })
  })
})
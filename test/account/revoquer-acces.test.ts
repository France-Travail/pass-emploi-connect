import Redis from 'ioredis'
import { randomUUID } from 'crypto'
import { revoquerAcces } from 'src/account/revoquer-acces'
import { RedisAdapter } from 'src/redis/redis.adapter'

const SUB_COMPROMIS = 'sub-compromis'
const SUB_SAIN = 'sub-sain'
const ACCOUNT_COMPROMIS = `JEUNE|MILO|${SUB_COMPROMIS}`
const ACCOUNT_SAIN = `JEUNE|MILO|${SUB_SAIN}`
const TTL = 3600

describe('revoquerAcces', () => {
  let redis: Redis

  beforeEach(async () => {
    // eslint-disable-next-line no-process-env
    redis = new Redis(process.env.REDIS_URL!, {
      keyPrefix: `test-revocation-${randomUUID()}:`
    })
    await creerCompte(redis, ACCOUNT_COMPROMIS, 'compromis')
    await creerCompte(redis, ACCOUNT_SAIN, 'sain')
  })

  afterEach(async () => {
    const prefixe = redis.options.keyPrefix!
    const cles = await redis.keys(`${prefixe}*`)
    if (cles.length > 0) {
      await redis.del(...cles.map(cle => cle.slice(prefixe.length)))
    }
    await redis.quit()
  })

  it('en dry-run, liste les objets du sub sans rien supprimer', async () => {
    // When
    const bilan = await revoquerAcces(redis, new Set([SUB_COMPROMIS]), {
      execute: false
    })

    // Then
    expect(bilan).toEqual({
      accountIds: [ACCOUNT_COMPROMIS],
      subsSansTrace: [],
      grants: 1,
      sessions: 1,
      tokensIdp: 3,
      clesSupprimees: 0,
      clesIllisibles: []
    })
    expect(await redis.exists('Grant:grant-compromis')).toBe(1)
    expect(await redis.exists('RefreshToken:rt-compromis')).toBe(1)
  })

  it('en execute, supprime tous les objets du sub', async () => {
    // When
    const bilan = await revoquerAcces(redis, new Set([SUB_COMPROMIS]), {
      execute: true
    })

    // Then
    expect(await toutesLesCles(redis)).toEqual(
      clesDuCompte(ACCOUNT_SAIN, 'sain')
    )
    expect(bilan.clesSupprimees).toBe(9)
  })

  it('remonte les subs sans aucune trace', async () => {
    // When
    const bilan = await revoquerAcces(
      redis,
      new Set([SUB_COMPROMIS, 'sub-inconnu']),
      { execute: true }
    )

    // Then
    expect(bilan.subsSansTrace).toEqual(['sub-inconnu'])
  })

  it('met de côté les objets illisibles sans interrompre la révocation', async () => {
    // Given
    await redis.set('Grant:corrompu', 'pas du json')
    await redis.hset('Session:mauvais-type', { payload: '{}' })

    // When
    const bilan = await revoquerAcces(redis, new Set([SUB_COMPROMIS]), {
      execute: true
    })

    // Then
    expect(bilan.clesIllisibles).toEqual([
      'Grant:corrompu',
      'Session:mauvais-type'
    ])
    expect(bilan.grants).toBe(1)
    expect(await redis.exists('Grant:grant-compromis')).toBe(0)
  })
})

async function creerCompte(
  redis: Redis,
  accountId: string,
  suffixe: string
): Promise<void> {
  const grantId = `grant-${suffixe}`
  const uid = `uid-${suffixe}`
  await new RedisAdapter('Grant', redis).upsert(grantId, { accountId }, TTL)
  await new RedisAdapter('Session', redis).upsert(
    `session-${suffixe}`,
    { accountId, uid },
    TTL
  )
  await new RedisAdapter('RefreshToken', redis).upsert(
    `rt-${suffixe}`,
    { accountId, grantId },
    TTL
  )
  await new RedisAdapter('AuthorizationCode', redis).upsert(
    `code-${suffixe}`,
    { accountId, grantId },
    60
  )
  await redis.set(`access_token:${accountId}`, 'at-idp')
  await redis.set(`refresh_token:${accountId}`, 'rt-idp')
  await redis.set(`access_token_lock:${accountId}`, '1')
}

function clesDuCompte(accountId: string, suffixe: string): string[] {
  return [
    `AuthorizationCode:code-${suffixe}`,
    `Grant:grant-${suffixe}`,
    `RefreshToken:rt-${suffixe}`,
    `Session:session-${suffixe}`,
    `access_token:${accountId}`,
    `access_token_lock:${accountId}`,
    `grant:grant-${suffixe}`,
    `refresh_token:${accountId}`,
    `uid:uid-${suffixe}`
  ].sort()
}

async function toutesLesCles(redis: Redis): Promise<string[]> {
  const prefixe = redis.options.keyPrefix!
  const cles = await redis.keys(`${prefixe}*`)
  return cles.map(cle => cle.slice(prefixe.length)).sort()
}

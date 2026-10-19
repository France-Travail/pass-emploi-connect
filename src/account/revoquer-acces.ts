import Redis from 'ioredis'
import { Account } from '../domain/account'

export interface BilanRevocation {
  accountIds: string[]
  subsSansTrace: string[]
  grants: number
  sessions: number
  tokensIdp: number
  clesSupprimees: number
}

interface ObjetOidc {
  cle: string
  accountId: string
  uid?: string
}

const TAILLE_PAGE_SCAN = 1000
const PREFIXES_TOKENS_IDP = [
  'access_token:',
  'refresh_token:',
  'access_token_lock:'
]

// Les objets oidc-provider d'un compte connecté ne sont pas indexés par sub
// (seuls les invités ont un index) : on parcourt toutes les clés une fois et
// on lit les Grant et Session pour y trouver l'accountId.
export async function revoquerAcces(
  redis: Redis,
  subs: ReadonlySet<string>,
  options: { execute: boolean }
): Promise<BilanRevocation> {
  const { grants, sessions, tokensIdp } = await trouverObjets(redis, subs)

  const clesTokensDesGrants = await lireClesTokensDesGrants(redis, grants)
  const clesASupprimer = [
    ...clesTokensDesGrants,
    ...grants.map(grant => listeGrantKey(grant.cle)),
    ...sessions.flatMap(session =>
      session.uid ? [session.cle, `uid:${session.uid}`] : [session.cle]
    ),
    ...tokensIdp.map(token => token.cle)
  ]

  let clesSupprimees = 0
  if (options.execute) {
    // Grant d'abord : sans lui oidc-provider refuse tout refresh, même si un
    // RefreshToken survit à une interruption du script.
    clesSupprimees += await supprimer(
      redis,
      grants.map(grant => grant.cle)
    )
    clesSupprimees += await supprimer(redis, clesASupprimer)
  }

  const accountIds = new Set(
    [...grants, ...sessions, ...tokensIdp].map(objet => objet.accountId)
  )
  const subsTrouves = new Set(
    [...accountIds].map(accountId => Account.getSubFromAccountId(accountId))
  )
  return {
    accountIds: [...accountIds].sort(),
    subsSansTrace: [...subs].filter(sub => !subsTrouves.has(sub)).sort(),
    grants: grants.length,
    sessions: sessions.length,
    tokensIdp: tokensIdp.length,
    clesSupprimees
  }
}

async function trouverObjets(
  redis: Redis,
  subs: ReadonlySet<string>
): Promise<{
  grants: ObjetOidc[]
  sessions: ObjetOidc[]
  tokensIdp: ObjetOidc[]
}> {
  const grants: ObjetOidc[] = []
  const sessions: ObjetOidc[] = []
  const tokensIdp: ObjetOidc[] = []
  const prefixe = redis.options.keyPrefix ?? ''

  let cursor = '0'
  do {
    const [nextCursor, clesPrefixees] = await redis.scan(
      cursor,
      'MATCH',
      `${prefixe}*`,
      'COUNT',
      TAILLE_PAGE_SCAN
    )
    cursor = nextCursor
    const cles = clesPrefixees.map(cle => cle.slice(prefixe.length))

    for (const cle of cles) {
      const prefixeIdp = PREFIXES_TOKENS_IDP.find(p => cle.startsWith(p))
      if (prefixeIdp) {
        const accountId = cle.slice(prefixeIdp.length)
        if (subs.has(Account.getSubFromAccountId(accountId))) {
          tokensIdp.push({ cle, accountId })
        }
      }
    }

    const clesObjets = cles.filter(
      cle => cle.startsWith('Grant:') || cle.startsWith('Session:')
    )
    for (const objet of await lireObjets(redis, clesObjets)) {
      if (!subs.has(Account.getSubFromAccountId(objet.accountId))) continue
      if (objet.cle.startsWith('Grant:')) grants.push(objet)
      else sessions.push(objet)
    }
  } while (cursor !== '0')

  return { grants, sessions, tokensIdp }
}

async function lireObjets(redis: Redis, cles: string[]): Promise<ObjetOidc[]> {
  if (cles.length === 0) return []
  const pipeline = redis.pipeline()
  cles.forEach(cle => pipeline.get(cle))
  const resultats = (await pipeline.exec()) ?? []

  return resultats.flatMap(([erreur, valeur], index) => {
    if (erreur) throw erreur
    // clé expirée entre le SCAN et le GET
    if (typeof valeur !== 'string') return []
    const payload = JSON.parse(valeur)
    if (typeof payload.accountId !== 'string') return []
    return [
      { cle: cles[index], accountId: payload.accountId, uid: payload.uid }
    ]
  })
}

async function lireClesTokensDesGrants(
  redis: Redis,
  grants: ObjetOidc[]
): Promise<string[]> {
  if (grants.length === 0) return []
  const pipeline = redis.pipeline()
  grants.forEach(grant => pipeline.lrange(listeGrantKey(grant.cle), 0, -1))
  const resultats = (await pipeline.exec()) ?? []

  return resultats.flatMap(([erreur, cles]) => {
    if (erreur) throw erreur
    return cles as string[]
  })
}

// `Grant:<id>` est l'objet, `grant:<id>` la liste des clés de ses tokens
function listeGrantKey(cleGrant: string): string {
  return `grant:${cleGrant.slice('Grant:'.length)}`
}

async function supprimer(redis: Redis, cles: string[]): Promise<number> {
  if (cles.length === 0) return 0
  const pipeline = redis.pipeline()
  cles.forEach(cle => pipeline.del(cle))
  const resultats = (await pipeline.exec()) ?? []

  return resultats.reduce((total, [erreur, supprimees]) => {
    if (erreur) throw erreur
    return total + (supprimees as number)
  }, 0)
}

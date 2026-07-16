import Redis from 'ioredis'
import ProviderClass, { errors, interactionPolicy } from 'oidc-provider'
import { PassEmploiAPIClient } from '../../src/api/pass-emploi-api.client'
import { Account } from '../../src/domain/account'
import { User } from '../../src/domain/user'
import { OidcService } from '../../src/oidc-provider/oidc.service'
import {
  OidcProviderModule,
  ProviderClass as ProviderClassType
} from '../../src/oidc-provider/provider'
import { TokenExchangeGrant } from '../../src/oidc-provider/token-exchange.grant'
import { sinon, StubbedClass, stubClass } from '../test-utils'
import { testConfig } from '../test-utils/module-for-testing'

/**
 * Vérifie sur le VRAI oidc-provider + le VRAI RedisAdapter (seul le client Redis
 * est simulé) que le refresh token d'un invité n'expire jamais : aucun `exp` dans
 * le payload, et surtout aucune commande EXPIRE envoyée à Redis.
 *
 * Le piège que ce test verrouille : renvoyer 0 au lieu de undefined donnerait
 * `exp = now + 0 = now`, soit un token expiré à la seconde où il est émis.
 */
describe('TTL du refresh token invité', () => {
  type CommandeRedis = { cmd: string; args: unknown[] }

  const accountIdInvite = Account.fromAccountToAccountId({
    sub: 'un-sub-invite',
    type: User.Type.JEUNE,
    structure: User.Structure.INVITE
  })
  const accountIdJeuneMilo = Account.fromAccountToAccountId({
    sub: 'un-sub-milo',
    type: User.Type.JEUNE,
    structure: User.Structure.MILO
  })

  const commandes: CommandeRedis[] = []
  const store = new Map<string, unknown>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let provider: any

  // Faux client Redis : enregistre les commandes ET stocke réellement les
  // données, pour que le vrai RedisAdapter puisse aussi relire (find).
  const fakeRedis = (): Redis => {
    type MultiFake = Record<string, (...args: unknown[]) => unknown>
    const enregistre =
      (cmd: string, effet?: (args: unknown[]) => void) =>
      (...args: unknown[]): MultiFake => {
        commandes.push({ cmd, args })
        effet?.(args)
        return multi
      }
    const multi: MultiFake = {
      set: enregistre('set', args => {
        store.set(args[0] as string, args[1])
      }),
      hmset: enregistre('hmset', args => {
        store.set(args[0] as string, args[1])
      }),
      expire: enregistre('expire'),
      rpush: enregistre('rpush'),
      exec: async (): Promise<unknown[]> => []
    }
    return {
      multi: (): MultiFake => multi,
      ttl: async (): Promise<number> => -2,
      get: async (key: string): Promise<unknown> => store.get(key),
      hgetall: async (key: string): Promise<unknown> => store.get(key) ?? {}
    } as unknown as Redis
  }

  const payloadEcrit = (): Record<string, unknown> => {
    const ecriture = commandes.find(c => c.cmd === 'hmset' || c.cmd === 'set')!
    const brut =
      ecriture.cmd === 'hmset'
        ? (ecriture.args[1] as { payload: string }).payload
        : (ecriture.args[1] as string)
    return JSON.parse(brut)
  }

  const expirations = (): CommandeRedis[] =>
    commandes.filter(c => c.cmd === 'expire')

  beforeAll(() => {
    // Le dynamicImport de src/oidc-provider/provider.ts ne marche pas sous
    // vitest : on reconstruit le module à la main avec le même contrat.
    const opm: OidcProviderModule = {
      Provider: ProviderClass as unknown as ProviderClassType,
      interactionPolicy,
      errors
    }
    const tokenExchangeGrant = {
      handler: async (): Promise<void> => undefined
    } as unknown as TokenExchangeGrant
    const passEmploiAPIClient: StubbedClass<PassEmploiAPIClient> =
      stubClass(PassEmploiAPIClient)

    const oidcService = new OidcService(
      testConfig(),
      opm,
      fakeRedis(),
      tokenExchangeGrant,
      passEmploiAPIClient
    )
    provider = oidcService.getProvider()
  })

  beforeEach(() => {
    commandes.length = 0
    store.clear()
  })

  afterEach(() => {
    sinon.restore()
  })

  describe('pour un invité', () => {
    it("n'envoie aucun EXPIRE à Redis : la clé vit indéfiniment", async () => {
      // Given
      const refreshToken = new provider.RefreshToken({
        accountId: accountIdInvite,
        clientId: 'app',
        grantId: 'un-grant',
        scope: 'openid'
      })

      // When
      await refreshToken.save()

      // Then
      expect(expirations()).toEqual([])
    })

    it("n'inscrit aucun `exp` dans le payload : le token n'est jamais expiré", async () => {
      // Given
      const refreshToken = new provider.RefreshToken({
        accountId: accountIdInvite,
        clientId: 'app',
        grantId: 'un-grant',
        scope: 'openid'
      })

      // When
      await refreshToken.save()

      // Then
      expect(payloadEcrit()).not.toHaveProperty('exp')
      // isExpired -> `undefined <= now` === false
      expect(refreshToken.isExpired).toBe(false)
    })

    it("n'expire pas non plus le Grant", async () => {
      // Given
      const grant = new provider.Grant({
        accountId: accountIdInvite,
        clientId: 'app'
      })

      // When
      await grant.save()

      // Then
      expect(expirations()).toEqual([])
      expect(payloadEcrit()).not.toHaveProperty('exp')
    })
  })

  // La Session reste à 42 jours. Ce n'est pas un problème pour l'invité : le
  // client app est `native`, donc expiresWithSession renvoie false et le mixin
  // is_session_bound sort avant tout lookup de session (find -> early return).
  describe('lien à la session (Session TTL = 42 jours)', () => {
    it('retrouve le refresh token de l’invité même sans session', async () => {
      // Given : un refresh non lié à la session (cas du client natif)
      const refreshToken = new provider.RefreshToken({
        accountId: accountIdInvite,
        clientId: 'app',
        grantId: 'un-grant',
        scope: 'openid'
      })
      const valeur = await refreshToken.save()

      // La session n'existe pas / a expiré
      sinon.stub(provider.Session, 'findByUid').resolves(undefined)

      // When
      const trouve = await provider.RefreshToken.find(valeur)

      // Then : aucune dépendance à la session
      expect(trouve).toBeDefined()
      expect(trouve.accountId).toEqual(accountIdInvite)
      expect(provider.Session.findByUid.notCalled).toBe(true)
    })

    it('invaliderait au contraire un refresh lié à la session si elle a expiré', async () => {
      // Given : le même token, mais lié à la session
      const refreshToken = new provider.RefreshToken({
        accountId: accountIdInvite,
        clientId: 'app',
        grantId: 'un-grant',
        scope: 'openid'
      })
      refreshToken.expiresWithSession = true
      refreshToken.sessionUid = 'une-session'
      const valeur = await refreshToken.save()

      sinon.stub(provider.Session, 'findByUid').resolves(undefined)

      // When
      const trouve = await provider.RefreshToken.find(valeur)

      // Then : c'est bien ce comportement que le client `native` nous évite
      expect(trouve).toBeUndefined()
    })
  })

  describe('pour un jeune non invité', () => {
    it('applique bien le TTL de 42 jours', async () => {
      // Given
      const refreshToken = new provider.RefreshToken({
        accountId: accountIdJeuneMilo,
        clientId: 'app',
        grantId: 'un-grant',
        scope: 'openid'
      })

      // When
      await refreshToken.save()

      // Then
      const quaranteDeuxJours = 3600 * 24 * 42
      expect(expirations()[0].args[1]).toEqual(quaranteDeuxJours)
      expect(payloadEcrit()).toHaveProperty('exp')
      expect(refreshToken.isExpired).toBe(false)
    })
  })
})

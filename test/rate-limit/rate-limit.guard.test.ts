import { HttpStatus, INestApplication } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { TerminusModule } from '@nestjs/terminus'
import { Test } from '@nestjs/testing'
import { randomUUID } from 'crypto'
import { Request, Response } from 'express'
import Redis from 'ioredis'
import { createSandbox, SinonSpy } from 'sinon'
import request from 'supertest'
import { DeleteAccountUsecase } from '../../src/account/delete-account.usecase'
import { AppController } from '../../src/app.controller'
import { Configuration } from '../../src/config/configuration'
import { InviteController } from '../../src/idp/invite/invite.controller'
import { InviteService } from '../../src/idp/invite/invite.service'
import { MiloJeuneController } from '../../src/idp/milo-jeune/milo-jeune.controller'
import { MiloJeuneService } from '../../src/idp/milo-jeune/milo-jeune.service'
import { OidcController } from '../../src/oidc-provider/oidc.controller'
import { OidcService } from '../../src/oidc-provider/oidc.service'
import {
  estUnPalierDeRefus,
  RateLimitGuard
} from '../../src/rate-limit/rate-limit.guard'
import { RateLimitModule } from '../../src/rate-limit/rate-limit.module'
import { RedisInjectionToken } from '../../src/redis/redis.provider'
import { rootLogger } from '../../src/utils/monitoring/logger.module'
import { emptySuccess, success } from '../../src/utils/result/result'
import { stubClassSandbox } from '../test-utils/types'
import { testConfig } from '../test-utils/module-for-testing'

const ROUTE_IDP = '/milo-jeune/connect/interaction'
const ROUTE_TOKEN = '/auth/realms/pass-emploi/protocol/openid-connect/token'

const rateLimitDeTest = (
  creationInviteLimite: number
): Configuration['rateLimit'] => ({
  actif: true,
  ip: { fenetreSecondes: 60, limite: 2, limiteToken: 3 },
  creationInvite: { fenetreSecondes: 60, limite: creationInviteLimite }
})

describe('RateLimitGuard', () => {
  const keyPrefix = `test-rate-limit-guard-${randomUUID()}:`
  const spies = createSandbox()
  let redis: Redis

  async function creerApplication(
    rateLimit: Configuration['rateLimit']
  ): Promise<INestApplication> {
    const sandbox = createSandbox()
    const miloJeuneService = stubClassSandbox(MiloJeuneService, sandbox)
    miloJeuneService.getAuthorizationUrl.returns(success('https://milo.fr'))
    const inviteService = stubClassSandbox(InviteService, sandbox)
    inviteService.connect.resolves(emptySuccess())
    const deleteAccountUsecase = stubClassSandbox(DeleteAccountUsecase, sandbox)
    deleteAccountUsecase.execute.resolves(emptySuccess())

    const testingModule = await Test.createTestingModule({
      imports: [ConfigModule, TerminusModule, RateLimitModule],
      providers: [
        { provide: APP_GUARD, useClass: RateLimitGuard },
        { provide: MiloJeuneService, useValue: miloJeuneService },
        { provide: InviteService, useValue: inviteService },
        { provide: DeleteAccountUsecase, useValue: deleteAccountUsecase },
        {
          provide: OidcService,
          useValue: {
            callback:
              () =>
              async (_req: Request, res: Response): Promise<void> => {
                res.status(HttpStatus.OK).send()
              }
          }
        }
      ],
      controllers: [
        AppController,
        MiloJeuneController,
        OidcController,
        InviteController
      ]
    })
      .overrideProvider(ConfigService)
      .useValue(testConfig({ rateLimit }))
      .overrideProvider(RedisInjectionToken)
      .useValue(redis)
      .compile()

    const app = testingModule.createNestApplication()
    await app.init()
    return app
  }

  beforeAll(() => {
    // eslint-disable-next-line no-process-env
    redis = new Redis(process.env.REDIS_URL!, { keyPrefix })
  })

  afterEach(async () => {
    spies.restore()
    const keys = await redis.keys(`${keyPrefix}*`)
    if (keys.length > 0) {
      await redis.del(...keys.map(key => key.slice(keyPrefix.length)))
    }
  })

  afterAll(async () => {
    await redis.quit()
  })

  describe('avec la limite activée', () => {
    let app: INestApplication

    beforeAll(async () => {
      app = await creerApplication(rateLimitDeTest(1))
    })

    afterAll(async () => {
      await app.close()
    })

    it('renvoie 429 et Retry-After au-delà de la limite ip', async () => {
      // Given
      const ip = '10.1.0.1'
      await request(app.getHttpServer())
        .get(ROUTE_IDP)
        .set('x-real-ip', ip)
        .expect(HttpStatus.TEMPORARY_REDIRECT)
      await request(app.getHttpServer())
        .get(ROUTE_IDP)
        .set('x-real-ip', ip)
        .expect(HttpStatus.TEMPORARY_REDIRECT)

      // When
      const response = await request(app.getHttpServer())
        .get(ROUTE_IDP)
        .set('x-real-ip', ip)

      // Then
      expect(response.status).toBe(HttpStatus.TOO_MANY_REQUESTS)
      const retryAfter = Number(response.headers['retry-after'])
      expect(retryAfter).toBeGreaterThan(0)
      expect(retryAfter).toBeLessThanOrEqual(60)
    })

    it('compte /token à part quand le quota ip est épuisé', async () => {
      // Given
      const ip = '10.1.0.2'
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .get(ROUTE_IDP)
          .set('x-real-ip', ip)
          .expect(HttpStatus.TEMPORARY_REDIRECT)
      }

      // When - Then
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post(ROUTE_TOKEN)
          .set('x-real-ip', ip)
          .expect(HttpStatus.OK)
      }
      await request(app.getHttpServer())
        .post(ROUTE_TOKEN)
        .set('x-real-ip', ip)
        .expect(HttpStatus.TOO_MANY_REQUESTS)
    })

    it('ne consomme pas le quota ip sur /token', async () => {
      // Given
      const ip = '10.1.0.3'
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post(ROUTE_TOKEN)
          .set('x-real-ip', ip)
          .expect(HttpStatus.OK)
      }

      // When - Then
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .get(ROUTE_IDP)
          .set('x-real-ip', ip)
          .expect(HttpStatus.TEMPORARY_REDIRECT)
      }
      await request(app.getHttpServer())
        .get(ROUTE_IDP)
        .set('x-real-ip', ip)
        .expect(HttpStatus.TOO_MANY_REQUESTS)
    })

    it("n'exempte pas un client inconnu ou un secret faux", async () => {
      // Given
      const ip = '10.1.0.8'
      await request(app.getHttpServer())
        .post(ROUTE_TOKEN)
        .set('x-real-ip', ip)
        .type('form')
        .send({ client_id: 'inconnu', client_secret: 'api-secret' })
        .expect(HttpStatus.OK)
      await request(app.getHttpServer())
        .post(ROUTE_TOKEN)
        .set('x-real-ip', ip)
        .type('form')
        .send({ client_id: 'api', client_secret: 'faux' })
        .expect(HttpStatus.OK)
      await request(app.getHttpServer())
        .post(ROUTE_TOKEN)
        .set('x-real-ip', ip)
        .auth('web', 'web-secret-faux')
        .expect(HttpStatus.OK)

      // When - Then
      await request(app.getHttpServer())
        .post(ROUTE_TOKEN)
        .set('x-real-ip', ip)
        .type('form')
        .send({ client_id: 'api' })
        .expect(HttpStatus.TOO_MANY_REQUESTS)
    })

    it('exempte le client api authentifié par le corps', async () => {
      // Given
      const ip = '10.1.0.9'

      // When - Then
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post(ROUTE_TOKEN)
          .set('x-real-ip', ip)
          .type('form')
          .send({ client_id: 'api', client_secret: 'api-secret' })
          .expect(HttpStatus.OK)
      }
    })

    it('exempte le client web authentifié en Basic', async () => {
      // Given
      const ip = '10.1.0.10'

      // When - Then
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post(ROUTE_TOKEN)
          .set('x-real-ip', ip)
          .auth('web', 'web-secret')
          .expect(HttpStatus.OK)
      }
    })

    it("n'exempte jamais le client app", async () => {
      // Given
      const ip = '10.1.0.11'
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post(ROUTE_TOKEN)
          .set('x-real-ip', ip)
          .auth('app', 'app-secret')
          .expect(HttpStatus.OK)
      }

      // When - Then
      await request(app.getHttpServer())
        .post(ROUTE_TOKEN)
        .set('x-real-ip', ip)
        .type('form')
        .send({ client_id: 'app', client_secret: 'app-secret' })
        .expect(HttpStatus.TOO_MANY_REQUESTS)
    })

    it('distingue deux IP', async () => {
      // Given
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .get(ROUTE_IDP)
          .set('x-real-ip', '10.1.0.4')
      }

      // When - Then
      await request(app.getHttpServer())
        .get(ROUTE_IDP)
        .set('x-real-ip', '10.1.0.5')
        .expect(HttpStatus.TEMPORARY_REDIRECT)
    })

    it("plafonne la création d'invités toutes IP confondues", async () => {
      // Given
      await request(app.getHttpServer())
        .get('/invite/connect/a')
        .set('x-real-ip', '1.1.1.1')
        .expect(HttpStatus.OK)

      // When - Then
      await request(app.getHttpServer())
        .get('/invite/connect/b')
        .set('x-real-ip', '2.2.2.2')
        .expect(HttpStatus.TOO_MANY_REQUESTS)
    })

    it('ne limite jamais /health, / ni la suppression de compte', async () => {
      // Given
      const ip = '10.1.0.6'

      // When - Then
      for (let i = 0; i < 4; i++) {
        await request(app.getHttpServer())
          .get('/health')
          .set('x-real-ip', ip)
          .expect(HttpStatus.OK)
        await request(app.getHttpServer())
          .get('/')
          .set('x-real-ip', ip)
          .expect(HttpStatus.OK)
        await request(app.getHttpServer())
          .delete('/accounts/acc')
          .set({ 'x-real-ip': ip, 'X-API-KEY': 'pass-emploi-back' })
          .expect(HttpStatus.NO_CONTENT)
      }
    })

    it('logue rate_limit_exceeded au 1er et au 10e refus seulement', async () => {
      // Given
      const ip = '10.1.0.7'
      const loggerInfo: SinonSpy = spies.spy(rootLogger, 'info')

      // When
      for (let i = 0; i < 2 + 11; i++) {
        await request(app.getHttpServer()).get(ROUTE_IDP).set('x-real-ip', ip)
      }

      // Then
      const lignesRefus = loggerInfo
        .getCalls()
        .filter(call => call.args[1] === 'rate_limit_exceeded')
        .map(call => call.args[0])
      expect(lignesRefus).toEqual([
        {
          context: 'RateLimitGuard',
          event: { action: 'rate_limit_exceeded', outcome: 'failure' },
          labels: { rate_limit: 'ip', rate_limit_palier: '1' },
          url: { path: ROUTE_IDP },
          client: { ip }
        },
        {
          context: 'RateLimitGuard',
          event: { action: 'rate_limit_exceeded', outcome: 'failure' },
          labels: { rate_limit: 'ip', rate_limit_palier: '10' },
          url: { path: ROUTE_IDP },
          client: { ip }
        }
      ])
    })

    it("logue le refus de création d'invité sans IP client", async () => {
      // Given
      const loggerInfo: SinonSpy = spies.spy(rootLogger, 'info')
      await request(app.getHttpServer())
        .get('/invite/connect/a')
        .set('x-real-ip', '1.1.1.2')

      // When
      await request(app.getHttpServer())
        .get('/invite/connect/b')
        .set('x-real-ip', '2.2.2.3')

      // Then
      const lignesRefus = loggerInfo
        .getCalls()
        .filter(call => call.args[1] === 'rate_limit_exceeded')
        .map(call => call.args[0])
      expect(lignesRefus).toEqual([
        {
          context: 'RateLimitGuard',
          event: { action: 'rate_limit_exceeded', outcome: 'failure' },
          labels: { rate_limit: 'creation-invite', rate_limit_palier: '1' },
          url: { path: '/invite/connect/b' }
        }
      ])
    })
  })

  describe("avec un plafond de création d'invités plus haut que la limite ip", () => {
    let app: INestApplication

    beforeAll(async () => {
      app = await creerApplication(rateLimitDeTest(100))
    })

    afterAll(async () => {
      await app.close()
    })

    it("borne les créations d'invités d'une même IP par la limite ip", async () => {
      // Given
      const ip = '10.2.0.1'
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .get(`/invite/connect/${i}`)
          .set('x-real-ip', ip)
          .expect(HttpStatus.OK)
      }

      // When - Then
      await request(app.getHttpServer())
        .get('/invite/connect/c')
        .set('x-real-ip', ip)
        .expect(HttpStatus.TOO_MANY_REQUESTS)
    })
  })

  describe("avec un plafond de création d'invités à 3", () => {
    let app: INestApplication

    beforeAll(async () => {
      app = await creerApplication(rateLimitDeTest(3))
    })

    afterAll(async () => {
      await app.close()
    })

    it("un flood refusé par ip ne consomme pas le plafond de création d'invités", async () => {
      // Given
      const ipA = '10.4.0.1'
      for (let i = 0; i < 2; i++) {
        await request(app.getHttpServer())
          .get(`/invite/connect/a${i}`)
          .set('x-real-ip', ipA)
          .expect(HttpStatus.OK)
      }
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get(`/invite/connect/flood${i}`)
          .set('x-real-ip', ipA)
          .expect(HttpStatus.TOO_MANY_REQUESTS)
      }

      // When - Then
      await request(app.getHttpServer())
        .get('/invite/connect/b')
        .set('x-real-ip', '10.4.0.2')
        .expect(HttpStatus.OK)
    })
  })

  describe('sans RATE_LIMIT_ACTIF', () => {
    let app: INestApplication

    beforeAll(async () => {
      app = await creerApplication(undefined)
    })

    afterAll(async () => {
      await app.close()
    })

    it("laisse tout passer quand RATE_LIMIT_ACTIF n'est pas posé", async () => {
      // Given
      const ip = '10.3.0.1'

      // When - Then
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .get(ROUTE_IDP)
          .set('x-real-ip', ip)
          .expect(HttpStatus.TEMPORARY_REDIRECT)
        await request(app.getHttpServer())
          .post(ROUTE_TOKEN)
          .set('x-real-ip', ip)
          .expect(HttpStatus.OK)
        await request(app.getHttpServer())
          .get(`/invite/connect/${i}`)
          .set('x-real-ip', ip)
          .expect(HttpStatus.OK)
      }
    })
  })
})

describe('estUnPalierDeRefus', () => {
  it('reconnaît les puissances de 10', () => {
    expect([1, 10, 100, 1000].map(estUnPalierDeRefus)).toEqual([
      true,
      true,
      true,
      true
    ])
  })

  it('écarte les autres nombres de refus', () => {
    expect([0, -1, 2, 9, 11, 99, 101].map(estUnPalierDeRefus)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false
    ])
  })
})

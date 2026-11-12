import { ConfigService } from '@nestjs/config'
import sinon from 'sinon'
import { lireRateLimitConfig } from '../../src/rate-limit/rate-limit.config'
import { rootLogger } from '../../src/utils/monitoring/logger.module'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('lireRateLimitConfig', () => {
  let loggerStub: sinon.SinonStub

  beforeEach(() => {
    loggerStub = sinon.stub(rootLogger, 'error')
  })

  afterEach(() => {
    sinon.restore()
  })

  it('renvoie undefined quand RATE_LIMIT_ACTIF est absent', () => {
    const configService = new ConfigService({
      rateLimit: {
        ip: { fenetreSecondes: 60, limite: 100, limiteToken: 50 },
        creationInvite: { fenetreSecondes: 60, limite: 10 }
      }
    })

    const result = lireRateLimitConfig(configService)

    expect(result).toBeUndefined()
    expect(loggerStub.called).toBe(false)
  })

  it('renvoie undefined quand RATE_LIMIT_ACTIF est false', () => {
    const configService = new ConfigService({
      rateLimit: {
        actif: false,
        ip: { fenetreSecondes: 60, limite: 100, limiteToken: 50 },
        creationInvite: { fenetreSecondes: 60, limite: 10 }
      }
    })

    const result = lireRateLimitConfig(configService)

    expect(result).toBeUndefined()
    expect(loggerStub.called).toBe(false)
  })

  it('convertit les fenêtres de secondes en millisecondes', () => {
    const configService = new ConfigService({
      rateLimit: {
        actif: true,
        ip: { fenetreSecondes: 60, limite: 100, limiteToken: 50 },
        creationInvite: { fenetreSecondes: 120, limite: 10 }
      }
    })

    const result = lireRateLimitConfig(configService)

    expect(result).toEqual({
      ip: { fenetreMs: 60000, limite: 100, limiteToken: 50 },
      creationInvite: { fenetreMs: 120000, limite: 10 }
    })
    expect(loggerStub.called).toBe(false)
  })

  it('renvoie undefined et logue rate_limit_config_invalide si une limite manque', () => {
    const configService = new ConfigService({
      rateLimit: {
        actif: true,
        ip: { fenetreSecondes: 60, limiteToken: 50 },
        creationInvite: { fenetreSecondes: 60, limite: 10 }
      }
    })

    const result = lireRateLimitConfig(configService)

    expect(result).toBeUndefined()
    expect(loggerStub.calledOnce).toBe(true)
    const callArgs = loggerStub.firstCall.args[0]
    expect(callArgs.context).toBe('RateLimitConfig')
    expect(callArgs.event.action).toBe('rate_limit_config_invalide')
    expect(callArgs.event.outcome).toBe('failure')
  })

  it('renvoie undefined et logue si une fenêtre manque', () => {
    const configService = new ConfigService({
      rateLimit: {
        actif: true,
        ip: { limite: 100, limiteToken: 50 },
        creationInvite: { fenetreSecondes: 60, limite: 10 }
      }
    })

    const result = lireRateLimitConfig(configService)

    expect(result).toBeUndefined()
    expect(loggerStub.calledOnce).toBe(true)
  })

  it('renvoie undefined si une limite vaut 0 (parsé en undefined)', () => {
    const configService = new ConfigService({
      rateLimit: {
        actif: true,
        ip: { fenetreSecondes: 60, limite: undefined, limiteToken: 50 },
        creationInvite: { fenetreSecondes: 60, limite: 10 }
      }
    })

    const result = lireRateLimitConfig(configService)

    expect(result).toBeUndefined()
    expect(loggerStub.calledOnce).toBe(true)
  })

  it("renvoie undefined si une limite n'est pas numérique (parsé en undefined)", () => {
    const configService = new ConfigService({
      rateLimit: {
        actif: true,
        ip: { fenetreSecondes: 60, limite: undefined, limiteToken: 50 },
        creationInvite: { fenetreSecondes: 60, limite: 10 }
      }
    })

    const result = lireRateLimitConfig(configService)

    expect(result).toBeUndefined()
    expect(loggerStub.calledOnce).toBe(true)
  })

  it('renvoie undefined si creationInvite.limite manque', () => {
    const configService = new ConfigService({
      rateLimit: {
        actif: true,
        ip: { fenetreSecondes: 60, limite: 100, limiteToken: 50 },
        creationInvite: { fenetreSecondes: 60 }
      }
    })

    const result = lireRateLimitConfig(configService)

    expect(result).toBeUndefined()
    expect(loggerStub.calledOnce).toBe(true)
  })

  it('renvoie undefined si limiteToken manque', () => {
    const configService = new ConfigService({
      rateLimit: {
        actif: true,
        ip: { fenetreSecondes: 60, limite: 100 },
        creationInvite: { fenetreSecondes: 60, limite: 10 }
      }
    })

    const result = lireRateLimitConfig(configService)

    expect(result).toBeUndefined()
    expect(loggerStub.calledOnce).toBe(true)
  })
})

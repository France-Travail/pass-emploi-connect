import { ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerException,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage
} from '@nestjs/throttler'
import { Request, Response } from 'express'
import { rootLogger, toEcsError } from '../utils/monitoring/logger.module'
import { RATE_LIMIT_CONFIG, RateLimitConfig } from './rate-limit.config'
import { nomDuThrottler } from './rate-limit.throttlers'

const THROTTLERS_PAR_IP = ['ip', 'ip-token']
const INTERVALLE_LOG_ECHEC_MS = 60000

export interface RequeteRefuseeParLeRateLimit {
  refuseeParLeRateLimit?: boolean
}

export function estUnPalierDeRefus(refus: number): boolean {
  let palier = 1
  while (palier < refus) {
    palier *= 10
  }
  return palier === refus
}

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  private dernierEchecLogue = 0

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    @Inject(RATE_LIMIT_CONFIG)
    private readonly config: RateLimitConfig | undefined
  ) {
    super(options, storageService, reflector)
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context)
    } catch (erreur) {
      if (erreur instanceof ThrottlerException) {
        throw erreur
      }
      this.loguerEchec(erreur)
      return true
    }
  }

  protected async shouldSkip(_context: ExecutionContext): Promise<boolean> {
    return this.config === undefined
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail
  ): Promise<void> {
    const req = context
      .switchToHttp()
      .getRequest<Request & RequeteRefuseeParLeRateLimit>()
    const res = context.switchToHttp().getResponse<Response>()
    const nom = nomDuThrottler(detail.key)
    const refus = detail.totalHits - detail.limit

    if (estUnPalierDeRefus(refus)) {
      rootLogger.info(
        {
          context: 'RateLimitGuard',
          event: { action: 'rate_limit_exceeded', outcome: 'failure' },
          labels: { rate_limit: nom, rate_limit_palier: String(refus) },
          url: { path: req.path },
          http: { request: { id: req.id } },
          ...(THROTTLERS_PAR_IP.includes(nom) && {
            client: { ip: detail.tracker }
          })
        },
        'rate_limit_exceeded'
      )
    }

    req.refuseeParLeRateLimit = true
    res.header('Retry-After', String(detail.timeToBlockExpire))
    throw new ThrottlerException()
  }

  private loguerEchec(erreur: unknown): void {
    const maintenant = Date.now()
    if (maintenant - this.dernierEchecLogue < INTERVALLE_LOG_ECHEC_MS) {
      return
    }
    this.dernierEchecLogue = maintenant
    rootLogger.error(
      {
        context: 'RateLimitGuard',
        event: { action: 'rate_limit_guard_failed', outcome: 'failure' },
        error: toEcsError(erreur)
      },
      'rate_limit_guard_failed'
    )
  }
}

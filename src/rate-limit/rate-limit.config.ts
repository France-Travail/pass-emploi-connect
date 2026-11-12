import { ConfigService } from '@nestjs/config'
import { rootLogger } from '../utils/monitoring/logger.module'

export interface RateLimitConfig {
  ip: { fenetreMs: number; limite: number; limiteToken: number }
  creationInvite: { fenetreMs: number; limite: number }
}

export function lireRateLimitConfig(
  configService: ConfigService
): RateLimitConfig | undefined {
  const actif = configService.get<boolean>('rateLimit.actif')
  if (!actif) {
    return undefined
  }

  const ipFenetreSecondes = configService.get<number>(
    'rateLimit.ip.fenetreSecondes'
  )
  const ipLimite = configService.get<number>('rateLimit.ip.limite')
  const ipLimiteToken = configService.get<number>('rateLimit.ip.limiteToken')
  const creationInviteFenetreSecondes = configService.get<number>(
    'rateLimit.creationInvite.fenetreSecondes'
  )
  const creationInviteLimite = configService.get<number>(
    'rateLimit.creationInvite.limite'
  )

  if (
    ipFenetreSecondes === undefined ||
    ipLimite === undefined ||
    ipLimiteToken === undefined ||
    creationInviteFenetreSecondes === undefined ||
    creationInviteLimite === undefined
  ) {
    rootLogger.error(
      {
        context: 'RateLimitConfig',
        event: { action: 'rate_limit_config_invalide', outcome: 'failure' }
      },
      'rate_limit_config_invalide'
    )
    return undefined
  }

  return {
    ip: {
      fenetreMs: ipFenetreSecondes * 1000,
      limite: ipLimite,
      limiteToken: ipLimiteToken
    },
    creationInvite: {
      fenetreMs: creationInviteFenetreSecondes * 1000,
      limite: creationInviteLimite
    }
  }
}

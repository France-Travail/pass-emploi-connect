import { ConfigService } from '@nestjs/config'
import { Configuration } from '../config/configuration'
import { rootLogger } from '../utils/monitoring/logger.module'

export const RATE_LIMIT_CONFIG = 'RateLimitConfig'

export interface RateLimitConfig {
  ip: { fenetreMs: number; limite: number; limiteToken: number }
  creationInvite: { fenetreMs: number; limite: number }
}

export function lireRateLimitConfig(
  configService: ConfigService
): RateLimitConfig | undefined {
  const rateLimit = configService.get<Configuration['rateLimit']>('rateLimit')
  if (!rateLimit?.actif) {
    return undefined
  }

  const variables = {
    RATE_LIMIT_IP_FENETRE_SECONDES: rateLimit.ip?.fenetreSecondes,
    RATE_LIMIT_IP_LIMITE: rateLimit.ip?.limite,
    RATE_LIMIT_IP_TOKEN_LIMITE: rateLimit.ip?.limiteToken,
    RATE_LIMIT_CREATION_INVITE_FENETRE_SECONDES:
      rateLimit.creationInvite?.fenetreSecondes,
    RATE_LIMIT_CREATION_INVITE_LIMITE: rateLimit.creationInvite?.limite
  }
  const variablesInvalides = Object.entries(variables)
    .filter(([_nom, valeur]) => valeur === undefined)
    .map(([nom]) => nom)

  if (variablesInvalides.length > 0) {
    rootLogger.error(
      {
        context: 'RateLimitConfig',
        event: { action: 'rate_limit_config_invalide', outcome: 'failure' },
        labels: { rate_limit_variables_invalides: variablesInvalides.join(',') }
      },
      'rate_limit_config_invalide'
    )
    return undefined
  }

  rootLogger.info(
    {
      context: 'RateLimitConfig',
      event: { action: 'rate_limit_activated', outcome: 'success' },
      labels: {
        rate_limit_seuils: Object.entries(variables)
          .map(([nom, valeur]) => `${nom}=${valeur}`)
          .join(',')
      }
    },
    'rate_limit_activated'
  )

  const seuils = variables as Record<keyof typeof variables, number>
  return {
    ip: {
      fenetreMs: seuils.RATE_LIMIT_IP_FENETRE_SECONDES * 1000,
      limite: seuils.RATE_LIMIT_IP_LIMITE,
      limiteToken: seuils.RATE_LIMIT_IP_TOKEN_LIMITE
    },
    creationInvite: {
      fenetreMs: seuils.RATE_LIMIT_CREATION_INVITE_FENETRE_SECONDES * 1000,
      limite: seuils.RATE_LIMIT_CREATION_INVITE_LIMITE
    }
  }
}

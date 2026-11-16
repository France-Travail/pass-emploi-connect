import { ConfigService } from '@nestjs/config'
import { Configuration } from '../config/configuration'
import { rootLogger } from '../utils/monitoring/logger.module'

export const RATE_LIMIT_CONFIG = 'RateLimitConfig'

export interface RateLimitConfig {
  redisUrl: string
  ip: { fenetreMs: number; limite: number; limiteToken?: number }
  creationInvite: { fenetreMs: number; limite: number; limiteIp: number }
}

export function lireRateLimitConfig(
  configService: ConfigService
): RateLimitConfig | undefined {
  const rateLimit = configService.get<Configuration['rateLimit']>('rateLimit')
  if (!rateLimit?.actif) {
    return undefined
  }

  const ipTokenActif = rateLimit.ip?.tokenActif === true
  const variables = {
    RATE_LIMIT_IP_FENETRE_SECONDES: rateLimit.ip?.fenetreSecondes,
    RATE_LIMIT_IP_LIMITE: rateLimit.ip?.limite,
    ...(ipTokenActif && {
      RATE_LIMIT_IP_TOKEN_LIMITE: rateLimit.ip?.limiteToken
    }),
    RATE_LIMIT_CREATION_INVITE_FENETRE_SECONDES:
      rateLimit.creationInvite?.fenetreSecondes,
    RATE_LIMIT_CREATION_INVITE_LIMITE: rateLimit.creationInvite?.limite,
    RATE_LIMIT_CREATION_INVITE_IP_LIMITE: rateLimit.creationInvite?.limiteIp
  }
  const variablesInvalides = Object.entries({
    ...variables,
    RATE_LIMIT_REDIS_URL: rateLimit.redisUrl
  })
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
        rate_limit_seuils: [
          ...Object.entries(variables).map(
            ([nom, valeur]) => `${nom}=${valeur}`
          ),
          `RATE_LIMIT_IP_TOKEN_ACTIF=${ipTokenActif}`
        ].join(',')
      }
    },
    'rate_limit_activated'
  )

  const seuils = variables as Record<keyof typeof variables, number>
  return {
    redisUrl: rateLimit.redisUrl!,
    ip: {
      fenetreMs: seuils.RATE_LIMIT_IP_FENETRE_SECONDES * 1000,
      limite: seuils.RATE_LIMIT_IP_LIMITE,
      ...(ipTokenActif && { limiteToken: seuils.RATE_LIMIT_IP_TOKEN_LIMITE })
    },
    creationInvite: {
      fenetreMs: seuils.RATE_LIMIT_CREATION_INVITE_FENETRE_SECONDES * 1000,
      limite: seuils.RATE_LIMIT_CREATION_INVITE_LIMITE,
      limiteIp: seuils.RATE_LIMIT_CREATION_INVITE_IP_LIMITE
    }
  }
}

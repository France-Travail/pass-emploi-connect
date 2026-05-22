import { rootLogger, toEcsError } from './logger.module'

interface ExternalCallParams {
  // Nom de la cible (IDP) → log.logger via le champ context.
  target: string
  // Opération logique appelée (ex: 'token', 'userinfo').
  operation: string
}

// Enveloppe un appel sortant non-axios (openid-client) et émet un
// external_api_call ECS : outcome, duration, error. Relance toute erreur.
export async function logExternalCall<T>(
  params: ExternalCallParams,
  call: () => Promise<T>
): Promise<T> {
  const startNs = process.hrtime.bigint()
  try {
    const result = await call()
    rootLogger.info(
      {
        context: params.target,
        event: {
          action: 'external_api_call',
          outcome: 'success',
          duration: Number(process.hrtime.bigint() - startNs)
        },
        labels: { operation: params.operation }
      },
      'external_api_call'
    )
    return result
  } catch (error) {
    rootLogger.error(
      {
        context: params.target,
        event: {
          action: 'external_api_call',
          outcome: 'failure',
          duration: Number(process.hrtime.bigint() - startNs)
        },
        labels: { operation: params.operation },
        error: toEcsError(error)
      },
      'external_api_call'
    )
    throw error
  }
}

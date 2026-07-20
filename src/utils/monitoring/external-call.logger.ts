import {
  rootLogger,
  serializeBodyForLog,
  toEcsError
} from './logger.module'

interface ExternalCallParams {
  // Nom de la cible (IDP) → log.logger via le champ context.
  target: string
  // Opération logique appelée (ex: 'token', 'userinfo').
  operation: string
  // Endpoint appelé : connu statiquement (config IDP), openid-client
  // n'exposant pas l'URL réellement utilisée en dehors de l'erreur.
  url: string
  method: string
}

// openid-client (OPError) porte la réponse HTTP brute de l'IDP sur échec :
// c'est la seule occasion de récupérer un status code / www-authenticate,
// openid-client ne les exposant jamais sur succès (cf. piège équivalent
// documenté côté api pour les 401 transitoires i-milo).
function diagnosticFromError(
  error: unknown
): { response: Record<string, unknown> } | undefined {
  const response = (
    error as {
      response?: {
        statusCode?: number
        headers?: Record<string, string>
        body?: unknown
      }
    }
  )?.response
  if (!response) return undefined
  const wwwAuthenticate = response.headers?.['www-authenticate']
  const bodyContent = serializeBodyForLog(response.body)
  return {
    response: {
      ...(response.statusCode && { status_code: response.statusCode }),
      ...(wwwAuthenticate && { www_authenticate: wwwAuthenticate }),
      ...(bodyContent !== undefined && { body: { content: bodyContent } })
    }
  }
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
    // Pas de body brut disponible sur succès (openid-client ne le restitue
    // pas) : on loggue la représentation parsée du résultat, à titre de
    // diagnostic debug seulement (mêmes clés sensibles que sur échec).
    const responseBodyContent = rootLogger.isLevelEnabled('debug')
      ? serializeBodyForLog(result)
      : undefined
    rootLogger.info(
      {
        context: params.target,
        event: {
          action: 'external_api_call',
          outcome: 'success',
          duration: Number(process.hrtime.bigint() - startNs)
        },
        url: { path: params.url },
        http: {
          request: { method: params.method },
          ...(responseBodyContent !== undefined && {
            response: { body: { content: responseBodyContent } }
          })
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
        url: { path: params.url },
        http: { request: { method: params.method }, ...diagnosticFromError(error) },
        labels: { operation: params.operation },
        error: toEcsError(error)
      },
      'external_api_call'
    )
    throw error
  }
}

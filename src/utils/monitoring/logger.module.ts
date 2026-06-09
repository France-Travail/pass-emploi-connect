/* eslint-disable @typescript-eslint/ban-ts-comment */
import { DynamicModule } from '@nestjs/common'
import { Request } from 'express'
import { IncomingMessage } from 'node:http'
import { LoggerModule } from 'nestjs-pino'
import pino, { Logger as PinoInstance } from 'pino'
import { ReqId } from 'pino-http'
import { v4 as uuidV4 } from 'uuid'
import { getAPMInstance } from './apm.init'
import { ContextKey, getContextValue } from './request-context'

// Utilisateur tel que stocké dans le RequestContext une fois identifié.
interface ContextUser {
  id?: string
  type?: string
  structure?: string
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// Deep merge : sans lui pino fait un shallow merge entre mixin et payload du
// log, ce qui écrase les blocs ECS nested (ex: http.request.id du mixin perdu
// quand le payload pose http.request.method).
const deepMerge = (
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> => {
  for (const key of Object.keys(source)) {
    const sourceValue = source[key]
    const targetValue = target[key]
    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      target[key] = deepMerge({ ...targetValue }, sourceValue)
    } else {
      target[key] = sourceValue
    }
  }
  return target
}

const mixinMergeStrategy = (
  mergeObject: Record<string, unknown>,
  mixinObject: Record<string, unknown>
): Record<string, unknown> => deepMerge({ ...mixinObject }, mergeObject)

export const pinoSerializers = {
  err: (err: Error & { code?: string }): Record<string, unknown> => ({
    type: err.name,
    message: err.message,
    stack_trace: err.stack,
    ...(err.code && { code: err.code })
  })
}

// Mixin : injecté sur chaque log. trace.id APM, user.* et interaction_id depuis
// le RequestContext.
const mixin = (): Record<string, unknown> => {
  const apmTraceIds = getAPMInstance().currentTraceIds
  const user = getContextValue<ContextUser>(ContextKey.USER)
  const httpRequestId = getContextValue<string>(ContextKey.HTTP_REQUEST_ID)
  const interactionId = getContextValue<string>(ContextKey.INTERACTION_ID)

  return {
    ...apmTraceIds,
    ...(user && {
      user: { id: user.id, type: user.type, structure: user.structure }
    }),
    ...(httpRequestId && { http: { request: { id: httpRequestId } } }),
    ...(interactionId && { labels: { interaction_id: interactionId } })
  }
}

const pinoOptions = {
  // eslint-disable-next-line no-process-env
  level: process.env.LOG_LEVEL || 'info',
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.headers["x-api-key"]'
  ],
  mixin,
  formatters: {
    level(label: string): object {
      return { level: label }
    }
  },
  serializers: pinoSerializers,
  mixinMergeStrategy
}

// Instance pino partagée : utilisée par pino-http ET par le code applicatif
// via rootLogger.info(obj, action). Garantit la même config partout.
export const rootLogger: PinoInstance = pino(
  pinoOptions as unknown as Parameters<typeof pino>[0]
)

// --- Redaction & sérialisation des bodies --------------------------------
const SENSITIVE_KEY_PATTERNS = [
  'password',
  'pwd',
  'token',
  'secret',
  'authorization',
  'bearer',
  'api_key',
  'apikey',
  'credential'
]

// Une clé est sensible si son nom (insensible à la casse) contient un de ces
// fragments. Volontairement pas `code`/`key` : collision avec des champs métier.
export const isSensitiveKey = (key: string): boolean => {
  const lower = key.toLowerCase()
  return SENSITIVE_KEY_PATTERNS.some(pattern => lower.includes(pattern))
}

const BODY_MAX_LENGTH = 4096

const truncateBody = (str: string): string =>
  str.length > BODY_MAX_LENGTH
    ? str.slice(0, BODY_MAX_LENGTH) + '...[truncated]'
    : str

const redactDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactDeep)
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      out[key] = isSensitiveKey(key) ? '[Redacted]' : redactDeep(val)
    }
    return out
  }
  return value
}

// Sérialise un body pour le log : JSON / form-urlencoded / URLSearchParams,
// clés sensibles masquées, tronqué. undefined si vide.
export const serializeBodyForLog = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined
  if (Buffer.isBuffer(value)) return '[binary]'
  if (
    typeof value === 'object' &&
    typeof (value as { pipe?: unknown }).pipe === 'function'
  ) {
    return '[stream]'
  }

  if (value instanceof URLSearchParams) {
    const redacted = new URLSearchParams()
    let empty = true
    value.forEach((v, k) => {
      empty = false
      redacted.append(k, isSensitiveKey(k) ? '[Redacted]' : v)
    })
    return empty ? undefined : truncateBody(redacted.toString())
  }

  if (typeof value === 'string') {
    if (value.length === 0) return undefined
    try {
      return serializeBodyForLog(JSON.parse(value))
    } catch {
      if (/^[\w.%+-]+=[^&\s]*(&[\w.%+-]+=[^&\s]*)*$/.test(value)) {
        return serializeBodyForLog(new URLSearchParams(value))
      }
      return truncateBody(value)
    }
  }

  if (Array.isArray(value) || isPlainObject(value)) {
    const isEmpty = Array.isArray(value)
      ? value.length === 0
      : Object.keys(value).length === 0
    if (isEmpty) return undefined
    try {
      return truncateBody(JSON.stringify(redactDeep(value)))
    } catch {
      return undefined
    }
  }

  return truncateBody(String(value))
}

const requestBodyFragment = (req: IncomingMessage): Record<string, unknown> => {
  const content = serializeBodyForLog((req as { body?: unknown }).body)
  return content ? { http: { request: { body: { content } } } } : {}
}

// Conversion d'une erreur vers le format ECS error.{type,message,stack_trace}.
export function toEcsError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
      ...(error.stack && { stack_trace: error.stack })
    }
  }
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error
  ) {
    const e = error as { code: unknown; message: unknown }
    return { type: String(e.code), message: String(e.message) }
  }
  return { type: 'Unknown', message: String(error) }
}

// --- pino-http -----------------------------------------------------------
const pinoHttpOptions = {
  logger: rootLogger,
  autoLogging: {
    ignore: (req: IncomingMessage): boolean =>
      req.url?.endsWith('/health') ?? false
  },
  genReqId: (request: Request): ReqId =>
    (request.headers['x-request-id'] as string | undefined) ?? uuidV4(),
  customLogLevel: (
    _req: IncomingMessage,
    res: { statusCode: number },
    err?: Error
  ): 'info' | 'error' => {
    if (err || !res.statusCode || res.statusCode >= 500) return 'error'
    return 'info'
  },
  customSuccessMessage: (): string => 'request_completed',
  customErrorMessage: (): string => 'request_failed',
  customSuccessObject: (
    req: IncomingMessage,
    res: { statusCode: number },
    val: Record<string, unknown>
  ): Record<string, unknown> => {
    const outcome =
      !res.statusCode || res.statusCode >= 400 ? 'failure' : 'success'
    const log = { ...val, event: { action: 'request_completed', outcome } }
    const includeBody =
      outcome === 'failure' || rootLogger.isLevelEnabled('debug')
    return includeBody ? { ...log, ...requestBodyFragment(req) } : log
  },
  customErrorObject: (
    req: IncomingMessage,
    _res: unknown,
    _err: Error,
    val: Record<string, unknown>
  ): Record<string, unknown> => ({
    ...val,
    event: { action: 'request_failed', outcome: 'failure' },
    ...requestBodyFragment(req)
  })
}

export const configureLoggerModule = (): DynamicModule =>
  LoggerModule.forRoot({
    // @ts-ignore — mixinMergeStrategy supporté runtime mais absent de @types
    pinoHttp: [pinoHttpOptions]
  })

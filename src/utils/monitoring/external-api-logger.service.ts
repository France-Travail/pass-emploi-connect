import { Injectable } from '@nestjs/common'
import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig
} from 'axios'
import {
  isSensitiveKey,
  rootLogger,
  serializeBodyForLog
} from './logger.module'

interface AxiosMetadata {
  startTimeNs: bigint
}

type ConfigWithMetadata = InternalAxiosRequestConfig & {
  metadata?: AxiosMetadata
}

type Emit = (
  level: 'info' | 'error',
  obj: Record<string, unknown>,
  msg: string
) => void

// Crée une instance Axios déjà instrumentée pour émettre un external_api_call
// ECS par appel sortant sous le nom `target`. À utiliser via ExternalApiClient.
@Injectable()
export class ExternalApiLoggerService {
  createAxios(target: string): AxiosInstance {
    const instance = axios.create()
    attachExternalApiLogger(instance, (level, obj, msg) => {
      rootLogger[level]({ ...obj, context: target }, msg)
    })
    return instance
  }
}

export function attachExternalApiLogger(
  instance: AxiosInstance,
  emit: Emit
): void {
  instance.interceptors.request.use((config: ConfigWithMetadata) => {
    config.metadata = { startTimeNs: process.hrtime.bigint() }
    return config
  })

  instance.interceptors.response.use(
    response => {
      logCall(
        emit,
        response.config as ConfigWithMetadata,
        response.status,
        undefined,
        response.data
      )
      return response
    },
    (error: AxiosError) => {
      const config = error.config as ConfigWithMetadata | undefined
      logCall(emit, config, error.response?.status, error, error.response?.data)
      return Promise.reject(error)
    }
  )
}

function logCall(
  emit: Emit,
  config: ConfigWithMetadata | undefined,
  statusCode: number | undefined,
  err: AxiosError | undefined,
  responseData: unknown
): void {
  const durationNs = config?.metadata
    ? Number(process.hrtime.bigint() - config.metadata.startTimeNs)
    : undefined

  const { path, domain, search } = parseUrl(config)
  const query = serializeQuery(config, search)
  const isFailure = !!err || (!!statusCode && statusCode >= 400)

  const includeBodies = isFailure || rootLogger.isLevelEnabled('debug')
  const requestBodyContent = includeBodies
    ? serializeBodyForLog(config?.data)
    : undefined
  const responseBodyContent = includeBodies
    ? serializeBodyForLog(responseData)
    : undefined

  const responsePayload =
    statusCode !== undefined || responseBodyContent !== undefined
      ? {
          ...(statusCode !== undefined && { status_code: statusCode }),
          ...(responseBodyContent !== undefined && {
            body: { content: responseBodyContent }
          })
        }
      : undefined

  const obj: Record<string, unknown> = {
    event: {
      action: 'external_api_call',
      outcome: isFailure ? 'failure' : 'success',
      ...(durationNs !== undefined && { duration: durationNs })
    },
    http: {
      request: {
        method: config?.method?.toUpperCase(),
        ...(requestBodyContent !== undefined && {
          body: { content: requestBodyContent }
        })
      },
      ...(responsePayload && { response: responsePayload })
    },
    url: {
      ...(path && { path }),
      ...(domain && { domain }),
      ...(query && { query })
    },
    ...(err && {
      error: {
        type: err.name,
        message: err.message,
        ...(err.stack && { stack_trace: err.stack })
      }
    })
  }

  const isCrash =
    (!!statusCode && statusCode >= 500) || (!!err && statusCode === undefined)
  emit(isCrash ? 'error' : 'info', obj, 'external_api_call')
}

function parseUrl(config: ConfigWithMetadata | undefined): {
  path?: string
  domain?: string
  search?: string
} {
  if (!config?.url) return {}
  try {
    const url = new URL(config.url, config.baseURL)
    return { path: url.pathname, domain: url.hostname, search: url.search }
  } catch {
    return { path: config.url }
  }
}

function serializeQuery(
  config: ConfigWithMetadata | undefined,
  search: string | undefined
): string | undefined {
  const entries: Array<[string, string]> = []

  if (search) {
    new URLSearchParams(search).forEach((value, key) =>
      entries.push([key, value])
    )
  }

  const params = config?.params
  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => entries.push([key, value]))
  } else if (params && typeof params === 'object') {
    for (const [key, value] of Object.entries(params)) {
      entries.push([key, String(value)])
    }
  }

  if (entries.length === 0) return undefined

  const redacted = new URLSearchParams()
  for (const [key, value] of entries) {
    redacted.append(key, isSensitiveKey(key) ? '[Redacted]' : value)
  }
  return redacted.toString()
}

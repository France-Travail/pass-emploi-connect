import { DynamicModule } from '@nestjs/common'
import { IncomingMessage } from 'http'
import { LoggerModule } from 'nestjs-pino'
import { ReqId } from 'pino-http'
import * as uuid from 'uuid'
import { getAPMInstance } from './apm.init'
import { MixinFn } from 'pino'

export const configureLoggerModule = (): DynamicModule =>
  LoggerModule.forRoot({
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    // @ts-ignore
    pinoHttp: [
      {
        autoLogging: {
          ignore: (req: IncomingMessage): boolean => {
            if (req.url?.endsWith('/health')) {
              return true
            }
            return false
          }
        },
        redact: ['req.headers.authorization', 'req.headers["x-api-key"]'],
        formatters: {
          level(label): object {
            return { level: label }
          }
        },
        // eslint-disable-next-line no-process-env
        level: process.env.LOG_LEVEL ?? 'info',
        mixin: (): (() => MixinFn) => {
          const currentTraceIds = getAPMInstance().currentTraceIds
          // @ts-ignore
          return !Object.keys(currentTraceIds).length ? {} : { currentTraceIds }
        },
        genReqId: (request: IncomingMessage): ReqId =>
          (request.headers['x-request-id'] as string | undefined) ?? uuid.v4()
      }
    ]
  })

export interface LogError {
  message: string
  err?: Error | string
}

export function buildError(message: string, error: unknown): LogError {
  const err = error instanceof Error ? error : undefined
  return {
    message,
    err: err ? (isEnumerable(err) ? err : err.stack) : String(error)
  }
}

function isEnumerable(error: Error): boolean {
  return Boolean(Object.keys(error).length)
}

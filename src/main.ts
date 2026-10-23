import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { initializeAPMAgent } from './utils/monitoring/apm.init'
import { ContextInterceptor } from './utils/monitoring/context.interceptor'
import { RequestContext } from './utils/monitoring/request-context'
import { requestFilter } from './utils/request-filter.middleware'

import { custom } from 'openid-client'

// configure openid-client HTTP layer globally (runs once at startup)
// L'agent n'est pas posé ici : il dépend du protocole de la cible, et est donc
// appliqué par instance (cf. utils/http-agent.ts).
custom.setHttpOptionsDefaults({
  timeout: 15000 // default was 3500ms
})

initializeAPMAgent()

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const appConfig = app.get(ConfigService)

  // Enregistré avant app.listen() : passe avant les middlewares des modules,
  // dont pino-http, donc une requête filtrée ne coûte aucun log.
  app.use(requestFilter(appConfig.get<string[]>('blockedIps') ?? []))

  const logger = app.get(Logger)
  app.useLogger(logger)

  const requestContext = app.get(RequestContext)
  app.useGlobalInterceptors(new ContextInterceptor(requestContext))

  const corsAllowedOrigins = appConfig.get('cors.allowedOrigins')
  if (corsAllowedOrigins && corsAllowedOrigins.length > 0) {
    app.enableCors({
      origin: corsAllowedOrigins,
      maxAge: 86400
    })
  } else {
    logger.warn('No CORS domain configured so CORS is disabled.')
  }

  const port = appConfig.get('port')
  await app.listen(port, '0.0.0.0')
}
bootstrap()

import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'
import { initializeAPMAgent } from './utils/monitoring/apm.init'

import { custom } from 'openid-client'
import https from 'https'

// configure openid-client HTTP layer globally (runs once at startup)
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 20
})

custom.setHttpOptionsDefaults({
  timeout: 15000, // default was 3500ms
  agent: httpsAgent
})

initializeAPMAgent()

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

  const logger = app.get(Logger)
  app.useLogger(logger)

  const appConfig = app.get(ConfigService)

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

import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import Redis from 'ioredis'
import configuration from '../config/configuration'
import { RedisInjectionToken, RedisProvider } from '../redis/redis.provider'
import { initializeAPMAgent } from '../utils/monitoring/apm.init'

const DEFAULT_NB_JEUNES = 1000
const TTL_SECONDS = 86400
const TOKEN_TYPES = ['access_token', 'refresh_token']

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.environment',
      cache: true,
      load: [configuration]
    })
  ],
  providers: [RedisProvider]
})
class SeedScriptModule {}

const logger = new Logger('SeedScript')

// RedisProvider appelle getAPMInstance() de façon synchrone dans le factory
initializeAPMAgent()

async function main(): Promise<void> {
  const nbJeunes = process.argv[2]
    ? Number.parseInt(process.argv[2], 10)
    : DEFAULT_NB_JEUNES

  const context = await NestFactory.createApplicationContext(SeedScriptModule, {
    logger: ['log', 'error', 'warn']
  })
  const redis = context.get<Redis>(RedisInjectionToken)

  try {
    let count = 0
    const batchSize = 100

    for (let start = 1; start <= nbJeunes; start += batchSize) {
      const end = Math.min(start + batchSize - 1, nbJeunes)
      const pipeline = redis.pipeline()

      for (let i = start; i <= end; i++) {
        const idx = String(i).padStart(4, '0')
        const idAuth = `test-migration-auth-${idx}`
        const expiresAt = Math.floor(Date.now() / 1000) + TTL_SECONDS
        const value = JSON.stringify({
          token: `fake-idp-token-${idx}`,
          expiresAt
        })

        for (const tokenType of TOKEN_TYPES) {
          pipeline.set(
            `${tokenType}:JEUNE|POLE_EMPLOI|${idAuth}`,
            value,
            'EX',
            TTL_SECONDS
          )
        }
        count++
      }

      await pipeline.exec()
      logger.log(`Jeunes insérés : ${count}`)
    }

    logger.log(`Seed terminé : ${count} jeunes créés`)
  } finally {
    await context.close()
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error('Erreur seed:', err)
    process.exit(1)
  })

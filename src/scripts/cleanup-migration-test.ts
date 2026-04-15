import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { Redis } from 'ioredis'
import configuration from '../config/configuration.js'
import { RedisInjectionToken, RedisProvider } from '../redis/redis.provider.js'
import { initializeAPMAgent } from '../utils/monitoring/apm.init.js'

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
class CleanupScriptModule {}

const logger = new Logger('CleanupScript')

// RedisProvider appelle getAPMInstance() de façon synchrone dans le factory
initializeAPMAgent()

async function main(): Promise<void> {
  const context = await NestFactory.createApplicationContext(
    CleanupScriptModule,
    {
      logger: ['log', 'error', 'warn']
    }
  )
  const redis = context.get<Redis>(RedisInjectionToken)

  try {
    let totalDeleted = 0
    let cursor = '0'

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        '*test-migration-auth-*',
        'COUNT',
        500
      )
      cursor = nextCursor

      if (keys.length > 0) {
        const keysWithoutPrefix = keys.map(key => key.replace(/^oidc:/, ''))
        const pipeline = redis.pipeline()
        for (const key of keysWithoutPrefix) {
          pipeline.del(key)
        }
        await pipeline.exec()
        totalDeleted += keys.length
        logger.log(`Clés supprimées : ${totalDeleted}`)
      }
    } while (cursor !== '0')

    logger.log(`Cleanup terminé : ${totalDeleted} clés supprimées`)
  } finally {
    await context.close()
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error('Erreur cleanup:', err)
    process.exit(1)
  })

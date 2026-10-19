import { Logger, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { readFileSync } from 'fs'
import Redis from 'ioredis'
import { revoquerAcces } from '../account/revoquer-acces'
import configuration from '../config/configuration'
import { RedisInjectionToken, RedisProvider } from '../redis/redis.provider'
import { initializeAPMAgent } from '../utils/monitoring/apm.init'

// Mode d'emploi : docs/runbook-revocation-acces.md

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
class RevoquerAccesScriptModule {}

const logger = new Logger('RevoquerAccesScript')

// RedisProvider appelle getAPMInstance() de façon synchrone dans le factory
initializeAPMAgent()

function lireSubs(chemin: string): Set<string> {
  return new Set(
    readFileSync(chemin, 'utf-8')
      .split('\n')
      .map(ligne => ligne.trim())
      .filter(ligne => ligne.length > 0)
  )
}

async function main(): Promise<void> {
  const [chemin, ...flags] = process.argv.slice(2)
  if (!chemin) {
    throw new Error('Usage : revoquer-acces <fichier-subs> [--execute]')
  }
  const execute = flags.includes('--execute')
  const subs = lireSubs(chemin)
  logger.log(
    `${subs.size} subs à traiter, mode ${execute ? 'EXECUTE' : 'DRY-RUN'}`
  )

  const context = await NestFactory.createApplicationContext(
    RevoquerAccesScriptModule,
    { logger: ['log', 'error', 'warn'] }
  )
  const redis = context.get<Redis>(RedisInjectionToken)

  try {
    const bilan = await revoquerAcces(redis, subs, { execute })
    logger.log(
      `Grants : ${bilan.grants}, sessions : ${bilan.sessions}, tokens IdP : ${bilan.tokensIdp}, clés supprimées : ${bilan.clesSupprimees}`
    )
    logger.log(`Comptes trouvés (${bilan.accountIds.length}) :`)
    bilan.accountIds.forEach(accountId => logger.log(`  ${accountId}`))
    logger.log(`Subs sans aucune trace (${bilan.subsSansTrace.length}) :`)
    bilan.subsSansTrace.forEach(sub => logger.log(`  ${sub}`))
  } finally {
    await context.close()
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    logger.error('Erreur révocation accès :', err)
    process.exit(1)
  })

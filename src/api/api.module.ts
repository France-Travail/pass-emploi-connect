import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PassEmploiAPIClient } from './pass-emploi-api.client'
import { FrancetravailAPIClient } from './francetravail-api.client'
import { ExternalApiLoggerService } from '../utils/monitoring/external-api-logger.service'

@Module({
  imports: [ConfigModule],
  providers: [
    PassEmploiAPIClient,
    FrancetravailAPIClient,
    ExternalApiLoggerService
  ],
  exports: [PassEmploiAPIClient, FrancetravailAPIClient]
})
export class APIModule {}

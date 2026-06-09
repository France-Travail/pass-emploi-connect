import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as APM from 'elastic-apm-node'
import { getAPMInstance } from '../utils/monitoring/apm.init'
import { ExternalApiLoggerService } from '../utils/monitoring/external-api-logger.service'
import { NonTrouveError } from '../utils/result/error'
import { Result, failure, success } from '../utils/result/result'
import { ExternalApiClient } from './external-api-client'

export interface CoordonneesFT {
  nom: string
  prenom: string
  email: string
}

@Injectable()
export class FrancetravailAPIClient extends ExternalApiClient {
  private readonly apiUrl: string
  protected apmService: APM.Agent

  constructor(
    private readonly configService: ConfigService,
    externalApiLogger: ExternalApiLoggerService
  ) {
    super('FrancetravailApiClient', externalApiLogger)
    this.apmService = getAPMInstance()
    this.apiUrl = this.configService.get('apis.francetravail.url')!
  }

  async getCoordonness(
    accessTokenJeune: string
  ): Promise<Result<CoordonneesFT>> {
    try {
      const coordonnees = await this.axios.get(
        `${this.apiUrl}/peconnect-coordonnees/v1/coordonnees`,
        {
          headers: {
            Authorization: `Bearer ${accessTokenJeune}`
          }
        }
      )

      return success({
        nom: coordonnees.data.nom,
        prenom: coordonnees.data.prenom,
        email: coordonnees.data.email
      })
    } catch (e) {
      this.apmService.captureError(
        e instanceof Error ? e : new Error(String(e))
      )
      return failure(new NonTrouveError('Coordonnées FT'))
    }
  }
}

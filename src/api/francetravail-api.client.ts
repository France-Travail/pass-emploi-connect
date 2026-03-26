import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as APM from 'elastic-apm-node'
import { firstValueFrom } from 'rxjs'
import { getAPMInstance } from '../utils/monitoring/apm.init'
import { buildError } from '../utils/monitoring/logger.module'
import { NonTrouveError } from '../utils/result/error'
import { Result, failure, success } from '../utils/result/result'

export interface CoordonneesFT {
  nom: string
  prenom: string
  email: string
}

@Injectable()
export class FrancetravailAPIClient {
  private readonly logger: Logger
  private readonly apiUrl: string
  protected apmService: APM.Agent

  constructor(
    private readonly configService: ConfigService,
    private httpService: HttpService
  ) {
    this.logger = new Logger('FrancetravailAPIClient')
    this.apmService = getAPMInstance()
    this.apiUrl = this.configService.get('apis.francetravail.url')!
  }

  async getCoordonness(
    accessTokenJeune: string
  ): Promise<Result<CoordonneesFT>> {
    try {
      const coordonnees = await firstValueFrom(
        this.httpService.get(
          `${this.apiUrl}/peconnect-coordonnees/v1/coordonnees`,
          {
            headers: {
              Authorization: `Bearer ${accessTokenJeune}`
            }
          }
        )
      )

      return success({
        nom: coordonnees.data.nom,
        prenom: coordonnees.data.prenom,
        email: coordonnees.data.email
      })
    } catch (e) {
      this.logger.error(
        buildError('Erreur lors de la récupération des coordonnées FT', e)
      )
      this.apmService.captureError(
        e instanceof Error ? e : new Error(String(e))
      )
      return failure(new NonTrouveError('Coordonnées FT'))
    }
  }
}

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JWK, JWTPayload, errors, importJWK, jwtVerify } from 'jose'
import { DateTime } from 'luxon'
import { JWKS } from 'oidc-provider'
import { DateService } from '../utils/date.service.js'
import { JWTError } from '../utils/result/error.js'
import { Result, failure, success } from '../utils/result/result.js'
import * as APM from 'elastic-apm-node'
import { getAPMInstance } from '../utils/monitoring/apm.init.js'

interface Inputs {
  token: string
}
@Injectable()
export class ValidateJWTUsecase {
  private readonly logger: Logger
  protected apmService: APM.Agent

  constructor(
    private configService: ConfigService,
    private dateService: DateService
  ) {
    this.logger = new Logger('ValidateJWTUsecase')
    this.apmService = getAPMInstance()
  }

  async execute(inputs: Inputs): Promise<Result<JWTPayload>> {
    const JWKSfromConfig = this.configService.get<JWKS>('jwks')!
    const error: JWTError = new JWTError(errors.JWKSNoMatchingKey.code)

    for (const JWKfromConfig of JWKSfromConfig.keys) {
      try {
        const importedJWK = await importJWK(JWKfromConfig as JWK)
        const { payload } = await jwtVerify(inputs.token, importedJWK)

        if (this.isExpired(payload.exp)) {
          error.code = errors.JWTExpired.code
          return failure(error)
        }
        return success(payload)
      } catch (e) {
        error.code =
          (e as { code?: string }).code ?? errors.JWKSNoMatchingKey.code
      }
    }
    return failure(error)
  }

  private isExpired(exp?: number): boolean {
    if (!exp) {
      return true
    }
    const tokenExpirationTime =
      DateTime.fromSeconds(exp).setZone('Europe/Paris')
    const currentTime = this.dateService.now().setZone('Europe/Paris')
    return tokenExpirationTime.toUTC() < currentTime.toUTC()
  }
}

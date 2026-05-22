import { AxiosInstance } from 'axios'
import { ExternalApiLoggerService } from '../utils/monitoring/external-api-logger.service'

// Classe de base pour tout client HTTP appelant une API externe. Impose un nom
// de cible (`target`) qui apparaît dans log.logger des external_api_call.
export abstract class ExternalApiClient {
  protected readonly axios: AxiosInstance

  protected constructor(
    target: string,
    externalApiLogger: ExternalApiLoggerService
  ) {
    this.axios = externalApiLogger.createAxios(target)
  }
}

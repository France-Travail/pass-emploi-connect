import { Controller, All, Req, Res } from '@nestjs/common'
import { Request, Response } from 'express'
import { OidcService } from './oidc.service'
import * as APM from 'elastic-apm-node'
import { getAPMInstance } from '../utils/monitoring/apm.init'
import { rootLogger, toEcsError } from '../utils/monitoring/logger.module'

@Controller('auth/realms/pass-emploi')
export class OidcController {
  private callback: (req: Request, res: Response) => Promise<void>
  protected apmService: APM.Agent

  constructor(private readonly oidcService: OidcService) {
    this.callback = this.oidcService.callback()
    this.apmService = getAPMInstance()
  }

  @All([
    '.well-known/openid-configuration',
    'protocol/openid-connect/*path',
    'clients-registrations/*path'
  ])
  public mountedOidc(@Req() req: Request, @Res() res: Response): Promise<void> {
    try {
      req.url = req.originalUrl.replace('/auth/realms/pass-emploi', '')
      return this.callback(req, res)
    } catch (e) {
      rootLogger.error(
        { context: 'OidcController', error: toEcsError(e) },
        'oidc_controller_error'
      )
      this.apmService.captureError(
        e instanceof Error ? e : new Error(String(e))
      )
      throw e
    }
  }
}

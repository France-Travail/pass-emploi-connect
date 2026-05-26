import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Redirect,
  Req,
  Res
} from '@nestjs/common'
import { Request, Response } from 'express'
import { isFailure } from '../../utils/result/result'
import { redirectFailure } from '../../utils/result/result.handler'
import { MiloConseillerService } from './milo-conseiller.service'
import { User } from '../../domain/user'
import { rootLogger } from '../../utils/monitoring/logger.module'

@Controller()
export class MiloConseillerController {
  constructor(private readonly miloConseillerService: MiloConseillerService) {}

  @Get('milo-conseiller/connect/:interactionId')
  @Redirect('blank', HttpStatus.TEMPORARY_REDIRECT)
  async connect(
    @Res({ passthrough: true }) response: Response,
    @Param('interactionId') interactionId: string
  ): Promise<{ url: string } | void> {
    rootLogger.info(
      {
        context: 'MiloConseillerController',
        event: { action: 'login_initiated', outcome: 'success' },
        labels: { idp: 'milo-conseiller' }
      },
      'login_initiated'
    )
    const authorizationUrlResult =
      this.miloConseillerService.getAuthorizationUrl(interactionId)
    if (isFailure(authorizationUrlResult))
      return redirectFailure(
        response,
        authorizationUrlResult,
        User.Type.CONSEILLER,
        User.Structure.MILO
      )
    return {
      url: authorizationUrlResult.data
    }
  }

  @Get('auth/realms/pass-emploi/broker/similo-conseiller/endpoint')
  async callback(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<void> {
    const result = await this.miloConseillerService.callback(request, response)
    if (isFailure(result))
      return redirectFailure(
        response,
        result,
        User.Type.CONSEILLER,
        User.Structure.MILO
      )
  }
}

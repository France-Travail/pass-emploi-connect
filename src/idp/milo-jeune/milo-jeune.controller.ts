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
import { MiloJeuneService } from './milo-jeune.service'
import { User } from '../../domain/user'
import { rootLogger } from '../../utils/monitoring/logger.module'

@Controller()
export class MiloJeuneController {
  constructor(private readonly miloJeuneService: MiloJeuneService) {}

  @Get('milo-jeune/connect/:interactionId')
  @Redirect('blank', HttpStatus.TEMPORARY_REDIRECT)
  async connect(
    @Res({ passthrough: true }) response: Response,
    @Param('interactionId') interactionId: string
  ): Promise<{ url: string } | void> {
    rootLogger.info(
      {
        context: 'MiloJeuneController',
        event: { action: 'login_initiated', outcome: 'success' },
        labels: { idp: 'milo-jeune' }
      },
      'login_initiated'
    )
    const authorizationUrlResult =
      this.miloJeuneService.getAuthorizationUrl(interactionId)
    if (isFailure(authorizationUrlResult))
      return redirectFailure(
        response,
        authorizationUrlResult,
        User.Type.JEUNE,
        User.Structure.MILO
      )
    return {
      url: authorizationUrlResult.data
    }
  }

  @Get('auth/realms/pass-emploi/broker/similo-jeune/endpoint')
  async callback(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ url: string } | void> {
    const result = await this.miloJeuneService.callback(request, response)
    if (isFailure(result))
      return redirectFailure(
        response,
        result,
        User.Type.JEUNE,
        User.Structure.MILO
      )
  }
}

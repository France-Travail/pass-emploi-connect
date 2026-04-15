import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
  Redirect,
  Req,
  Res
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { isFailure } from '../../utils/result/result.js'
import { redirectFailure } from '../../utils/result/result.handler.js'
import { MiloConseillerService } from './milo-conseiller.service.js'
import { User } from '../../domain/user.js'

@Controller()
export class MiloConseillerController {
  private readonly logger: Logger

  constructor(private readonly miloConseillerService: MiloConseillerService) {
    this.logger = new Logger('MiloConseillerController')
  }

  @Get('milo-conseiller/connect/:interactionId')
  @Redirect('blank', HttpStatus.TEMPORARY_REDIRECT)
  async connect(
    @Res({ passthrough: true }) response: Response,
    @Param('interactionId') interactionId: string
  ): Promise<{ url: string } | void> {
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

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
import { Request, Response } from 'express'
import { isFailure } from '../../utils/result/result.js'
import { redirectFailure } from '../../utils/result/result.handler.js'
import { ConseilDepartementalConseillerService } from './conseildepartemental-conseiller.service.js'
import { User } from '../../domain/user.js'

@Controller()
export class ConseilDepartementalConseillerController {
  private readonly logger: Logger

  constructor(
    private readonly conseilDepartementalConseillerService: ConseilDepartementalConseillerService
  ) {
    this.logger = new Logger('ConseilDepartementalConseiller')
  }

  @Get('conseildepartemental-conseiller/connect/:interactionId')
  @Redirect('blank', HttpStatus.TEMPORARY_REDIRECT)
  async connect(
    @Res({ passthrough: true }) response: Response,
    @Param('interactionId') interactionId: string
  ): Promise<{ url: string } | void> {
    const authorizationUrlResult =
      this.conseilDepartementalConseillerService.getAuthorizationUrl(
        interactionId
      )
    if (isFailure(authorizationUrlResult))
      return redirectFailure(
        response,
        authorizationUrlResult,
        User.Type.CONSEILLER,
        User.Structure.CONSEIL_DEPT
      )
    return {
      url: authorizationUrlResult.data
    }
  }

  @Get(
    'auth/realms/pass-emploi/broker/conseildepartemental-conseiller/endpoint'
  )
  async callback(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<void> {
    const result = await this.conseilDepartementalConseillerService.callback(
      request,
      response
    )
    if (isFailure(result))
      return redirectFailure(
        response,
        result,
        User.Type.CONSEILLER,
        User.Structure.CONSEIL_DEPT
      )
  }
}

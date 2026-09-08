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
import { User } from '../../domain/user'
import { isFailure } from '../../utils/result/result'
import { redirectFailure } from '../../utils/result/result.handler'
import { FrancetravailConseillerService } from './francetravail-conseiller.service'

// Un conseiller France Travail se connecte sans dispositif : il le choisit sur le web.
@Controller()
export class FrancetravailConseillerController {
  constructor(
    private readonly francetravailConseillerService: FrancetravailConseillerService
  ) {}

  @Get('francetravail-conseiller/connect/:interactionId')
  @Redirect('blank', HttpStatus.TEMPORARY_REDIRECT)
  async connect(
    @Res({ passthrough: true }) response: Response,
    @Param('interactionId') interactionId: string
  ): Promise<{ url: string } | void> {
    const authorizationUrlResult =
      this.francetravailConseillerService.getAuthorizationUrl(interactionId)

    if (isFailure(authorizationUrlResult))
      return redirectFailure(
        response,
        authorizationUrlResult,
        User.Type.CONSEILLER,
        User.Structure.FRANCE_TRAVAIL
      )

    return {
      url: authorizationUrlResult.data
    }
  }

  @Get('auth/realms/pass-emploi/broker/pe-conseiller/endpoint')
  async callback(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ url: string } | void> {
    const result = await this.francetravailConseillerService.callback(
      request,
      response
    )
    if (isFailure(result))
      return redirectFailure(
        response,
        result,
        User.Type.CONSEILLER,
        User.Structure.FRANCE_TRAVAIL
      )
  }
}

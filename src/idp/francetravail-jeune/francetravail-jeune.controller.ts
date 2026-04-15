import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
  Query,
  Redirect,
  Req,
  Res
} from '@nestjs/common'
import { Request, Response } from 'express'
import { isFailure } from '../../utils/result/result.js'
import { redirectFailure } from '../../utils/result/result.handler.js'
import { FrancetravailAIJService } from './francetravail-aij.service.js'
import { FrancetravailBeneficiaireService } from './francetravail-beneficiaire.service.js'
import { FrancetravailBRSAService } from './francetravail-brsa.service.js'
import { FrancetravailJeuneCEJService } from './francetravail-jeune.service.js'
import { User } from '../../domain/user.js'

@Controller()
export class FrancetravailJeuneController {
  private readonly logger: Logger

  constructor(
    private readonly francetravailJeuneCEJService: FrancetravailJeuneCEJService,
    private readonly francetravailAIJService: FrancetravailAIJService,
    private readonly francetravailBRSAService: FrancetravailBRSAService,
    private readonly francetravailBeneficiaireService: FrancetravailBeneficiaireService
  ) {
    this.logger = new Logger('FrancetravailJeuneController')
  }

  @Get('francetravail-jeune/connect/:interactionId')
  @Redirect('blank', HttpStatus.TEMPORARY_REDIRECT)
  async connect(
    @Res({ passthrough: true }) response: Response,
    @Param('interactionId') interactionId: string,
    @Query() ftQueryParams: { type: string }
  ): Promise<{ url: string } | void> {
    let authorizationUrlResult
    let structure: User.Structure

    switch (ftQueryParams.type) {
      case 'aij': // retrocompat
        structure = User.Structure.POLE_EMPLOI_AIJ
        authorizationUrlResult =
          this.francetravailAIJService.getAuthorizationUrl(
            interactionId,
            ftQueryParams.type
          )
        break
      case 'brsa': // retrocompat
        structure = User.Structure.POLE_EMPLOI_BRSA
        authorizationUrlResult =
          this.francetravailBRSAService.getAuthorizationUrl(
            interactionId,
            ftQueryParams.type
          )
        break
      case 'cej': // retrocompat
        structure = User.Structure.POLE_EMPLOI_CEJ
        authorizationUrlResult =
          this.francetravailJeuneCEJService.getAuthorizationUrl(
            interactionId,
            ftQueryParams.type
          )
        break
      case 'ft-beneficiaire':
      default:
        structure = User.Structure.FRANCE_TRAVAIL
        authorizationUrlResult =
          this.francetravailBeneficiaireService.getAuthorizationUrl(
            interactionId,
            ftQueryParams.type
          )
    }

    if (isFailure(authorizationUrlResult))
      return redirectFailure(
        response,
        authorizationUrlResult,
        User.Type.JEUNE,
        structure
      )

    return {
      url: authorizationUrlResult.data
    }
  }

  @Get('auth/realms/pass-emploi/broker/pe-jeune/endpoint')
  async callback(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<{ url: string } | void> {
    const ftType = request.query.state
    let result
    let structure: User.Structure

    switch (ftType) {
      case 'aij': // retrocompat
        structure = User.Structure.POLE_EMPLOI_AIJ
        result = await this.francetravailAIJService.callback(request, response)
        break
      case 'brsa': // retrocompat
        structure = User.Structure.POLE_EMPLOI_BRSA
        result = await this.francetravailBRSAService.callback(request, response)
        break
      case 'cej': // retrocompat
        structure = User.Structure.POLE_EMPLOI_CEJ
        result = await this.francetravailJeuneCEJService.callback(
          request,
          response
        )
        break
      case 'ft-beneficiaire':
      default:
        structure = User.Structure.FRANCE_TRAVAIL
        result = await this.francetravailBeneficiaireService.callback(
          request,
          response
        )
        break
    }
    if (isFailure(result))
      return redirectFailure(response, result, User.Type.JEUNE, structure)
  }
}

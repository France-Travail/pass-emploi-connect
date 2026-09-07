import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Redirect,
  Req,
  Res
} from '@nestjs/common'
import { Request, Response } from 'express'
import { isFailure } from '../../utils/result/result'
import { redirectFailure } from '../../utils/result/result.handler'
import { FrancetravailBeneficiaireService } from './francetravail-beneficiaire.service'
import { User } from '../../domain/user'

// Bouton unique FT Connect : un seul IdP bénéficiaire, l'API résout le dispositif en base.
@Controller()
export class FrancetravailJeuneController {
  constructor(
    private readonly francetravailBeneficiaireService: FrancetravailBeneficiaireService
  ) {}

  @Get('francetravail-jeune/connect/:interactionId')
  @Redirect('blank', HttpStatus.TEMPORARY_REDIRECT)
  async connect(
    @Res({ passthrough: true }) response: Response,
    @Param('interactionId') interactionId: string,
    @Query() ftQueryParams: { type?: string }
  ): Promise<{ url: string } | void> {
    const authorizationUrlResult =
      this.francetravailBeneficiaireService.getAuthorizationUrl(
        interactionId,
        ftQueryParams.type
      )

    if (isFailure(authorizationUrlResult))
      return redirectFailure(
        response,
        authorizationUrlResult,
        User.Type.JEUNE,
        User.Structure.FRANCE_TRAVAIL
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
    const result = await this.francetravailBeneficiaireService.callback(
      request,
      response
    )
    if (isFailure(result))
      return redirectFailure(
        response,
        result,
        User.Type.JEUNE,
        User.Structure.FRANCE_TRAVAIL
      )
  }
}

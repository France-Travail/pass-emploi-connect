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
import { FrancetravailConseillerAccompagnementIntensifService } from './francetravail-conseiller-accompagnement-intensif.service'
import { FrancetravailConseillerAccompagnementGlobalService } from './francetravail-conseiller-accompagnement-global.service'
import { FrancetravailConseillerEquipEmploiRecrutService } from './francetravail-conseiller-equip-emploi-recrut.service'
import { isFailure } from '../../utils/result/result'
import { redirectFailure } from '../../utils/result/result.handler'
import { FrancetravailConseillerAIJService } from './francetravail-conseiller-aij.service'
import { FrancetravailConseillerBRSAService } from './francetravail-conseiller-brsa.service'
import { FrancetravailConseillerCEJService } from './francetravail-conseiller-cej.service'
import { User } from '../../domain/user'
import { FrancetravailConseillerAvenirProService } from './francetravail-conseiller-avenirpro.service'
import { FrancetravailConseillerService } from './francetravail-conseiller.service'

@Controller()
export class FrancetravailConseillerController {
  private readonly logger: Logger

  constructor(
    private readonly francetravailConseillerCEJService: FrancetravailConseillerCEJService,
    private readonly francetravailConseillerAIJService: FrancetravailConseillerAIJService,
    private readonly francetravailConseillerBRSAService: FrancetravailConseillerBRSAService,
    private readonly francetravailConseillerAvenirProService: FrancetravailConseillerAvenirProService,
    private readonly francetravailConseillerService: FrancetravailConseillerService,
    private readonly francetravailConseillerAccompagnementIntensifService: FrancetravailConseillerAccompagnementIntensifService,
    private readonly francetravailConseillerAccompagnementGlobalService: FrancetravailConseillerAccompagnementGlobalService,
    private readonly francetravailConseillerEquipEmploiRecrutService: FrancetravailConseillerEquipEmploiRecrutService
  ) {
    this.logger = new Logger('FrancetravailConseillerController')
  }

  @Get('francetravail-conseiller/connect/:interactionId')
  @Redirect('blank', HttpStatus.TEMPORARY_REDIRECT)
  async connect(
    @Res({ passthrough: true }) response: Response,
    @Param('interactionId') interactionId: string,
    @Query() ftQueryParams: { type: string }
  ): Promise<{ url: string } | void> {
    let authorizationUrlResult
    let structure: User.Structure

    switch (ftQueryParams.type) {
      case 'avenirpro':
        structure = User.Structure.AVENIR_PRO
        authorizationUrlResult =
          this.francetravailConseillerAvenirProService.getAuthorizationUrl(
            interactionId,
            ftQueryParams.type
          )
        break
      case 'aij':
        structure = User.Structure.POLE_EMPLOI_AIJ
        authorizationUrlResult =
          this.francetravailConseillerAIJService.getAuthorizationUrl(
            interactionId,
            ftQueryParams.type
          )
        break
      case 'brsa':
        structure = User.Structure.POLE_EMPLOI_BRSA
        authorizationUrlResult =
          this.francetravailConseillerBRSAService.getAuthorizationUrl(
            interactionId,
            ftQueryParams.type
          )
        break
      // TODO variabiliser
      case 'accompagnement-intensif':
        structure = User.Structure.FT_ACCOMPAGNEMENT_INTENSIF
        authorizationUrlResult =
          this.francetravailConseillerAccompagnementIntensifService.getAuthorizationUrl(
            interactionId,
            ftQueryParams.type
          )
        break
      case 'accompagnement-global':
        structure = User.Structure.FT_ACCOMPAGNEMENT_GLOBAL
        authorizationUrlResult =
          this.francetravailConseillerAccompagnementGlobalService.getAuthorizationUrl(
            interactionId,
            ftQueryParams.type
          )
        break
      case 'equip-emploi-recrut':
        structure = User.Structure.FT_EQUIP_EMPLOI_RECRUT
        authorizationUrlResult =
          this.francetravailConseillerEquipEmploiRecrutService.getAuthorizationUrl(
            interactionId,
            ftQueryParams.type
          )
        break
      case 'cej':
        structure = User.Structure.POLE_EMPLOI_CEJ
        authorizationUrlResult =
          this.francetravailConseillerCEJService.getAuthorizationUrl(
            interactionId,
            ftQueryParams.type
          )
        break
      default:
        structure = User.Structure.FRANCE_TRAVAIL
        authorizationUrlResult =
          this.francetravailConseillerService.getAuthorizationUrl(interactionId)
    }

    if (isFailure(authorizationUrlResult))
      return redirectFailure(
        response,
        authorizationUrlResult,
        User.Type.CONSEILLER,
        structure
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
    const ftType = request.query.state
    let result
    let structure: User.Structure

    switch (ftType) {
      case 'aij':
        structure = User.Structure.POLE_EMPLOI_AIJ
        result = await this.francetravailConseillerAIJService.callback(
          request,
          response
        )
        break
      case 'avenirpro':
        structure = User.Structure.AVENIR_PRO
        result = await this.francetravailConseillerAvenirProService.callback(
          request,
          response
        )
        break
      case 'brsa':
        structure = User.Structure.POLE_EMPLOI_BRSA
        result = await this.francetravailConseillerBRSAService.callback(
          request,
          response
        )
        break
      case 'accompagnement-intensif':
        structure = User.Structure.FT_ACCOMPAGNEMENT_INTENSIF
        result =
          await this.francetravailConseillerAccompagnementIntensifService.callback(
            request,
            response
          )
        break
      case 'accompagnement-global':
        structure = User.Structure.FT_ACCOMPAGNEMENT_GLOBAL
        result =
          await this.francetravailConseillerAccompagnementGlobalService.callback(
            request,
            response
          )
        break
      case 'equip-emploi-recrut':
        structure = User.Structure.FT_EQUIP_EMPLOI_RECRUT
        result =
          await this.francetravailConseillerEquipEmploiRecrutService.callback(
            request,
            response
          )
        break

      case 'cej':
        structure = User.Structure.POLE_EMPLOI_CEJ
        result = await this.francetravailConseillerCEJService.callback(
          request,
          response
        )
        break
      default:
        structure = User.Structure.FRANCE_TRAVAIL
        result = await this.francetravailConseillerService.callback(
          request,
          response
        )
        break
    }
    if (isFailure(result))
      return redirectFailure(response, result, User.Type.CONSEILLER, structure)
  }
}

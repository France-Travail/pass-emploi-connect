import { Controller, Get, Param, Res } from '@nestjs/common'
import { Response } from 'express'
import { User } from '../../domain/user'
import { isFailure } from '../../utils/result/result'
import { redirectFailure } from '../../utils/result/result.handler'
import { InviteService } from './invite.service'

@Controller()
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  // Pas de @Redirect ici (contrairement aux autres IDP) : il n'y a pas d'URL
  // d'autorisation externe vers laquelle rediriger. Le service termine
  // l'interaction et redirige lui-même vers returnTo.
  @Get('invite/connect/:interactionId')
  async connect(
    @Res({ passthrough: true }) response: Response,
    @Param('interactionId') interactionId: string
  ): Promise<void> {
    const result = await this.inviteService.connect(interactionId, response)

    if (isFailure(result))
      return redirectFailure(
        response,
        result,
        User.Type.JEUNE,
        User.Structure.INVITE
      )
  }
}

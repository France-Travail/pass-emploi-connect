import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards
} from '@nestjs/common'
import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'
import { HealthCheckResult } from '@nestjs/terminus/dist/health-check/health-check-result.interface'
import { DeleteAccountUsecase } from './account/delete-account.usecase'
import { RevoquerTokensIdpUsecase } from './account/revoquer-tokens-idp.usecase'
import { ApiKeyAuthGuard } from './guards/api-key.auth-guard'
import { isFailure } from './utils/result/result'

export const TAILLE_MAX_LOT_REVOCATION = 1000

@Controller()
export class AppController {
  constructor(
    private health: HealthCheckService,
    private readonly deleteAccountUsecase: DeleteAccountUsecase,
    private readonly revoquerTokensIdpUsecase: RevoquerTokensIdpUsecase
  ) {}

  @Get()
  getHello(): string {
    return 'Pass Emploi Connect'
  }

  @Get('health')
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([])
  }

  @Delete('accounts/:idAuth')
  @UseGuards(ApiKeyAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@Param('idAuth') idAuth: string): Promise<void> {
    const result = await this.deleteAccountUsecase.execute({
      idAuth
    })
    if (isFailure(result)) {
      throw new RuntimeException(result.error.message)
    }
  }

  @Post('accounts/revoquer-tokens-idp')
  @UseGuards(ApiKeyAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoquerTokensIdp(@Body() body: { subs?: unknown }): Promise<void> {
    const subs = body?.subs
    if (
      !Array.isArray(subs) ||
      subs.length === 0 ||
      subs.length > TAILLE_MAX_LOT_REVOCATION ||
      !subs.every(sub => typeof sub === 'string' && sub.length > 0)
    ) {
      throw new BadRequestException(
        `subs doit être une liste de 1 à ${TAILLE_MAX_LOT_REVOCATION} chaînes non vides`
      )
    }
    const result = await this.revoquerTokensIdpUsecase.execute({ subs })
    if (isFailure(result)) {
      throw new RuntimeException(result.error.message)
    }
  }
}

import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
  InternalServerErrorException
} from '@nestjs/common'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'
import { DeleteAccountUsecase } from './account/delete-account.usecase.js'
import { ApiKeyAuthGuard } from './guards/api-key.auth-guard.js'
import { isFailure } from './utils/result/result.js'

@Controller()
export class AppController {
  constructor(
    private health: HealthCheckService,
    private readonly deleteAccountUsecase: DeleteAccountUsecase
  ) {}

  @Get()
  getHello(): string {
    return 'Pass Emploi Connect'
  }

  @Get('health')
  @HealthCheck()
  check(): Promise<unknown> {
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
      throw new InternalServerErrorException(result.error.message)
    }
  }
}

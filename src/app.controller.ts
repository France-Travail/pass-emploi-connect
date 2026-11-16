import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards
} from '@nestjs/common'
import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception'
import { SkipThrottle } from '@nestjs/throttler'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'
import { HealthCheckResult } from '@nestjs/terminus/dist/health-check/health-check-result.interface'
import { DeleteAccountUsecase } from './account/delete-account.usecase'
import { ApiKeyAuthGuard } from './guards/api-key.auth-guard'
import { isFailure } from './utils/result/result'

@Controller()
@SkipThrottle({ ip: true, 'ip-token': true })
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
}

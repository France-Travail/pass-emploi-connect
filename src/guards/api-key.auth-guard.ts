import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Request } from 'express'

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.checkApiKey(context)
  }

  private async checkApiKey(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest()
    const apiKeyRequest = req.header('X-API-KEY')
    if (!apiKeyRequest) {
      throw new UnauthorizedException(
        `API KEY non présent dans le header 'X-API-KEY'`
      )
    }

    const authorizedApiKeys = this.configService.get('authorizedApiKeys')

    if (authorizedApiKeys.includes(apiKeyRequest)) {
      return true
    }

    throw new UnauthorizedException('API KEY non valide')
  }
}

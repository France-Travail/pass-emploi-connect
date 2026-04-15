import { Injectable, Logger } from '@nestjs/common'
import * as APM from 'elastic-apm-node'
import { Account } from '../domain/account.js'
import { RedisClient } from '../redis/redis.client.js'
import { DateService } from '../utils/date.service.js'
import { getAPMInstance } from '../utils/monitoring/apm.init.js'
import { buildError } from '../utils/monitoring/logger.module.js'

export enum TokenType {
  ACCESS = 'access_token',
  REFRESH = 'refresh_token'
}
export type TokenData = {
  token: string
  expiresIn: number
  scope?: string
  expiresAt?: number
}
type SavedTokenData = {
  token: string
  expiresAt: number
  scope?: string
}

@Injectable()
export class TokenService {
  private readonly logger: Logger
  protected apmService: APM.Agent

  constructor(
    private readonly redisClient: RedisClient,
    private readonly dateService: DateService
  ) {
    this.logger = new Logger('TokenService')
    this.apmService = getAPMInstance()
  }

  async getToken(
    account: Account,
    tokenType: TokenType
  ): Promise<TokenData | undefined> {
    const data = await this.redisClient.get(
      tokenType,
      Account.fromAccountToAccountId(account)
    )
    if (data) {
      try {
        const savedTokenData: SavedTokenData = JSON.parse(data)
        if (!savedTokenData.token || !savedTokenData.expiresAt) {
          throw new Error()
        }
        return this.fromSavedTokenToTokenData(savedTokenData)
      } catch (e) {
        this.apmService.captureError(
          e instanceof Error ? e : new Error(String(e))
        )
        this.logger.error(buildError('get token invalid data format', e))
      }
    }
    return undefined
  }

  async setToken(
    account: Account,
    tokenType: TokenType,
    tokenData: TokenData
  ): Promise<void> {
    let ttl: number

    if (tokenData.expiresAt) {
      ttl = Math.floor(tokenData.expiresAt - this.dateService.now().toSeconds())
    } else {
      ttl = tokenData.expiresIn
    }

    const tokenToSave = this.fromTokenDataToTokenToSave({
      ...tokenData,
      expiresIn: ttl
    })

    await this.redisClient.setWithExpiry(
      tokenType,
      Account.fromAccountToAccountId(account),
      JSON.stringify(tokenToSave),
      ttl
    )
  }

  async setAccessTokenLock(account: Account, lockId: string): Promise<boolean> {
    const lockKey = generateAccessTokenLockKey(account)
    return this.redisClient.acquireLock(lockKey, lockId)
  }

  async releaseAccessTokenLock(
    account: Account,
    lockId: string
  ): Promise<void> {
    const lockKey = generateAccessTokenLockKey(account)
    await this.redisClient.releaseLock(lockKey, lockId)
  }

  private fromTokenDataToTokenToSave(tokenData: TokenData): SavedTokenData {
    return {
      token: tokenData.token,
      scope: tokenData.scope,
      expiresAt:
        tokenData.expiresAt ||
        Math.floor(
          this.dateService
            .now()
            .plus({ seconds: tokenData.expiresIn })
            .toSeconds()
        )
    }
  }

  private fromSavedTokenToTokenData(savedTokenData: SavedTokenData): TokenData {
    return {
      token: savedTokenData.token,
      scope: savedTokenData.scope,
      expiresIn: Math.floor(
        savedTokenData.expiresAt - this.dateService.now().toSeconds()
      )
    }
  }
}

function generateAccessTokenLockKey(account: Account): string {
  return `access_token_lock:${Account.fromAccountToAccountId(account)}`
}

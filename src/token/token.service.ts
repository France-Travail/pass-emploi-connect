import { Injectable } from '@nestjs/common'
import * as APM from 'elastic-apm-node'
import { Account } from '../domain/account'
import { User } from '../domain/user'
import { RedisClient } from '../redis/redis.client'
import { DateService } from '../utils/date.service'
import { getAPMInstance } from '../utils/monitoring/apm.init'
import { rootLogger, toEcsError } from '../utils/monitoring/logger.module'

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

const TOUS_LES_TYPES_UTILISATEUR = Object.values(User.Type)
const TOUTES_LES_STRUCTURES = Object.values(User.Structure)
const TOUS_LES_TYPES_DE_TOKEN = Object.values(TokenType)

@Injectable()
export class TokenService {
  protected apmService: APM.Agent

  constructor(
    private readonly redisClient: RedisClient,
    private readonly dateService: DateService
  ) {
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
        rootLogger.error(
          { context: 'TokenService', error: toEcsError(e) },
          'token_invalid_format'
        )
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

  // Seul le sub est connu de l'appelant : on supprime les clés de tous les
  // accountId possibles plutôt que de chercher les clés existantes (KEYS).
  async supprimerTokensIdp(subs: string[]): Promise<void> {
    // Chaque sub peut exister sous n'importe quel couple type × structure
    const comptesPossibles = subs.flatMap(tousLesComptesPossibles)

    // Chaque compte a ses tokens IdP (access, refresh) et son verrou
    const clesASupprimer = comptesPossibles.flatMap(clesTokensIdp)

    // Un seul DEL pour tout le lot : Redis ignore les clés absentes
    await this.redisClient.deleteMany(clesASupprimer)
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

function tousLesComptesPossibles(sub: string): Account[] {
  return TOUS_LES_TYPES_UTILISATEUR.flatMap(type =>
    TOUTES_LES_STRUCTURES.map(structure => ({ sub, type, structure }))
  )
}

function clesTokensIdp(account: Account): string[] {
  const accountId = Account.fromAccountToAccountId(account)
  const clesTokens = TOUS_LES_TYPES_DE_TOKEN.map(
    typeDeToken => `${typeDeToken}:${accountId}`
  )
  return [...clesTokens, generateAccessTokenLockKey(account)]
}

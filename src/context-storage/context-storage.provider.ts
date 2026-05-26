import { Injectable } from '@nestjs/common'
import { User } from '../domain/user'
import { RedisClient } from '../redis/redis.client'

const PREFIX = 'ContextStorage'
export type ContextData = Map<string, unknown>

export enum ContextKeyType {
  ISSUER = 'ISSUER',
  CLIENT = 'CLIENT'
}
export interface ContextKey {
  userType: User.Type
  userStructure: User.Structure
  key: ContextKeyType
}

@Injectable()
export class ContextStorage {
  constructor(private readonly redisClient: RedisClient) {}

  async get(key: ContextKey): Promise<string | null> {
    return this.redisClient.get(PREFIX, fromKeyObjectToString(key))
  }

  async set(key: ContextKey, value: string): Promise<void> {
    await this.redisClient.set(PREFIX, fromKeyObjectToString(key), value)
  }
}

function fromKeyObjectToString(key: ContextKey): string {
  return Object.values(key).join('-')
}

import { Module } from '@nestjs/common'

import { ContextStorage } from './context-storage.provider.js'
import { RedisProvider } from '../redis/redis.provider.js'
import { RedisClient } from '../redis/redis.client.js'
import { ConfigModule } from '@nestjs/config'

@Module({
  imports: [ConfigModule],
  providers: [ContextStorage, RedisProvider, RedisClient],
  exports: [ContextStorage]
})
export class ContextStorageModule {}

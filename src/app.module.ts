import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { TerminusModule } from '@nestjs/terminus'
import { AccountModule } from './account/account.module'
import { AppController } from './app.controller'
import configuration from './config/configuration'
import { ConseilDepartementalConseillerModule } from './idp/conseildepartemental-conseiller/conseildepartemental-conseiller.module'
import { InviteModule } from './idp/invite/invite.module'
import { FrancetravailConseillerModule } from './idp/francetravail-conseiller/francetravail-conseiller.module'
import { FrancetravailJeuneModule } from './idp/francetravail-jeune/francetravail-jeune.module'
import { MiloConseillerModule } from './idp/milo-conseiller/milo-conseiller.module'
import { MiloJeuneModule } from './idp/milo-jeune/milo-jeune.module'
import { RateLimitGuard } from './rate-limit/rate-limit.guard'
import { RateLimitModule } from './rate-limit/rate-limit.module'
import { configureLoggerModule } from './utils/monitoring/logger.module'
import { RequestContextModule } from './utils/monitoring/request-context.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.environment',
      cache: true,
      load: [configuration]
    }),
    TerminusModule,
    configureLoggerModule(),
    RequestContextModule,
    FrancetravailJeuneModule,
    FrancetravailConseillerModule,
    MiloConseillerModule,
    MiloJeuneModule,
    ConseilDepartementalConseillerModule,
    InviteModule,
    AccountModule,
    RateLimitModule
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: RateLimitGuard }]
})
export class AppModule {}

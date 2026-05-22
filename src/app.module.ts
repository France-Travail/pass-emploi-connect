import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TerminusModule } from '@nestjs/terminus'
import { AccountModule } from './account/account.module'
import { AppController } from './app.controller'
import configuration from './config/configuration'
import { ConseilDepartementalConseillerModule } from './idp/conseildepartemental-conseiller/conseildepartemental-conseiller.module'
import { FrancetravailConseillerModule } from './idp/francetravail-conseiller/francetravail-conseiller.module'
import { FrancetravailJeuneModule } from './idp/francetravail-jeune/francetravail-jeune.module'
import { MiloConseillerModule } from './idp/milo-conseiller/milo-conseiller.module'
import { MiloJeuneModule } from './idp/milo-jeune/milo-jeune.module'
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
    AccountModule
  ],
  controllers: [AppController]
})
export class AppModule {}

import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TerminusModule } from '@nestjs/terminus'
import { AccountModule } from './account/account.module.js'
import { AppController } from './app.controller.js'
import configuration from './config/configuration.js'
import { ConseilDepartementalConseillerModule } from './idp/conseildepartemental-conseiller/conseildepartemental-conseiller.module.js'
import { FrancetravailConseillerModule } from './idp/francetravail-conseiller/francetravail-conseiller.module.js'
import { FrancetravailJeuneModule } from './idp/francetravail-jeune/francetravail-jeune.module.js'
import { MiloConseillerModule } from './idp/milo-conseiller/milo-conseiller.module.js'
import { MiloJeuneModule } from './idp/milo-jeune/milo-jeune.module.js'
import { configureLoggerModule } from './utils/monitoring/logger.module.js'

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.environment',
      cache: true,
      load: [configuration]
    }),
    TerminusModule,
    configureLoggerModule(),
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

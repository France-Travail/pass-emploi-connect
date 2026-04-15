/* eslint-disable no-process-env */
import { HttpModule } from '@nestjs/axios'
import type { INestApplication, Provider } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TerminusModule } from '@nestjs/terminus'
import { Test, TestingModuleBuilder } from '@nestjs/testing'
import * as dotenv from 'dotenv'
import { createSandbox, SinonSandbox } from 'sinon'
import { FrancetravailConseillerAccompagnementGlobalService } from '../../src/idp/francetravail-conseiller/francetravail-conseiller-accompagnement-global.service.js'
import { FrancetravailConseillerAccompagnementIntensifService } from '../../src/idp/francetravail-conseiller/francetravail-conseiller-accompagnement-intensif.service.js'
import { FrancetravailConseillerEquipEmploiRecrutService } from '../../src/idp/francetravail-conseiller/francetravail-conseiller-equip-emploi-recrut.service.js'
import { DeleteAccountUsecase } from '../../src/account/delete-account.usecase.js'
import { PassEmploiAPIClient } from '../../src/api/pass-emploi-api.client.js'
import { AppController } from '../../src/app.controller.js'
import { Configuration } from '../../src/config/configuration.js'
import { ConseilDepartementalConseillerController } from '../../src/idp/conseildepartemental-conseiller/conseildepartemental-conseiller.controller.js'
import { ConseilDepartementalConseillerService } from '../../src/idp/conseildepartemental-conseiller/conseildepartemental-conseiller.service.js'
import { FrancetravailConseillerAIJService } from '../../src/idp/francetravail-conseiller/francetravail-conseiller-aij.service.js'
import { FrancetravailConseillerAvenirProService } from '../../src/idp/francetravail-conseiller/francetravail-conseiller-avenirpro.service.js'
import { FrancetravailConseillerBRSAService } from '../../src/idp/francetravail-conseiller/francetravail-conseiller-brsa.service.js'
import { FrancetravailConseillerCEJService } from '../../src/idp/francetravail-conseiller/francetravail-conseiller-cej.service.js'
import { FrancetravailConseillerController } from '../../src/idp/francetravail-conseiller/francetravail-conseiller.controller.js'
import { FrancetravailConseillerService } from '../../src/idp/francetravail-conseiller/francetravail-conseiller.service.js'
import { FrancetravailAIJService } from '../../src/idp/francetravail-jeune/francetravail-aij.service.js'
import { FrancetravailBeneficiaireService } from '../../src/idp/francetravail-jeune/francetravail-beneficiaire.service.js'
import { FrancetravailBRSAService } from '../../src/idp/francetravail-jeune/francetravail-brsa.service.js'
import { FrancetravailJeuneController } from '../../src/idp/francetravail-jeune/francetravail-jeune.controller.js'
import { FrancetravailJeuneCEJService } from '../../src/idp/francetravail-jeune/francetravail-jeune.service.js'
import { MiloConseillerController } from '../../src/idp/milo-conseiller/milo-conseiller.controller.js'
import { MiloConseillerService } from '../../src/idp/milo-conseiller/milo-conseiller.service.js'
import { MiloJeuneController } from '../../src/idp/milo-jeune/milo-jeune.controller.js'
import { MiloJeuneService } from '../../src/idp/milo-jeune/milo-jeune.service.js'
import { stubClassSandbox } from './types.js'

dotenv.config({ path: '.environment' })

const IDP_FT_CONSEILLER_ACCESS_TOKEN_MAX_AGE = 1170
const IDP_FT_CONSEILLER_REFRESH_TOKEN_MAX_AGE = 3600 * 24 * 42
const IDP_FT_JEUNE_ACCESS_TOKEN_MAX_AGE = 1170
const IDP_FT_JEUNE_REFRESH_TOKEN_MAX_AGE = 3600 * 24 * 42
const IDP_MILO_CONSEILLER_ACCESS_TOKEN_MAX_AGE = 299
const IDP_MILO_CONSEILLER_REFRESH_TOKEN_MAX_AGE = 3600 * 24 * 30
const IDP_MILO_JEUNE_ACCESS_TOKEN_MAX_AGE = 299
const IDP_MILO_JEUNE_REFRESH_TOKEN_MAX_AGE = 3600 * 24 * 30

export function buildTestingModuleForHttpTesting(
  sandbox: SinonSandbox = createSandbox()
): TestingModuleBuilder {
  return Test.createTestingModule({
    imports: [HttpModule, ConfigModule.forRoot(), TerminusModule],
    providers: stubProviders(sandbox),
    controllers: [
      AppController,
      FrancetravailConseillerController,
      FrancetravailJeuneController,
      MiloJeuneController,
      MiloConseillerController,
      ConseilDepartementalConseillerController
    ]
  })
}

let applicationForHttpTesting: INestApplication
let sandbox: SinonSandbox

export const getApplicationWithStubbedDependencies =
  async (): Promise<INestApplication> => {
    if (!applicationForHttpTesting) {
      sandbox = createSandbox()
      const testingModule = await buildTestingModuleForHttpTesting(
        sandbox
      ).compile()

      applicationForHttpTesting = testingModule.createNestApplication()
      await applicationForHttpTesting.init()
    }

    afterEach(() => {
      sandbox.reset()
    })
    return applicationForHttpTesting
  }

export const testConfig = (): ConfigService => {
  const config: Configuration = {
    environment: 'staging',
    port: 5050,
    publicAddress: `http://localhost:5050`,
    cors: {
      allowedOrigins: []
    },
    apis: {
      passemploi: {
        url: 'https://api.pass-emploi.fr',
        key: 'pass-emploi-api-key'
      },
      francetravail: {
        url: 'https://pe.qvr'
      }
    },
    authorizedApiKeys: ['pass-emploi-back'],
    redis: {
      url: 'redis://localhost:6767'
    },
    clients: {
      web: {
        id: 'web',
        secret: 'web-secret',
        callbacks: [],
        errorCallback: 'https://autherror.com',
        logoutCallbacks: []
      },
      app: {
        id: 'app',
        secret: 'app-secret',
        callbacks: []
      },
      api: {
        id: 'api',
        secret: 'api-secret'
      },
      swagger: {
        id: 'swag',
        secret: 'swag-secret',
        callbacks: []
      }
    },
    ressourceServer: {
      url: 'rsrc',
      scopes: ''
    },
    jwks: JSON.parse(process.env.JWKS!),
    idps: {
      francetravailBeneficiaire: {
        issuer: 'ft-jeune.com',
        realm: 'individu',
        authorizationUrl: 'https://ft-jeune.com/authorize',
        tokenUrl: 'ft-jeune.com/token',
        jwks: 'ft-jeune.com/jwks',
        userinfo: 'ft-jeune.com/userinfo',
        clientId: 'ft-jeune',
        clientSecret: 'ft-jeune-secret',
        scopes: '',
        redirectUri: '',
        logout: '',
        accessTokenMaxAge: IDP_FT_JEUNE_ACCESS_TOKEN_MAX_AGE,
        refreshTokenMaxAge: IDP_FT_JEUNE_REFRESH_TOKEN_MAX_AGE
      },
      francetravailConseiller: {
        issuer: 'ft-conseiller.com',
        realm: 'agent',
        authorizationUrl: 'https://ft-conseiller.com/authorize',
        tokenUrl: 'ft-conseiller.com/token',
        jwks: 'ft-conseiller.com/jwks',
        userinfo: 'ft-conseiller.com/userinfo',
        clientId: 'ft-conseiller',
        clientSecret: 'ft-conseiller-secret',
        scopes: '',
        redirectUri: '',
        logout: '',
        accessTokenMaxAge: IDP_FT_CONSEILLER_ACCESS_TOKEN_MAX_AGE,
        refreshTokenMaxAge: IDP_FT_CONSEILLER_REFRESH_TOKEN_MAX_AGE
      },
      miloConseiller: {
        issuer: process.env.IDP_MILO_CONSEILLER_ISSUER!,
        authorizationUrl: process.env.IDP_MILO_CONSEILLER_AUTHORIZATION_URL!,
        tokenUrl: process.env.IDP_MILO_CONSEILLER_TOKEN_URL!,
        jwks: process.env.IDP_MILO_CONSEILLER_JWKS!,
        userinfo: process.env.IDP_MILO_CONSEILLER_USERINFO!,
        clientId: process.env.IDP_MILO_CONSEILLER_CLIENT_ID!,
        clientSecret: process.env.IDP_MILO_CONSEILLER_CLIENT_SECRET!,
        scopes: process.env.IDP_MILO_CONSEILLER_SCOPES!,
        redirectUri: process.env.IDP_MILO_CONSEILLER_REDIRECT_URI!,
        logout: '',
        accessTokenMaxAge: IDP_MILO_CONSEILLER_ACCESS_TOKEN_MAX_AGE,
        refreshTokenMaxAge: IDP_MILO_CONSEILLER_REFRESH_TOKEN_MAX_AGE
      },
      miloJeune: {
        issuer: 'milo-jeune.com',
        authorizationUrl: 'https://milo-jeune.com/authorize',
        tokenUrl: 'milo-jeune.com/token',
        jwks: 'milo-jeune.com/jwks',
        userinfo: 'milo-jeune.com/userinfo',
        clientId: 'milo-jeune',
        clientSecret: 'milo-jeune-secret',
        scopes: '',
        redirectUri: '',
        logout: '',
        accessTokenMaxAge: IDP_MILO_JEUNE_ACCESS_TOKEN_MAX_AGE,
        refreshTokenMaxAge: IDP_MILO_JEUNE_REFRESH_TOKEN_MAX_AGE
      },
      conseillerDept: {
        issuer: 'https://keycloak-cej.com',
        authorizationUrl: 'https://keycloak-cej.com/authorize',
        tokenUrl: 'keycloak-cej',
        jwks: 'keycloak-cej',
        userinfo: 'keycloak-cej',
        clientId: 'keycloak-cej',
        clientSecret: 'keycloak-cej',
        scopes: 'keycloak-cej',
        redirectUri: 'keycloak-cej',
        logout: '',
        accessTokenMaxAge: IDP_MILO_CONSEILLER_ACCESS_TOKEN_MAX_AGE,
        refreshTokenMaxAge: IDP_MILO_CONSEILLER_REFRESH_TOKEN_MAX_AGE
      }
    },
    test: {
      miloConseillerOfflineToken:
        process.env.TEST_MILO_CONSEILLER_OFFLINE_TOKEN,
      miloConseillerCEJJWT: process.env.TEST_MILO_CONSEILLER_CEJ_JWT,
      miloConseillerCEJJWTExpired:
        process.env.TEST_MILO_CONSEILLER_CEJ_JWT_EXPIRED
    }
  }
  return new ConfigService(config)
}

const stubProviders = (sandbox: SinonSandbox): Provider[] => {
  return [
    {
      provide: ConfigService,
      useValue: testConfig()
    },
    {
      provide: PassEmploiAPIClient,
      useValue: stubClassSandbox(PassEmploiAPIClient, sandbox)
    },
    {
      provide: PassEmploiAPIClient,
      useValue: stubClassSandbox(PassEmploiAPIClient, sandbox)
    },
    {
      provide: FrancetravailConseillerService,
      useValue: stubClassSandbox(FrancetravailConseillerService, sandbox)
    },
    {
      provide: FrancetravailConseillerCEJService,
      useValue: stubClassSandbox(FrancetravailConseillerCEJService, sandbox)
    },
    {
      provide: FrancetravailConseillerAIJService,
      useValue: stubClassSandbox(FrancetravailConseillerAIJService, sandbox)
    },
    {
      provide: FrancetravailConseillerBRSAService,
      useValue: stubClassSandbox(FrancetravailConseillerBRSAService, sandbox)
    },
    {
      provide: FrancetravailJeuneCEJService,
      useValue: stubClassSandbox(FrancetravailJeuneCEJService, sandbox)
    },
    {
      provide: FrancetravailBeneficiaireService,
      useValue: stubClassSandbox(FrancetravailBeneficiaireService, sandbox)
    },
    {
      provide: FrancetravailAIJService,
      useValue: stubClassSandbox(FrancetravailAIJService, sandbox)
    },
    {
      provide: FrancetravailBRSAService,
      useValue: stubClassSandbox(FrancetravailBRSAService, sandbox)
    },
    {
      provide: FrancetravailConseillerAccompagnementIntensifService,
      useValue: stubClassSandbox(
        FrancetravailConseillerAccompagnementIntensifService,
        sandbox
      )
    },
    {
      provide: FrancetravailConseillerAccompagnementGlobalService,
      useValue: stubClassSandbox(
        FrancetravailConseillerAccompagnementGlobalService,
        sandbox
      )
    },
    {
      provide: FrancetravailConseillerEquipEmploiRecrutService,
      useValue: stubClassSandbox(
        FrancetravailConseillerEquipEmploiRecrutService,
        sandbox
      )
    },
    {
      provide: MiloConseillerService,
      useValue: stubClassSandbox(MiloConseillerService, sandbox)
    },
    {
      provide: MiloJeuneService,
      useValue: stubClassSandbox(MiloJeuneService, sandbox)
    },
    {
      provide: ConseilDepartementalConseillerService,
      useValue: stubClassSandbox(ConseilDepartementalConseillerService, sandbox)
    },
    {
      provide: FrancetravailConseillerAvenirProService,
      useValue: stubClassSandbox(
        FrancetravailConseillerAvenirProService,
        sandbox
      )
    },
    {
      provide: DeleteAccountUsecase,
      useValue: stubClassSandbox(DeleteAccountUsecase, sandbox)
    }
  ]
}

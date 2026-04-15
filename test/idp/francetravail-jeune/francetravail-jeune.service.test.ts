import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { Request, Response } from 'express'
import { FrancetravailAPIClient } from '../../../src/api/francetravail-api.client.js'
import { PassEmploiAPIClient } from '../../../src/api/pass-emploi-api.client.js'
import { FrancetravailJeuneCEJService } from '../../../src/idp/francetravail-jeune/francetravail-jeune.service.js'
import { OidcService } from '../../../src/oidc-provider/oidc.service.js'
import { TokenService } from '../../../src/token/token.service.js'
import { AuthError } from '../../../src/utils/result/error.js'
import { failure, success } from '../../../src/utils/result/result.js'
import {
  createSandbox,
  expect,
  StubbedClass,
  stubClass
} from '../../test-utils.js'
import { testConfig } from '../../test-utils/module-for-testing.js'

describe('FrancetravailJeuneCEJService', () => {
  let francetravailJeuneCEJService: FrancetravailJeuneCEJService
  const configService = testConfig()
  let tokenService: StubbedClass<TokenService>
  let passEmploiAPIClient: StubbedClass<PassEmploiAPIClient>
  let francetravailAPIClient: StubbedClass<FrancetravailAPIClient>
  let oidcService: StubbedClass<OidcService>

  beforeEach(() => {
    oidcService = stubClass(OidcService)
    tokenService = stubClass(TokenService)
    passEmploiAPIClient = stubClass(PassEmploiAPIClient)
    francetravailAPIClient = stubClass(FrancetravailAPIClient)
    francetravailJeuneCEJService = new FrancetravailJeuneCEJService(
      configService,
      oidcService,
      tokenService,
      passEmploiAPIClient,
      francetravailAPIClient
    )
  })

  describe('getAuthorizationUrl', () => {
    it('renvoie success', () => {
      expect(
        francetravailJeuneCEJService.getAuthorizationUrl('test')
      ).to.deep.equal(
        success(
          'https://ft-jeune.com/authorize?client_id=ft-jeune&scope=&response_type=code&redirect_uri=&nonce=test&realm=individu'
        )
      )
    })
  })

  describe('callback', () => {
    it('renvoie erreur', async () => {
      // Given
      const sandbox = createSandbox()
      const request: StubbedType<Request> = stubInterface(sandbox)
      const response: StubbedType<Response> = stubInterface(sandbox)

      // When
      const result = await francetravailJeuneCEJService.callback(
        request,
        response
      )

      // Then
      expect(result).to.deep.equal(failure(new AuthError('CallbackParams')))
    })
  })
})

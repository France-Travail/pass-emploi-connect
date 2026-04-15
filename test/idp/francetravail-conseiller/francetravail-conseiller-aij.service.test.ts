import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { Request, Response } from 'express'
import { PassEmploiAPIClient } from '../../../src/api/pass-emploi-api.client.js'
import { FrancetravailConseillerAIJService } from '../../../src/idp/francetravail-conseiller/francetravail-conseiller-aij.service.js'
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

describe('FrancetravailConseillerAIJService', () => {
  let francetravailConseillerAIJService: FrancetravailConseillerAIJService
  const configService = testConfig()
  let tokenService: StubbedClass<TokenService>
  let passEmploiAPIClient: StubbedClass<PassEmploiAPIClient>
  let oidcService: StubbedClass<OidcService>

  beforeEach(() => {
    oidcService = stubClass(OidcService)
    tokenService = stubClass(TokenService)
    passEmploiAPIClient = stubClass(PassEmploiAPIClient)
    francetravailConseillerAIJService = new FrancetravailConseillerAIJService(
      configService,
      oidcService,
      tokenService,
      passEmploiAPIClient
    )
  })

  describe('getAuthorizationUrl', () => {
    it('renvoie success', () => {
      expect(
        francetravailConseillerAIJService.getAuthorizationUrl('test')
      ).to.deep.equal(
        success(
          'https://ft-conseiller.com/authorize?client_id=ft-conseiller&scope=&response_type=code&redirect_uri=&nonce=test&realm=agent'
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
      const result = await francetravailConseillerAIJService.callback(
        request,
        response
      )

      // Then
      expect(result).to.deep.equal(failure(new AuthError('CallbackParams')))
    })
  })
})

import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { Request, Response } from 'express'
import { FrancetravailAPIClient } from '../../../src/api/francetravail-api.client'
import { PassEmploiAPIClient } from '../../../src/api/pass-emploi-api.client'
import { FrancetravailJeuneCEJService } from '../../../src/idp/francetravail-jeune/francetravail-jeune.service'
import { OidcService } from '../../../src/oidc-provider/oidc.service'
import { TokenService } from '../../../src/token/token.service'
import { AuthError } from '../../../src/utils/result/error'
import { failure, success } from '../../../src/utils/result/result'
import { createSandbox, StubbedClass, stubClass } from '../../test-utils'
import { testConfig } from '../../test-utils/module-for-testing'

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
      expect(francetravailJeuneCEJService.getAuthorizationUrl('test')).toEqual(
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
      expect(result).toEqual(failure(new AuthError('CallbackParams')))
    })
  })
})

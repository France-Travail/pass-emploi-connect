import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { Request, Response } from 'express'
import { PassEmploiAPIClient } from 'src/api/pass-emploi-api.client'
import { ConseilDepartementalConseillerService } from 'src/idp/conseildepartemental-conseiller/conseildepartemental-conseiller.service'
import { OidcService } from 'src/oidc-provider/oidc.service'
import { TokenService } from 'src/token/token.service'
import { AuthError } from 'src/utils/result/error'
import { failure, success } from 'src/utils/result/result'
import { createSandbox, StubbedClass, stubClass } from 'test/test-utils'
import { testConfig } from 'test/test-utils/module-for-testing'

describe('ConseilDepartementalConseillerService', () => {
  let conseillerDepartementalConseillerService: ConseilDepartementalConseillerService
  const configService = testConfig()
  let tokenService: StubbedClass<TokenService>
  let passEmploiAPIClient: StubbedClass<PassEmploiAPIClient>
  let oidcService: StubbedClass<OidcService>

  beforeEach(() => {
    oidcService = stubClass(OidcService)
    tokenService = stubClass(TokenService)
    passEmploiAPIClient = stubClass(PassEmploiAPIClient)
    conseillerDepartementalConseillerService =
      new ConseilDepartementalConseillerService(
        configService,
        oidcService,
        tokenService,
        passEmploiAPIClient
      )
  })

  describe('getAuthorizationUrl', () => {
    it('renvoie success', () => {
      expect(
        conseillerDepartementalConseillerService.getAuthorizationUrl('test')
      ).toEqual(
        success(
          'https://keycloak-cej.com/authorize?client_id=keycloak-cej&scope=keycloak-cej&response_type=code&redirect_uri=keycloak-cej&nonce=test'
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
      const result = await conseillerDepartementalConseillerService.callback(
        request,
        response
      )

      // Then
      expect(result).toEqual(failure(new AuthError('CallbackParams')))
    })
  })
})

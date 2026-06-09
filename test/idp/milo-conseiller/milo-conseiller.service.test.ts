import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { Request, Response } from 'express'
import { PassEmploiAPIClient } from '../../../src/api/pass-emploi-api.client'
import { MiloConseillerService } from '../../../src/idp/milo-conseiller/milo-conseiller.service'
import { OidcService } from '../../../src/oidc-provider/oidc.service'
import { TokenService } from '../../../src/token/token.service'
import { AuthError } from '../../../src/utils/result/error'
import { failure, success } from '../../../src/utils/result/result'
import { createSandbox, StubbedClass, stubClass } from '../../test-utils'
import { testConfig } from '../../test-utils/module-for-testing'

describe('MiloConseillerService', () => {
  let miloConseillerService: MiloConseillerService
  const configService = testConfig()
  let tokenService: StubbedClass<TokenService>
  let passEmploiAPIClient: StubbedClass<PassEmploiAPIClient>
  let oidcService: StubbedClass<OidcService>

  beforeEach(() => {
    oidcService = stubClass(OidcService)
    tokenService = stubClass(TokenService)
    passEmploiAPIClient = stubClass(PassEmploiAPIClient)
    miloConseillerService = new MiloConseillerService(
      configService,
      oidcService,
      tokenService,
      passEmploiAPIClient
    )
  })

  describe('getAuthorizationUrl', () => {
    it('renvoie success', () => {
      expect(miloConseillerService.getAuthorizationUrl('test')).toEqual(
        success(
          'https://sso-qlf.i-milo.fr/auth/realms/imilo-qualif/protocol/openid-connect/auth?client_id=sue-portail-conseiller&scope=openid%20email%20profile%20offline_access&response_type=code&redirect_uri=https%3A%2F%2Fid.pass-emploi.incubateur.net%2Fauth%2Frealms%2Fpass-emploi%2Fbroker%2Fsimilo-conseiller%2Fendpoint&nonce=test'
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
      const result = await miloConseillerService.callback(request, response)

      // Then
      expect(result).toEqual(failure(new AuthError('CallbackParams')))
    })
  })
})

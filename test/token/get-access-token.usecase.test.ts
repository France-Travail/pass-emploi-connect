import { expect } from 'chai'
import { GetAccessTokenUsecase } from '../../src/token/get-access-token.usecase.js'
import { TokenService, TokenType } from '../../src/token/token.service.js'
import { AuthError, NonTrouveError } from '../../src/utils/result/error.js'
import { failure, success } from '../../src/utils/result/result.js'
import { StubbedClass, stubClass } from '../test-utils.js'
import { unAccount } from '../test-utils/fixtures.js'
import { testConfig } from '../test-utils/module-for-testing.js'

describe('GetAccessTokenUsecase', () => {
  let getAccessTokenUsecase: GetAccessTokenUsecase
  const configService = testConfig()
  let tokenService: StubbedClass<TokenService>

  const offlineToken = configService.get('test.miloConseillerOfflineToken')

  beforeEach(() => {
    tokenService = stubClass(TokenService)
    getAccessTokenUsecase = new GetAccessTokenUsecase(
      configService,
      tokenService
    )
  })
  describe('execute', () => {
    it('retourne le token quand tout est ok et que le token est frais', async () => {
      // Given
      const query = {
        account: unAccount()
      }
      tokenService.getToken.withArgs(query.account, TokenType.ACCESS).resolves({
        token: 'string',
        expiresIn: 100,
        scope: ''
      })

      // When
      const result = await getAccessTokenUsecase.execute(query)

      // Then
      expect(result).to.deep.equal(
        success({
          token: 'string',
          expiresIn: 100,
          scope: ''
        })
      )
    })
    xit('refresh et retourne le token quand tout est ok et que le token est expiré', async () => {
      // Given
      const query = {
        account: unAccount()
      }
      tokenService.getToken
        .withArgs(query.account, TokenType.ACCESS)
        .resolves(undefined)
      tokenService.getToken
        .withArgs(query.account, TokenType.REFRESH)
        .resolves({
          token: offlineToken,
          expiresIn: 100,
          scope: ''
        })
      tokenService.setToken.resolves()

      // When
      const result = await getAccessTokenUsecase.execute(query)

      // Then
      expect(result._isSuccess).to.equal(true)
      if (result._isSuccess) {
        expect(result.data.expiresIn).to.be.oneOf([298, 299, 300])
        expect(result.data.scope).to.equal(
          'openid profile offline_access email'
        )
      }
      expect(tokenService.setToken).to.have.been.calledTwice()
    })
    it('erreur quand refresh token inexistant avec lock', async () => {
      // Given
      const query = {
        account: unAccount()
      }
      tokenService.setAccessTokenLock.resolves(true)

      // When
      const result = await getAccessTokenUsecase.execute(query)

      // Then
      expect(result).to.deep.equal(failure(new NonTrouveError('Refresh token')))
    })
    it('retourne le token avec un refresh qui se fait par un autre thread', async () => {
      // Given
      const query = {
        account: unAccount()
      }
      tokenService.setAccessTokenLock.resolves(false)
      tokenService.getToken
        .withArgs(query.account, TokenType.ACCESS)
        .onFirstCall()
        .resolves(undefined)
      tokenService.getToken
        .withArgs(query.account, TokenType.ACCESS)
        .onSecondCall()
        .resolves({
          token: 'string',
          expiresIn: 100,
          scope: ''
        })

      // When
      const result = await getAccessTokenUsecase.execute(query)

      // Then
      expect(result).to.deep.equal(
        success({
          token: 'string',
          expiresIn: 100,
          scope: ''
        })
      )
    })
    it('erreur quand getToken echoue', async () => {
      // Given
      const query = {
        account: unAccount()
      }
      tokenService.getToken.throws()

      // When
      const result = await getAccessTokenUsecase.execute(query)

      // Then
      expect(result).to.deep.equal(failure(new NonTrouveError('AcessToken')))
    })
    it('erreur quand mauvais refresh token avec lock', async () => {
      // Given
      const query = {
        account: unAccount()
      }
      tokenService.setAccessTokenLock.resolves(true)
      tokenService.getToken
        .withArgs(query.account, TokenType.REFRESH)
        .resolves({
          token: 'mauvais-token',
          expiresIn: 100,
          scope: 'openid profile offline_access email'
        })

      // When
      const result = await getAccessTokenUsecase.execute(query)

      // Then
      expect(result).to.deep.equal(
        failure(new AuthError(`ERROR_REFRESH_TOKEN_IDP_CONSEILLER_MILO`))
      )
    })
  })
})

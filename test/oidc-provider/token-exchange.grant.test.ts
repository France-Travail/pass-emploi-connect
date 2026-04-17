import sinon from 'sinon'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { KoaContextWithOIDC } from 'oidc-provider'
import { OidcProviderModule } from '../../src/oidc-provider/provider'
import { TokenExchangeGrant } from '../../src/oidc-provider/token-exchange.grant'
import { failure, success } from '../../src/utils/result/result'
import { GetAccessTokenUsecase } from '../../src/token/get-access-token.usecase'
import { ValidateJWTUsecase } from '../../src/token/verify-jwt.usecase'
import { StubbedClass, createSandbox, stubClass } from '../test-utils'
import { unAccount, unTokenData } from '../test-utils/fixtures'
import { JWTError, NonTrouveError } from '../../src/utils/result/error'
import { User } from '../../src/domain/user'

describe('TokenExchangeGrant', () => {
  let tokenExchangeGrant: TokenExchangeGrant
  let opm: StubbedType<OidcProviderModule>
  let validateJWTUsecase: StubbedClass<ValidateJWTUsecase>
  let getAccessTokenUsecase: StubbedClass<GetAccessTokenUsecase>

  beforeEach(() => {
    const sandbox = createSandbox()
    opm = stubInterface(sandbox)
    validateJWTUsecase = stubClass(ValidateJWTUsecase)
    getAccessTokenUsecase = stubClass(GetAccessTokenUsecase)
    tokenExchangeGrant = new TokenExchangeGrant(
      opm,
      validateJWTUsecase,
      getAccessTokenUsecase
    )
  })

  describe('handler', () => {
    it('exchange le token quand tout est ok', async () => {
      // Given
      const context = {
        oidc: { params: { subject_token: 'tok' } },
        body: {}
      }
      validateJWTUsecase.execute.resolves(
        success({
          sub: 'CONSEILLER|MILO|id-auth',
          userType: 'CONSEILLER',
          userStructure: 'MILO'
        })
      )
      const tokenData = unTokenData()
      getAccessTokenUsecase.execute.resolves(success(tokenData))

      // When
      await tokenExchangeGrant.handler(context as unknown as KoaContextWithOIDC)

      // Then
      sinon.assert.calledOnceWithExactly(validateJWTUsecase.execute, {
        token: 'tok'
      })
      sinon.assert.calledOnceWithExactly(getAccessTokenUsecase.execute, {
        account: unAccount({ sub: 'id-auth' })
      })
      expect(context.body).toEqual({
        issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        access_token: tokenData.token,
        token_type: 'bearer',
        expires_in: tokenData.expiresIn,
        scope: tokenData.scope
      })
    })

    it('exchange le token pour un sub beneficiaire different', async () => {
      // Given
      const context = {
        oidc: {
          params: { subject_token: 'tok', requested_token_sub: 'sub_jeune' }
        },
        body: {}
      }
      validateJWTUsecase.execute.resolves(
        success({
          sub: 'CONSEILLER|MILO|id-auth',
          userType: 'CONSEILLER',
          userStructure: 'MILO'
        })
      )
      const tokenData = unTokenData()
      getAccessTokenUsecase.execute.resolves(success(tokenData))

      // When
      await tokenExchangeGrant.handler(context as unknown as KoaContextWithOIDC)

      // Then
      sinon.assert.calledOnceWithExactly(validateJWTUsecase.execute, {
        token: 'tok'
      })
      sinon.assert.calledOnceWithExactly(getAccessTokenUsecase.execute, {
        account: unAccount({ sub: 'sub_jeune', type: User.Type.JEUNE })
      })
      expect(context.body).toEqual({
        issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        access_token: tokenData.token,
        token_type: 'bearer',
        expires_in: tokenData.expiresIn,
        scope: tokenData.scope
      })
    })

    it('exchange le token pour un sub conseiller different', async () => {
      // Given
      const context = {
        oidc: {
          params: {
            subject_token: 'tok',
            requested_token_sub: 'sub_conseiller'
          }
        },
        body: {}
      }
      validateJWTUsecase.execute.resolves(
        success({
          sub: 'CONSEILLER|MILO|id-auth',
          userType: 'BENEFICIAIRE',
          userStructure: 'MILO'
        })
      )
      const tokenData = unTokenData()
      getAccessTokenUsecase.execute.resolves(success(tokenData))

      // When
      await tokenExchangeGrant.handler(context as unknown as KoaContextWithOIDC)

      // Then
      sinon.assert.calledOnceWithExactly(validateJWTUsecase.execute, {
        token: 'tok'
      })
      sinon.assert.calledOnceWithExactly(getAccessTokenUsecase.execute, {
        account: unAccount({
          sub: 'sub_conseiller',
          type: User.Type.CONSEILLER
        })
      })
      expect(context.body).toEqual({
        issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        access_token: tokenData.token,
        token_type: 'bearer',
        expires_in: tokenData.expiresIn,
        scope: tokenData.scope
      })
    })

    it('exchange le token pour un sub different du type voulu', async () => {
      // Given
      const context = {
        oidc: {
          params: {
            subject_token: 'tok',
            requested_token_sub: 'sub_user',
            requested_sub_type: 'CONSEILLER'
          }
        },
        body: {}
      }
      validateJWTUsecase.execute.resolves(
        success({
          sub: 'CONSEILLER|MILO|id-auth',
          userType: 'CONSEILLER',
          userStructure: 'MILO'
        })
      )
      const tokenData = unTokenData()
      getAccessTokenUsecase.execute.resolves(success(tokenData))

      // When
      await tokenExchangeGrant.handler(context as unknown as KoaContextWithOIDC)

      // Then
      sinon.assert.calledOnceWithExactly(validateJWTUsecase.execute, {
        token: 'tok'
      })
      sinon.assert.calledOnceWithExactly(getAccessTokenUsecase.execute, {
        account: unAccount({ sub: 'sub_user', type: User.Type.CONSEILLER })
      })
      expect(context.body).toEqual({
        issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        access_token: tokenData.token,
        token_type: 'bearer',
        expires_in: tokenData.expiresIn,
        scope: tokenData.scope
      })
    })

    it('erreur quand le subject token est introuvable', async () => {
      // Given
      const context = {}

      try {
        // When
        await tokenExchangeGrant.handler(
          context as unknown as KoaContextWithOIDC
        )
        throw new Error('handle test did not reject with an error')
      } catch (e) {
        // Then
        sinon.assert.notCalled(validateJWTUsecase.execute)
        sinon.assert.notCalled(getAccessTokenUsecase.execute)
        expect(e).toBeInstanceOf(Error)
      }
    })

    it('erreur quand le subject token est invalide', async () => {
      // Given
      const context = {
        oidc: { params: { subject_token: 'tok' } },
        body: {}
      }
      validateJWTUsecase.execute.resolves(failure(new JWTError('ERR')))

      try {
        // When
        await tokenExchangeGrant.handler(
          context as unknown as KoaContextWithOIDC
        )
        throw new Error('handle test did not reject with an error')
      } catch (e) {
        // Then
        sinon.assert.calledOnceWithExactly(validateJWTUsecase.execute, {
          token: 'tok'
        })
        sinon.assert.notCalled(getAccessTokenUsecase.execute)
        expect(e).toBeInstanceOf(Error)
      }
    })

    it('erreur quand impossible de récupérer un access token', async () => {
      // Given
      const context = {
        oidc: { params: { subject_token: 'tok' } },
        body: {}
      }
      validateJWTUsecase.execute.resolves(
        success({
          sub: 'CONSEILLER|MILO|id-auth',
          userType: 'CONSEILLER',
          userStructure: 'MILO'
        })
      )
      getAccessTokenUsecase.execute.resolves(
        failure(new NonTrouveError('token'))
      )

      try {
        // When
        await tokenExchangeGrant.handler(
          context as unknown as KoaContextWithOIDC
        )
        throw new Error('handle test did not reject with an error')
      } catch (e) {
        // Then
        sinon.assert.calledOnceWithExactly(validateJWTUsecase.execute, {
          token: 'tok'
        })
        sinon.assert.calledOnceWithExactly(getAccessTokenUsecase.execute, {
          account: unAccount({ sub: 'id-auth' })
        })
        expect(e).toBeInstanceOf(Error)
      }
    })
  })
})

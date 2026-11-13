import sinon from 'sinon'
import { DeleteAccountUsecase } from '../../src/account/delete-account.usecase'
import { OidcService } from '../../src/oidc-provider/oidc.service'
import { TokenService } from '../../src/token/token.service'
import { isFailure, isSuccess } from '../../src/utils/result/result'
import { StubbedClass, stubClass } from '../test-utils'

describe('DeleteAccountUsecase', () => {
  let tokenService: StubbedClass<TokenService>
  let oidcService: StubbedClass<OidcService>
  let usecase: DeleteAccountUsecase

  beforeEach(() => {
    tokenService = stubClass(TokenService)
    oidcService = stubClass(OidcService)
    usecase = new DeleteAccountUsecase(tokenService, oidcService)
  })

  it('révoque le grant invité puis supprime les tokens IDP', async () => {
    // Given
    oidcService.revoquerGrantInvite.resolves(true)
    tokenService.supprimerTokensIdp.resolves()

    // When
    const result = await usecase.execute({ idAuth: 'sub-invite' })

    // Then
    expect(isSuccess(result)).toBe(true)
    sinon.assert.calledOnceWithExactly(
      oidcService.revoquerGrantInvite,
      'JEUNE|INVITE|sub-invite'
    )
    sinon.assert.calledOnceWithExactly(tokenService.supprimerTokensIdp, [
      'sub-invite'
    ])
    sinon.assert.callOrder(
      oidcService.revoquerGrantInvite,
      tokenService.supprimerTokensIdp
    )
  })

  it("supprime les tokens IDP d'un compte qui n'est pas un invité", async () => {
    // Given
    oidcService.revoquerGrantInvite.resolves(false)
    tokenService.supprimerTokensIdp.resolves()

    // When
    const result = await usecase.execute({ idAuth: 'sub-ft' })

    // Then
    expect(isSuccess(result)).toBe(true)
    sinon.assert.calledOnceWithExactly(tokenService.supprimerTokensIdp, [
      'sub-ft'
    ])
  })

  it('échoue sans toucher aux tokens IDP si la révocation du grant échoue', async () => {
    // Given
    oidcService.revoquerGrantInvite.rejects(new Error('redis ko'))

    // When
    const result = await usecase.execute({ idAuth: 'sub-invite' })

    // Then
    expect(isFailure(result)).toBe(true)
    sinon.assert.notCalled(tokenService.supprimerTokensIdp)
  })
})

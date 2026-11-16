import sinon from 'sinon'
import { RevoquerTokensIdpUsecase } from '../../src/account/revoquer-tokens-idp.usecase'
import { TokenService } from '../../src/token/token.service'
import { isFailure, isSuccess } from '../../src/utils/result/result'
import { StubbedClass, stubClass } from '../test-utils'

describe('RevoquerTokensIdpUsecase', () => {
  let tokenService: StubbedClass<TokenService>
  let usecase: RevoquerTokensIdpUsecase

  beforeEach(() => {
    tokenService = stubClass(TokenService)
    usecase = new RevoquerTokensIdpUsecase(tokenService)
  })

  it('supprime les tokens IDP de tous les subs', async () => {
    // Given
    tokenService.supprimerTokensIdp.resolves()

    // When
    const result = await usecase.execute({ subs: ['sub-1', 'sub-2'] })

    // Then
    expect(isSuccess(result)).toBe(true)
    sinon.assert.calledOnceWithExactly(tokenService.supprimerTokensIdp, [
      'sub-1',
      'sub-2'
    ])
  })

  it('échoue si redis échoue', async () => {
    // Given
    tokenService.supprimerTokensIdp.rejects(new Error('redis ko'))

    // When
    const result = await usecase.execute({ subs: ['sub-1'] })

    // Then
    expect(isFailure(result)).toBe(true)
  })
})

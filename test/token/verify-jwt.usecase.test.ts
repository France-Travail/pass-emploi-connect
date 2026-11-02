import { ValidateJWTUsecase } from '../../src/token/verify-jwt.usecase'
import { unJwtPayloadValide, uneDatetime } from '../test-utils/fixtures'
import { testConfig, testKeyPair } from '../test-utils/module-for-testing'
import { StubbedClass, stubClass } from '../test-utils'
import { DateService } from '../../src/utils/date.service'
import { errors } from 'jose'
import { failure, success } from '../../src/utils/result/result'
import { JWTError } from '../../src/utils/result/error'

describe('ValidateJWTUsecase', () => {
  let validateJWTUsecase: ValidateJWTUsecase
  let dateService: StubbedClass<DateService>
  const maintenant = uneDatetime()
  const configService = testConfig()

  beforeEach(() => {
    dateService = stubClass(DateService)
    validateJWTUsecase = new ValidateJWTUsecase(configService, dateService)
  })
  describe('execute', () => {
    it('retourne le JWTPayload quand tout est ok', async () => {
      // Given
      const payload = unJwtPayloadValide()
      const validToken = await testKeyPair().signJWT(payload, '100y')
      const inputs = {
        token: validToken
      }
      dateService.now.returns(maintenant)

      // When
      const result = await validateJWTUsecase.execute(inputs)

      // Then
      expect(result._isSuccess).toBe(true)
      if (result._isSuccess) {
        expect(result.data.sub).toEqual(payload.sub)
        expect(result.data.email).toEqual(payload.email)
        expect(result.data.preferred_username).toEqual(payload.preferred_username)
      }
    })
    it("retourne une erreur expired quand l'exp du token est inferieur à maintenant", async () => {
      // Given
      const payload = unJwtPayloadValide()
      const tokenExpiringIn100Years = await testKeyPair().signJWT(payload, '100y')
      const inputs = {
        token: tokenExpiringIn100Years
      }
      const dateIn200Years = maintenant.plus({ years: 200 })
      dateService.now.returns(dateIn200Years)

      // When
      const result = await validateJWTUsecase.execute(inputs)

      // Then
      expect(result).toEqual(failure(new JWTError(errors.JWTExpired.code)))
    })
    it('retourne une erreur JWKS expired JWT est expiré (peu importe la date now)', async () => {
      // Given
      const payload = unJwtPayloadValide()
      const expiredToken = await testKeyPair().signJWT(payload, '0s')
      const inputs = {
        token: expiredToken
      }
      dateService.now.returns(maintenant)

      // When
      const result = await validateJWTUsecase.execute(inputs)

      // Then
      expect(result).toEqual(failure(new JWTError(errors.JWTExpired.code)))
    })
    it('retourne une erreur JWS invalid quand le token est pas bien formé', async () => {
      // Given
      const inputs = {
        token: 'blabla'
      }
      dateService.now.returns(maintenant)

      // When
      const result = await validateJWTUsecase.execute(inputs)

      // Then
      expect(result).toEqual(failure(new JWTError(errors.JWSInvalid.code)))
    })
    it("retourne une erreur JWKS No matching key quand le token n'est pas à nous", async () => {
      // Given
      const inputs = {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      }
      dateService.now.returns(maintenant)

      // When
      const result = await validateJWTUsecase.execute(inputs)

      // Then
      expect(result).toEqual(
        failure(new JWTError(errors.JWKSNoMatchingKey.code))
      )
    })
  })
})

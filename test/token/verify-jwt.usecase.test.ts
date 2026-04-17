import { expect } from 'chai'
import { ValidateJWTUsecase } from '../../src/token/verify-jwt.usecase'
import { unJwtPayloadValide, uneDatetime } from '../test-utils/fixtures'
import { testConfig } from '../test-utils/module-for-testing'
import { StubbedClass, stubClass } from '../test-utils'
import { DateService } from '../../src/utils/date.service'
import { errors } from 'jose'
import { DateTime } from 'luxon'
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
    // TODO regénérer un jwt access token valide très longtemps
    it.skip('retourne le JWTPayload quand tout est ok', async () => {
      // Given
      const inputs = {
        token: configService.get('test.miloConseillerCEJJWT')
      }
      dateService.now.returns(maintenant)

      // When
      const result = await validateJWTUsecase.execute(inputs)

      // Then
      expect(result).to.deep.equal(success(unJwtPayloadValide()))
    })
    it.skip("retourne une erreur expired quand l'exp du token est inferieur à maintenant", async () => {
      // Given
      const inputs = {
        token: configService.get('test.miloConseillerCEJJWT')
      }
      // à mettre à jour si on change le token de test
      dateService.now.returns(DateTime.fromISO('2025-10-02T20:00:00Z'))

      // When
      const result = await validateJWTUsecase.execute(inputs)

      // Then
      expect(result).to.deep.equal(
        failure(new JWTError(errors.JWTExpired.code))
      )
    })
    it('retourne une erreur JWKS expired JWT est expiré (peu importe la date now)', async () => {
      // Given
      const inputs = {
        token: configService.get('test.miloConseillerCEJJWTExpired')
      }
      dateService.now.returns(maintenant)

      // When
      const result = await validateJWTUsecase.execute(inputs)

      // Then
      expect(result).to.deep.equal(
        failure(new JWTError(errors.JWTExpired.code))
      )
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
      expect(result).to.deep.equal(
        failure(new JWTError(errors.JWSInvalid.code))
      )
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
      expect(result).to.deep.equal(
        failure(new JWTError(errors.JWKSNoMatchingKey.code))
      )
    })
  })
})

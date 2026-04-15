import { User, estBeneficiaireFTConnect } from '../../src/domain/user.js'
import { expect } from '../test-utils/index.js'

describe('User', () => {
  describe('estJeuneFT', () => {
    it('renvoie true si jeune FT', () => {
      // When
      const result = estBeneficiaireFTConnect(
        User.Type.JEUNE,
        User.Structure.POLE_EMPLOI_AIJ
      )

      // Then
      expect(result).to.be.true()
    })
    it('renvoie true si beneficiaire FT', () => {
      // When
      const result = estBeneficiaireFTConnect(
        User.Type.BENEFICIAIRE,
        User.Structure.FRANCE_TRAVAIL
      )

      // Then
      expect(result).to.be.true()
    })
    it('renvoie false si beneficiaire Milo', () => {
      // When
      const result = estBeneficiaireFTConnect(
        User.Type.BENEFICIAIRE,
        User.Structure.MILO
      )

      // Then
      expect(result).to.be.false()
    })
    it('renvoie false si jeune MILO', () => {
      // When
      const result = estBeneficiaireFTConnect(
        User.Type.JEUNE,
        User.Structure.MILO
      )

      // Then
      expect(result).to.be.false()
    })
    it('renvoie false si conseiller FT', () => {
      // When
      const result = estBeneficiaireFTConnect(
        User.Type.CONSEILLER,
        User.Structure.POLE_EMPLOI_BRSA
      )

      // Then
      expect(result).to.be.false()
    })
  })
})

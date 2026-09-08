import { User, estJeuneFTConnect } from '../../src/domain/user'

describe('User', () => {
  describe('estJeuneFTConnect', () => {
    it('renvoie true si jeune PE AIJ', () => {
      // When
      const result = estJeuneFTConnect(
        User.Type.JEUNE,
        User.Structure.POLE_EMPLOI_AIJ
      )

      // Then
      expect(result).toBe(true)
    })
    it('renvoie true si jeune FRANCE_TRAVAIL', () => {
      // When
      const result = estJeuneFTConnect(
        User.Type.JEUNE,
        User.Structure.FRANCE_TRAVAIL
      )

      // Then
      expect(result).toBe(true)
    })
    it('renvoie false si jeune MILO', () => {
      // When
      const result = estJeuneFTConnect(User.Type.JEUNE, User.Structure.MILO)

      // Then
      expect(result).toBe(false)
    })
    it('renvoie false si conseiller FT', () => {
      // When
      const result = estJeuneFTConnect(
        User.Type.CONSEILLER,
        User.Structure.POLE_EMPLOI_BRSA
      )

      // Then
      expect(result).toBe(false)
    })
  })
})

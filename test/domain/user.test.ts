import {
  Profil,
  User,
  estConseillerDept,
  estInvite,
  estJeuneFTConnect,
  profilDeStructure
} from '../../src/domain/user'

describe('User', () => {
  describe('estInvite', () => {
    it('renvoie true si structure INVITE', () => {
      // When
      const result = estInvite(User.Structure.INVITE)

      // Then
      expect(result).toBe(true)
    })
    it('renvoie false si autre structure', () => {
      // When
      const result = estInvite(User.Structure.MILO)

      // Then
      expect(result).toBe(false)
    })
  })

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
    it('renvoie true si jeune CONSEIL_DEPT', () => {
      // When
      const result = estJeuneFTConnect(
        User.Type.JEUNE,
        User.Structure.CONSEIL_DEPT
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
    it('renvoie false si jeune INVITE', () => {
      // When
      const result = estJeuneFTConnect(User.Type.JEUNE, User.Structure.INVITE)

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

  describe('estConseillerDept', () => {
    it('renvoie true si conseiller CONSEIL_DEPT', () => {
      // When
      const result = estConseillerDept(
        User.Type.CONSEILLER,
        User.Structure.CONSEIL_DEPT
      )

      // Then
      expect(result).toBe(true)
    })
    it('renvoie false si conseiller autre structure', () => {
      // When
      const result = estConseillerDept(
        User.Type.CONSEILLER,
        User.Structure.MILO
      )

      // Then
      expect(result).toBe(false)
    })
    it('renvoie false si jeune CONSEIL_DEPT', () => {
      // When
      const result = estConseillerDept(
        User.Type.JEUNE,
        User.Structure.CONSEIL_DEPT
      )

      // Then
      expect(result).toBe(false)
    })
  })

  describe('profilDeStructure', () => {
    it.each([
      [User.Structure.MILO, Profil.Structure.MILO, null],
      [
        User.Structure.CONSEIL_DEPT,
        Profil.Structure.CONSEIL_DEPARTEMENTAL,
        null
      ],
      [User.Structure.INVITE, Profil.Structure.INVITE, null],
      [User.Structure.FRANCE_TRAVAIL, Profil.Structure.FRANCE_TRAVAIL, null],
      [
        User.Structure.POLE_EMPLOI_CEJ,
        Profil.Structure.FRANCE_TRAVAIL,
        Profil.Dispositif.CEJ
      ],
      [
        User.Structure.POLE_EMPLOI_BRSA,
        Profil.Structure.FRANCE_TRAVAIL,
        Profil.Dispositif.BRSA
      ],
      [
        User.Structure.POLE_EMPLOI_AIJ,
        Profil.Structure.FRANCE_TRAVAIL,
        Profil.Dispositif.AIJ
      ],
      [
        User.Structure.AVENIR_PRO,
        Profil.Structure.FRANCE_TRAVAIL,
        Profil.Dispositif.AVENIR_PRO
      ],
      [
        User.Structure.FT_ACCOMPAGNEMENT_INTENSIF,
        Profil.Structure.FRANCE_TRAVAIL,
        Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF
      ],
      [
        User.Structure.FT_ACCOMPAGNEMENT_GLOBAL,
        Profil.Structure.FRANCE_TRAVAIL,
        Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL
      ],
      [
        User.Structure.FT_EQUIP_EMPLOI_RECRUT,
        Profil.Structure.FRANCE_TRAVAIL,
        Profil.Dispositif.EQUIP_EMPLOI_RECRUT
      ],
      [
        User.Structure.FT_DEMANDEUR_D_EMPLOI,
        Profil.Structure.FRANCE_TRAVAIL,
        Profil.Dispositif.DEMANDEUR_D_EMPLOI
      ],
      [
        User.Structure.FT_ESPACE_CANDIDAT,
        Profil.Structure.FRANCE_TRAVAIL,
        Profil.Dispositif.ESPACE_CANDIDAT
      ]
    ])(
      'renvoie le profil de la structure %s',
      (userStructure, structure, dispositif) => {
        // When
        const result = profilDeStructure(userStructure)

        // Then
        expect(result).toEqual({ structure, dispositif })
      }
    )

    it('couvre toutes les structures', () => {
      // When
      const structures = Object.values(User.Structure)

      // Then
      for (const structure of structures) {
        expect(profilDeStructure(structure)).toBeDefined()
      }
    })
  })
})

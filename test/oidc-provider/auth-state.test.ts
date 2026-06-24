import {
  decodeAuthStateInteractionId,
  decodeAuthStateType,
  encodeAuthState
} from '../../src/oidc-provider/auth-state'

describe('auth-state', () => {
  describe('encodeAuthState', () => {
    it("encode l'uid seul quand il n'y a pas de type (MILO, conseil dept)", () => {
      expect(encodeAuthState('uid-123')).toEqual('uid-123')
    })

    it('encode `${type}.${uid}` quand un type est fourni (France Travail)', () => {
      expect(encodeAuthState('uid-123', 'cej')).toEqual('cej.uid-123')
    })
  })

  describe('decodeAuthStateInteractionId', () => {
    it("retrouve l'uid depuis un state sans type", () => {
      expect(decodeAuthStateInteractionId('uid-123')).toEqual('uid-123')
    })

    it("retrouve l'uid depuis un state `${type}.${uid}`", () => {
      expect(decodeAuthStateInteractionId('cej.uid-123')).toEqual('uid-123')
    })

    it('retourne undefined quand le state est absent', () => {
      expect(decodeAuthStateInteractionId(undefined)).toBeUndefined()
      expect(decodeAuthStateInteractionId('')).toBeUndefined()
    })
  })

  describe('decodeAuthStateType', () => {
    it('retrouve le type depuis un state `${type}.${uid}`', () => {
      expect(decodeAuthStateType('cej.uid-123')).toEqual('cej')
    })

    it('gère un type qui contient des tirets', () => {
      expect(decodeAuthStateType('accompagnement-intensif.uid-123')).toEqual(
        'accompagnement-intensif'
      )
    })

    it("retourne undefined quand il n'y a pas de type (state = uid seul)", () => {
      expect(decodeAuthStateType('uid-123')).toBeUndefined()
    })

    it('retourne undefined quand le state est absent', () => {
      expect(decodeAuthStateType(undefined)).toBeUndefined()
    })
  })

  describe('round-trip', () => {
    it('encode puis decode preserve uid et type', () => {
      const state = encodeAuthState('uid-xyz', 'brsa')
      expect(decodeAuthStateType(state)).toEqual('brsa')
      expect(decodeAuthStateInteractionId(state)).toEqual('uid-xyz')
    })

    it('encode puis decode preserve uid sans type', () => {
      const state = encodeAuthState('uid-xyz')
      expect(decodeAuthStateType(state)).toBeUndefined()
      expect(decodeAuthStateInteractionId(state)).toEqual('uid-xyz')
    })
  })
})

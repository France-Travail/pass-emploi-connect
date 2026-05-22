import {
  isSensitiveKey,
  serializeBodyForLog,
  toEcsError
} from '../../../src/utils/monitoring/logger.module'

describe('logger.module helpers', () => {
  describe('isSensitiveKey', () => {
    it('détecte les clés sensibles par fragment, insensible à la casse', () => {
      expect(isSensitiveKey('access_token')).toBe(true)
      expect(isSensitiveKey('Authorization')).toBe(true)
      expect(isSensitiveKey('client_secret')).toBe(true)
      expect(isSensitiveKey('nom')).toBe(false)
      expect(isSensitiveKey('code')).toBe(false)
    })
  })

  describe('serializeBodyForLog', () => {
    it('masque les valeurs des clés sensibles dans un objet', () => {
      // When
      const result = serializeBodyForLog({ nom: 'Dupont', token: 'abc' })

      // Then
      expect(result).toContain('Dupont')
      expect(result).toContain('[Redacted]')
      expect(result).not.toContain('abc')
    })

    it('retourne undefined pour un body vide', () => {
      expect(serializeBodyForLog(undefined)).toBeUndefined()
      expect(serializeBodyForLog({})).toBeUndefined()
    })

    it('masque les clés sensibles dans une URLSearchParams', () => {
      // Given
      const params = new URLSearchParams({ scope: 'openid', secret: 'xyz' })

      // When
      const result = serializeBodyForLog(params)

      // Then
      expect(result).toContain('openid')
      expect(result).toContain('%5BRedacted%5D')
    })
  })

  describe('toEcsError', () => {
    it('convertit une Error JS', () => {
      // When
      const result = toEcsError(new TypeError('boom'))

      // Then
      expect(result.type).toEqual('TypeError')
      expect(result.message).toEqual('boom')
      expect(result.stack_trace).toBeDefined()
    })

    it('convertit une erreur métier code/message', () => {
      expect(toEcsError({ code: 'AUTHORIZE', message: 'échec' })).toEqual({
        type: 'AUTHORIZE',
        message: 'échec'
      })
    })

    it('convertit une valeur inconnue', () => {
      expect(toEcsError('oops')).toEqual({ type: 'Unknown', message: 'oops' })
    })
  })
})

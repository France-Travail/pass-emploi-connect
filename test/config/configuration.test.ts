/* eslint-disable no-process-env */
import configuration from '../../src/config/configuration'

interface OidcConfig {
  refreshTokenTtlMinutes: number
  webRefreshTokenTtlMinutes: number
}

// Génère les variables d'un IDP à partir de son préfixe
const idpEnv = (prefix: string, withRealm = false): Record<string, string> => ({
  [`${prefix}_ISSUER`]: `https://${prefix}.com`,
  [`${prefix}_AUTHORIZATION_URL`]: `https://${prefix}.com/auth`,
  [`${prefix}_TOKEN_URL`]: `https://${prefix}.com/token`,
  [`${prefix}_JWKS`]: `https://${prefix}.com/jwks`,
  [`${prefix}_USERINFO`]: `https://${prefix}.com/userinfo`,
  [`${prefix}_CLIENT_ID`]: `${prefix}-id`,
  [`${prefix}_CLIENT_SECRET`]: `${prefix}-secret`,
  [`${prefix}_SCOPES`]: 'openid',
  [`${prefix}_REDIRECT_URI`]: `https://${prefix}.com/cb`,
  [`${prefix}_LOGOUT`]: `https://${prefix}.com/logout`,
  ...(withRealm ? { [`${prefix}_REALM`]: 'individu' } : {})
})

// Env minimal mais complet et valide pour que le loader passe la validation Joi
const validEnv: Record<string, string> = {
  ENVIRONMENT: 'staging',
  PUBLIC_ADDRESS: 'http://localhost:5050',
  PASS_EMPLOI_API_URL: 'https://api.pass-emploi.fr',
  PASS_EMPLOI_API_KEY: 'api-key',
  FT_JEUNE_API_URL: 'https://ft.fr',
  AUTHORIZED_API_KEYS: '["pass-emploi-back"]',
  REDIS_URL: 'redis://localhost:6767',
  CLIENT_WEB_ID: 'web',
  CLIENT_WEB_SECRET: 'web-secret',
  CLIENT_WEB_CALLBACKS: '["https://web/cb"]',
  CLIENT_WEB_ERROR_CALLBACK: 'https://web/error',
  CLIENT_WEB_LOGOUT_CALLBACKS: '["https://web/logout"]',
  CLIENT_APP_ID: 'app',
  CLIENT_APP_SECRET: 'app-secret',
  CLIENT_APP_CALLBACKS: '["https://app/cb"]',
  CLIENT_API_ID: 'api',
  CLIENT_API_SECRET: 'api-secret',
  CLIENT_SWAGGER_ID: 'swagger',
  CLIENT_SWAGGER_SECRET: 'swagger-secret',
  CLIENT_SWAGGER_CALLBACKS: '["https://swagger/cb"]',
  RESSOURCE_SERVER: 'https://rs',
  RESSOURCE_SCOPES: 'openid',
  JWKS: '{"keys":[{"kid":"a"},{"kid":"b"}]}',
  ...idpEnv('IDP_FT_JEUNE', true),
  ...idpEnv('IDP_FT_CONSEILLER'),
  ...idpEnv('IDP_MILO_CONSEILLER'),
  ...idpEnv('IDP_MILO_JEUNE'),
  ...idpEnv('IDP_CONSEILLER_DEPT')
}

describe('configuration', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...validEnv }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  describe('oidc refresh token ttl', () => {
    it('utilise les valeurs par défaut (42j / 3j en minutes) quand les variables ne sont pas définies', () => {
      // Given : pas de OIDC_*_REFRESH_TOKEN_TTL_MINUTES dans l'env

      // When
      const oidc = configuration().oidc as OidcConfig

      // Then
      expect(oidc.refreshTokenTtlMinutes).toBe(60 * 24 * 42)
      expect(oidc.webRefreshTokenTtlMinutes).toBe(60 * 24 * 3)
    })

    it("utilise les variables d'environnement quand elles sont définies", () => {
      // Given
      process.env.OIDC_REFRESH_TOKEN_TTL_MINUTES = '1000'
      process.env.OIDC_WEB_REFRESH_TOKEN_TTL_MINUTES = '50'

      // When
      const oidc = configuration().oidc as OidcConfig

      // Then
      expect(oidc.refreshTokenTtlMinutes).toBe(1000)
      expect(oidc.webRefreshTokenTtlMinutes).toBe(50)
    })
  })
})

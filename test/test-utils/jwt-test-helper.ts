import { generateKeyPairSync } from 'node:crypto'
import { SignJWT, JWTPayload } from 'jose'
import { JWKS } from 'oidc-provider'

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048
})

const publicJWK = publicKey.export({ format: 'jwk' })
publicJWK.kid = 'test-key-id'
publicJWK.use = 'sig'
publicJWK.alg = 'RS256'

const privateJWK = privateKey.export({ format: 'jwk' })
privateJWK.kid = 'test-key-id'
privateJWK.use = 'sig'
privateJWK.alg = 'RS256'

export const testJWKS = {
  public: {
    keys: [publicJWK]
  } as JWKS,
  private: {
    keys: [privateJWK]
  } as JWKS
}

export async function signTestJWT(
  payload: JWTPayload,
  expiresIn: string
): Promise<string> {
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)

  return await jwt.sign(privateKey)
}

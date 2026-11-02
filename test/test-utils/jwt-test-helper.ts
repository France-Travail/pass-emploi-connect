import { generateKeyPair, exportJWK, SignJWT, JWTPayload } from 'jose'
import { JWKS } from 'oidc-provider'

interface TestKeyPair {
  publicJWKS: JWKS
  privateJWKS: JWKS
  signJWT: (payload: JWTPayload, expiresIn: string) => Promise<string>
}

let cachedKeyPair: TestKeyPair | null = null

export async function initializeTestKeyPair(): Promise<void> {
  if (cachedKeyPair) {
    return
  }

  const { publicKey, privateKey } = await generateKeyPair('RS256', {
    modulusLength: 2048
  })

  const publicJWK = await exportJWK(publicKey)
  publicJWK.kid = 'test-key-id'
  publicJWK.use = 'sig'
  publicJWK.alg = 'RS256'

  const privateJWK = await exportJWK(privateKey)
  privateJWK.kid = 'test-key-id'
  privateJWK.use = 'sig'
  privateJWK.alg = 'RS256'

  const publicJWKS: JWKS = {
    keys: [publicJWK]
  }

  const privateJWKS: JWKS = {
    keys: [privateJWK]
  }

  const signJWT = async (
    payload: JWTPayload,
    expiresIn: string
  ): Promise<string> => {
    const jwt = new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id' })
      .setIssuedAt()
      .setExpirationTime(expiresIn)

    return await jwt.sign(privateKey)
  }

  cachedKeyPair = { publicJWKS, privateJWKS, signJWT }
}

export function getTestKeyPair(): TestKeyPair {
  if (!cachedKeyPair) {
    throw new Error(
      'Test key pair not initialized. Call initializeTestKeyPair() first.'
    )
  }
  return cachedKeyPair
}

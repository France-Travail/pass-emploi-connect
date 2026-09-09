import {
  KeyLike,
  SignJWT,
  UnsecuredJWT,
  exportJWK,
  generateKeyPair
} from 'jose'
import nock from 'nock'
import { BaseClient, Issuer, TokenSet } from 'openid-client'
import { creerClientOidc } from '../../../src/idp/service/oidc-client'

const ISSUER = 'https://idp.test'
const CLIENT_ID = 'pass-emploi'
const CLIENT_SECRET = 'un-secret'
const REDIRECT_URI = 'https://connect.test/callback'
const NONCE = 'un-nonce'
const STATE = 'un-state'

type PaireDeCles = { privateKey: KeyLike; publicKey: KeyLike }

describe('creerClientOidc', () => {
  let cleRsa: PaireDeCles
  let cleEc: PaireDeCles
  let client: BaseClient

  beforeAll(async () => {
    cleRsa = await generateKeyPair('RS256')
    cleEc = await generateKeyPair('ES256')
    nock.disableNetConnect()
  })

  afterAll(() => {
    nock.enableNetConnect()
  })

  beforeEach(async () => {
    // JWKS de l'IDP : une clé RSA et une clé EC, comme celui de FT après
    // leur migration
    const jwks = {
      keys: [
        { ...(await exportJWK(cleRsa.publicKey)), kid: 'rsa', alg: 'RS256' },
        { ...(await exportJWK(cleEc.publicKey)), kid: 'ec', alg: 'ES256' }
      ]
    }
    nock(ISSUER).persist().get('/jwks').reply(200, jwks)

    const issuer = new Issuer({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/authorize`,
      token_endpoint: `${ISSUER}/token`,
      jwks_uri: `${ISSUER}/jwks`,
      userinfo_endpoint: `${ISSUER}/userinfo`
    })
    // Pas de id_token_signed_response_alg : RS256 par défaut, comme en prod
    client = creerClientOidc(issuer, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uris: [REDIRECT_URI],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post'
    })
  })

  afterEach(() => {
    nock.cleanAll()
  })

  const idTokenSigne = (
    alg: string,
    kid: string,
    key: KeyLike | Uint8Array
  ): Promise<string> =>
    new SignJWT({ nonce: NONCE })
      .setProtectedHeader({ alg, kid })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setSubject('un-sub')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key)

  // Passe par client.callback() : le vrai chemin du login (échange du code
  // puis validateIdToken -> validateJWT)
  const echangerLeCode = (idToken: string): Promise<TokenSet> => {
    nock(ISSUER).post('/token').reply(200, {
      access_token: 'un-at',
      token_type: 'Bearer',
      id_token: idToken
    })
    return client.callback(
      REDIRECT_URI,
      { code: 'un-code', state: STATE },
      { state: STATE, nonce: NONCE }
    )
  }

  it('accepte un ID token signé RS256 (comportement historique)', async () => {
    // Given
    const idToken = await idTokenSigne('RS256', 'rsa', cleRsa.privateKey)

    // When
    const tokenSet = await echangerLeCode(idToken)

    // Then
    expect(tokenSet.claims().sub).toBe('un-sub')
  })

  it('accepte un ID token signé ES256 alors que RS256 est l’algo déclaré', async () => {
    // Given
    const idToken = await idTokenSigne('ES256', 'ec', cleEc.privateKey)

    // When
    const tokenSet = await echangerLeCode(idToken)

    // Then
    expect(tokenSet.claims().sub).toBe('un-sub')
  })

  it('vérifie toujours la signature : rejette un ES256 signé par une clé absente du JWKS', async () => {
    // Given
    const cleInconnue = await generateKeyPair('ES256')
    const idToken = await idTokenSigne('ES256', 'ec', cleInconnue.privateKey)

    // When / Then
    await expect(echangerLeCode(idToken)).rejects.toThrow(
      'failed to validate JWT signature'
    )
  })

  it('rejette un ID token HS256 (confusion d’algorithme avec le secret client)', async () => {
    // Given
    const idToken = await idTokenSigne(
      'HS256',
      'rsa',
      new TextEncoder().encode(CLIENT_SECRET)
    )

    // When / Then
    await expect(echangerLeCode(idToken)).rejects.toThrow(
      'unexpected JWT alg received, expected RS256, got: HS256'
    )
  })

  it('rejette un ID token non signé (alg none)', async () => {
    // Given
    const idToken = new UnsecuredJWT({ nonce: NONCE })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setSubject('un-sub')
      .setIssuedAt()
      .setExpirationTime('5m')
      .encode()

    // When / Then
    await expect(echangerLeCode(idToken)).rejects.toThrow(
      'unexpected JWT alg received, expected RS256, got: none'
    )
  })
})

import { decodeProtectedHeader } from 'jose'
import { BaseClient, ClientMetadata, Issuer } from 'openid-client'

// Méthode interne d'openid-client, absente de ses types : c'est elle qui
// compare l'`alg` du header à `id_token_signed_response_alg` (RS256 par
// défaut) AVANT de vérifier la signature, et qui lève
// « unexpected JWT alg received, expected RS256, got: ES256 ».
declare module 'openid-client' {
  interface BaseClient {
    validateJWT(
      jwt: string,
      expectedAlg: string,
      required?: string[]
    ): Promise<unknown>
  }
}

// Algorithmes de signature d'ID token acceptés quel que soit l'algo déclaré.
//
// France Travail a migré l'IDP agent (env va) sur une plateforme qui signe en
// ES256, sans préavis ni date pour la prod. Plutôt qu'une config à basculer
// le bon jour, on accepte les deux : le jour de la bascule prod, le kid de la
// clé EC est inconnu du cache, openid-client refait un fetch du JWKS et
// valide.
//
// Uniquement des algos asymétriques : la signature reste vérifiée avec les
// clés publiques du JWKS de l'IDP, seul le contrôle d'égalité strict sur
// l'alg est assoupli. `none` et HS* restent exclus, sinon confusion
// d'algorithme (clé publique réutilisée comme secret HMAC).
export const ALGOS_SIGNATURE_ACCEPTES: readonly string[] = ['RS256', 'ES256']

export function creerClientOidc(
  issuer: Issuer,
  metadata: ClientMetadata
): BaseClient {
  class ClientMultiAlg extends issuer.Client {
    async validateJWT(
      jwt: string,
      expectedAlg: string,
      required?: string[]
    ): Promise<unknown> {
      return super.validateJWT(
        jwt,
        algorithmeAttendu(jwt, expectedAlg),
        required
      )
    }
  }
  return new ClientMultiAlg(metadata)
}

function algorithmeAttendu(jwt: string, algDeclare: string): string {
  let alg: string | undefined
  try {
    alg = decodeProtectedHeader(jwt).alg
  } catch {
    // JWT illisible : on laisse openid-client produire son erreur de décodage
    return algDeclare
  }
  return alg && ALGOS_SIGNATURE_ACCEPTES.includes(alg) ? alg : algDeclare
}

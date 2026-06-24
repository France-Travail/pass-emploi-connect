// L'identifiant d'interaction (uid oidc-provider) est transporté dans le `state` OAuth
// — qui, lui, transite par l'IDP externe — afin de pouvoir retrouver l'interaction au
// callback du broker SANS dépendre du cookie `_interaction`. Ce cookie est régulièrement
// perdu par les navigateurs/webviews mobiles à l'aller-retour vers l'IDP (cookies tiers
// bloqués, store éphémère...), ce qui provoquait des SessionNotFound systématiques.
//
// Le `state` peut aussi porter un `type` (cas France Travail, qui dispatch le callback
// selon ce type) : on l'encode alors `${type}.${uid}`. L'uid (nanoid, alphabet url-safe)
// ne contient jamais de point, le séparateur est donc non ambigu (split sur le 1er point).

const AUTH_STATE_SEPARATOR = '.'

export function encodeAuthState(interactionId: string, type?: string): string {
  return type ? `${type}${AUTH_STATE_SEPARATOR}${interactionId}` : interactionId
}

export function decodeAuthStateInteractionId(
  state?: string
): string | undefined {
  if (!state) return undefined
  const separatorIndex = state.indexOf(AUTH_STATE_SEPARATOR)
  return separatorIndex === -1 ? state : state.slice(separatorIndex + 1)
}

export function decodeAuthStateType(state?: string): string | undefined {
  if (!state) return undefined
  const separatorIndex = state.indexOf(AUTH_STATE_SEPARATOR)
  return separatorIndex === -1 ? undefined : state.slice(0, separatorIndex)
}

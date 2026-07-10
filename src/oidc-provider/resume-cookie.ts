import { Request } from 'express'

// Sur la route de reprise `/protocol/openid-connect/auth/:uid`, oidc-provider exige le
// cookie `_interaction_resume` dont la valeur est ce même uid (resume.js). Or certains
// devices ne persistent AUCUN cookie de notre domaine (ITP iOS "bounce tracking" : le
// domaine, traversé en pures redirections sans interaction utilisateur, est classé
// traqueur et ses cookies sont purgés) -> SessionNotFound alors que l'uid est déjà dans
// le path. On synthétise donc le cookie manquant depuis le path : l'uid est un nanoid
// 43 chars à haute entropie, sa connaissance prouve la possession du flow au même titre
// que le code d'autorisation transporté en query ensuite ; le cookie n'apportait qu'un
// binding navigateur que ces devices ne peuvent de toute façon pas fournir.
const RESUME_PATH =
  /^\/protocol\/openid-connect\/auth\/([A-Za-z0-9_-]{21,64})(?:\?|$)/
const RESUME_COOKIE = '_interaction_resume'

export function ensureResumeCookie(req: Request): void {
  const match = RESUME_PATH.exec(req.url)
  if (!match) return

  const cookieHeader = req.headers.cookie
  if (cookieHeader?.includes(`${RESUME_COOKIE}=`)) return

  const synthesized = `${RESUME_COOKIE}=${match[1]}`
  req.headers.cookie = cookieHeader
    ? `${cookieHeader}; ${synthesized}`
    : synthesized
}

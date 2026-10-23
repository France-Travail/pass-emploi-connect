import { NextFunction, Request, RequestHandler, Response } from 'express'

const BROKER_CALLBACK_PATH =
  /^\/auth\/realms\/pass-emploi\/broker\/[^/]+\/endpoint$/

export function requestFilter(blockedIps: string[]): RequestHandler {
  const blockedIpSet = new Set(blockedIps)

  return (req: Request, res: Response, next: NextFunction): void => {
    if (blockedIpSet.has(String(req.headers['x-real-ip']))) {
      res.status(403).end()
      return
    }
    if (isBrokerErrorCallbackWithoutState(req)) {
      res.status(400).end()
      return
    }
    next()
  }
}

// Connect envoie toujours un state à l'IdP (cf. IdpService.getAuthorizationUrl) :
// un retour d'erreur sans state ne correspond à aucun login initié chez nous.
function isBrokerErrorCallbackWithoutState(req: Request): boolean {
  return (
    BROKER_CALLBACK_PATH.test(req.path) &&
    req.query.error !== undefined &&
    req.query.state === undefined
  )
}

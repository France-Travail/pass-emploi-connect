import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ThrottlerOptions } from '@nestjs/throttler'
import { Request } from 'express'
import {
  estUnClientServeurAuthentifie,
  IdentifiantsClient
} from './client-serveur'
import { CREATION_INVITE_KEY } from './creation-invite.decorator'
import { RateLimitConfig } from './rate-limit.config'

const CHEMIN_TOKEN = '/protocol/openid-connect/token'

const reflector = new Reflector()

function estUneRequeteToken(context: ExecutionContext): boolean {
  return context
    .switchToHttp()
    .getRequest<Request>()
    .path.endsWith(CHEMIN_TOKEN)
}

function estUneCreationInvite(context: ExecutionContext): boolean {
  return (
    reflector.get<boolean>(CREATION_INVITE_KEY, context.getHandler()) === true
  )
}

function ipDuClient(
  _req: Record<string, unknown>,
  context: ExecutionContext
): string {
  const req = context.switchToHttp().getRequest<Request>()
  return req.header('x-real-ip') ?? req.socket.remoteAddress ?? ''
}

function cleDuThrottler(
  _context: ExecutionContext,
  tracker: string,
  nom: string
): string {
  return `rate-limit:${nom}:${tracker}`
}

export function nomDuThrottler(cle: string): string {
  return cle.split(':')[1]
}

// Les limites ne sont lues que si le guard ne s'est pas désactivé (config définie).
export function creerThrottlers(
  config: RateLimitConfig | undefined,
  clientsServeur: IdentifiantsClient[]
): ThrottlerOptions[] {
  return [
    {
      name: 'ip',
      ttl: () => config!.ip.fenetreMs,
      limit: () => config!.ip.limite,
      skipIf: estUneRequeteToken,
      getTracker: ipDuClient,
      generateKey: cleDuThrottler,
      setHeaders: false
    },
    {
      name: 'ip-token',
      ttl: () => config!.ip.fenetreMs,
      limit: () => config!.ip.limiteToken,
      skipIf: context =>
        !estUneRequeteToken(context) ||
        estUnClientServeurAuthentifie(
          context.switchToHttp().getRequest<Request>(),
          clientsServeur
        ),
      getTracker: ipDuClient,
      generateKey: cleDuThrottler,
      setHeaders: false
    },
    {
      name: 'creation-invite',
      ttl: () => config!.creationInvite.fenetreMs,
      limit: () => config!.creationInvite.limite,
      skipIf: context => !estUneCreationInvite(context),
      getTracker: () => 'global',
      generateKey: cleDuThrottler,
      setHeaders: false
    }
  ]
}

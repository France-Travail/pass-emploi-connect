import { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { normalizeIp, ThrottlerOptions } from '@nestjs/throttler'
import { Request } from 'express'
import {
  estUnClientServeurAuthentifie,
  IdentifiantsClient
} from './client-serveur'
import { CREATION_INVITE_KEY } from './creation-invite.decorator'
import { RateLimitConfig } from './rate-limit.config'

const CHEMIN_TOKEN = '/protocol/openid-connect/token'
const CHEMINS_STATIQUES = [
  '/.well-known/openid-configuration',
  '/protocol/openid-connect/certs'
]

const reflector = new Reflector()

function estUneRequeteToken(context: ExecutionContext): boolean {
  return context
    .switchToHttp()
    .getRequest<Request>()
    .path.endsWith(CHEMIN_TOKEN)
}

function estUneRequeteStatique(context: ExecutionContext): boolean {
  const chemin = context.switchToHttp().getRequest<Request>().path
  return CHEMINS_STATIQUES.some(statique => chemin.endsWith(statique))
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

export function cleDuThrottler(
  _context: ExecutionContext,
  tracker: string,
  nom: string
): string {
  return `rate-limit:${nom}:${normalizeIp(tracker)}`
}

export function nomDuThrottler(cle: string): string {
  return cle.split(':')[1]
}

export function creerThrottlers(
  config: RateLimitConfig,
  clientsServeur: IdentifiantsClient[]
): ThrottlerOptions[] {
  return [
    {
      name: 'ip',
      ttl: config.ip.fenetreMs,
      limit: config.ip.limite,
      skipIf: context =>
        estUneRequeteToken(context) || estUneRequeteStatique(context),
      getTracker: ipDuClient,
      generateKey: cleDuThrottler,
      setHeaders: false
    },
    {
      name: 'ip-token',
      ttl: config.ip.fenetreMs,
      limit: config.ip.limiteToken,
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
      ttl: config.creationInvite.fenetreMs,
      limit: config.creationInvite.limite,
      skipIf: context => !estUneCreationInvite(context),
      getTracker: () => 'global',
      generateKey: cleDuThrottler,
      setHeaders: false
    }
  ]
}

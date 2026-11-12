import { ConfigService } from '@nestjs/config'
import { timingSafeEqual } from 'crypto'
import { Request } from 'express'

export interface IdentifiantsClient {
  id: string
  secret: string
}

export function lireClientsServeur(
  configService: ConfigService
): IdentifiantsClient[] {
  return ['api', 'web'].flatMap(client => {
    const id = configService.get<string>(`clients.${client}.id`)
    const secret = configService.get<string>(`clients.${client}.secret`)
    return id && secret ? [{ id, secret }] : []
  })
}

export function estUnClientServeurAuthentifie(
  req: Request,
  clientsServeur: IdentifiantsClient[]
): boolean {
  try {
    const fournis = identifiantsFournis(req)
    if (!fournis) return false
    return clientsServeur.some(
      client =>
        client.id === fournis.id && secretsEgaux(client.secret, fournis.secret)
    )
  } catch {
    return false
  }
}

// Même priorité qu'oidc-provider : le client_secret du corps l'emporte sur le header Basic.
function identifiantsFournis(req: Request): IdentifiantsClient | undefined {
  const corps: Record<string, unknown> | undefined = req.body
  if (typeof corps?.client_secret === 'string') {
    return typeof corps.client_id === 'string'
      ? { id: corps.client_id, secret: corps.client_secret }
      : undefined
  }

  const [schema, valeur] = (req.header('authorization') ?? '').split(' ')
  if (schema?.toLowerCase() !== 'basic' || !valeur) return undefined
  const basic = Buffer.from(valeur, 'base64').toString('utf8')
  const separateur = basic.indexOf(':')
  if (separateur === -1) return undefined
  return {
    id: decoderFormulaire(basic.slice(0, separateur)),
    secret: decoderFormulaire(basic.slice(separateur + 1))
  }
}

function decoderFormulaire(valeur: string): string {
  return decodeURIComponent(valeur.replace(/\+/g, '%20'))
}

function secretsEgaux(attendu: string, fourni: string): boolean {
  const a = Buffer.from(attendu)
  const b = Buffer.from(fourni)
  return a.length === b.length && timingSafeEqual(a, b)
}

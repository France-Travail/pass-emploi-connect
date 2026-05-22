import { Injectable } from '@nestjs/common'
import { AsyncLocalStorage } from 'node:async_hooks'

export enum ContextKey {
  USER = 'USER',
  HTTP_REQUEST_ID = 'HTTP_REQUEST_ID',
  INTERACTION_ID = 'INTERACTION_ID'
}

export type ContextData = Map<ContextKey, unknown>

const asyncLocalStorage = new AsyncLocalStorage<ContextData>()

export function getContextValue<T>(key: ContextKey): T | undefined {
  return asyncLocalStorage.getStore()?.get(key) as T | undefined
}

// Contexte de requête propagé via AsyncLocalStorage. Porte la clé de parcours
// login (interaction.uid), l'utilisateur une fois identifié, et l'id de
// requête HTTP. Lu par le mixin pino (logger.module.ts).
@Injectable()
export class RequestContext {
  start(): void {
    asyncLocalStorage.enterWith(new Map<ContextKey, unknown>())
  }

  get<T>(key: ContextKey): T | undefined {
    return getContextValue<T>(key)
  }

  // Best-effort : si start() n'a pas été appelé (hors requête), l'écriture est
  // silencieusement ignorée. Cohérent avec le rôle « contexte de log ».
  set(key: ContextKey, value: unknown): void {
    asyncLocalStorage.getStore()?.set(key, value)
  }
}

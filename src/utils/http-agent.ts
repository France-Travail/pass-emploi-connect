import * as https from 'node:https'
import { custom, CustomHttpOptionsProvider, HttpOptions } from 'openid-client'

// openid-client choisit http.request ou https.request selon le protocole de
// l'URL, mais transmet `agent` tel quel : un https.Agent posé en défaut global
// fait donc échouer toute cible en http:// avec un message trompeur
// (« Protocol "http:" not supported. Expected "https:" »). L'agent est donc
// appliqué par instance, via le hook qui reçoit l'URL.
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 20
})

export function appliquerAgentHttp<
  T extends { [custom.http_options]: CustomHttpOptionsProvider }
>(porteur: T): T {
  porteur[custom.http_options] = (url, options): HttpOptions =>
    url.protocol === 'https:' ? { ...options, agent: httpsAgent } : options
  return porteur
}

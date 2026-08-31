/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Inject, Injectable } from '@nestjs/common'

import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { Request, Response } from 'express'
import {
  ErrorOut,
  InteractionResults,
  JWKS,
  KoaContextWithOIDC
} from 'oidc-provider'
import { Account } from '../domain/account'
import { User } from '../domain/user'
import { PassEmploiAPIClient } from '../api/pass-emploi-api.client'
import { RedisAdapter } from '../redis/redis.adapter'
import { RedisInjectionToken } from '../redis/redis.provider'
import { OIDC_PROVIDER_MODULE, OidcProviderModule, Provider } from './provider'
import { decodeAuthStateInteractionId } from './auth-state'
import {
  TokenExchangeGrant,
  grantType as tokenExchangeGrantType,
  parameters as tokenExchangeParameters
} from './token-exchange.grant'
import sanitizeHtml from 'sanitize-html'
import { isFailure } from '../utils/result/result'
import * as APM from 'elastic-apm-node'
import { getAPMInstance } from '../utils/monitoring/apm.init'
import { rootLogger, toEcsError } from '../utils/monitoring/logger.module'
import { ContextKey, RequestContext } from '../utils/monitoring/request-context'
import { NonTrouveError } from '../utils/result/error'

// Noms par défaut des cookies d'interaction oidc-provider (cookies.names non surchargé).
// cookieName() n'étant pas typé publiquement, on les fige ici.
const INTERACTION_COOKIE = '_interaction'
const INTERACTION_RESUME_COOKIE = '_interaction_resume'

const TTL_42_JOURS = 3600 * 24 * 42

// L'invité n'a aucune identité : il ne peut pas se reconnecter, donc un refresh
// expiré = compte et données perdus définitivement. Son token ne doit jamais
// expirer.
//
// undefined (et surtout pas 0) : oidc-provider fait `exp = this.exp || now + expiration`,
// donc 0 donnerait `exp = now` -> expiré immédiatement. Avec undefined, `now + undefined`
// = NaN (falsy) -> aucun `exp` dans le payload -> isExpired est toujours false, et le
// RedisAdapter ne pose pas d'EXPIRE (`if (expiresIn)`). Token réellement perpétuel.
//
// Le cast est nécessaire : @types/oidc-provider (DefinitelyTyped) déclare
// TTLFunction => number, alors que la lib gère undefined (base_token.js,
// `static expiresIn` renvoie undefined si le ttl n'est ni number ni function).
const TTL_INVITE_JAMAIS = undefined as unknown as number

function estAccountInvite(accountId?: string): boolean {
  if (!accountId) return false
  return Account.getStructureFromAccountId(accountId) === User.Structure.INVITE
}

type OidcInteraction = InstanceType<Provider['Interaction']>

// Sur /token, l'utilisateur n'est pas dans le RequestContext (pas de session) :
// l'accountId (type|structure|sub) se récupère sur les entités du grant en cours
function accountIdFromGrantContext(
  ctx: KoaContextWithOIDC
): string | undefined {
  return (
    ctx.oidc?.entities?.Account?.accountId ??
    ctx.oidc?.entities?.AuthorizationCode?.accountId ??
    ctx.oidc?.entities?.RefreshToken?.accountId
  )
}

@Injectable()
export class OidcService {
  private readonly oidc: Provider
  private readonly jwks: JWKS
  protected apmService: APM.Agent

  @Inject(RequestContext)
  private readonly requestContext!: RequestContext

  constructor(
    private readonly configService: ConfigService,
    @Inject(OIDC_PROVIDER_MODULE) private readonly opm: OidcProviderModule,
    @Inject(RedisInjectionToken) private readonly redisClient: Redis,
    private readonly tokenExchangeGrant: TokenExchangeGrant,
    private readonly passemploiapiService: PassEmploiAPIClient
  ) {
    const oidcPort = this.configService.get<string>('publicAddress')!
    const clients = this.configService.get('clients')
    this.jwks = this.configService.get<JWKS>('jwks')!

    this.apmService = getAPMInstance()

    const accessTokenTtl = this.configService.get<number>(
      'oidc.acessTokenTtlSeconds'
    )

    // Check du prompt "login" : si la session SSO pointe vers un compte introuvable
    // (ex: jeune archivé -> findAccount renvoie undefined) force le login au lieu de réutiliser une session orpheline
    const { interactionPolicy } = this.opm
    const { Check } = interactionPolicy

    const sessionPointeVersUnCompteInexistant = (
      ctx: KoaContextWithOIDC
    ): boolean => {
      const sessionPresente = Boolean(ctx.oidc.session?.accountId)
      const compteIntrouvable = !ctx.oidc.account // findAccount a renvoyé undefined
      return sessionPresente && compteIntrouvable
    }

    const forcerLoginSiCompteInexistant = new Check(
      'account_not_found',
      'session references an account that no longer exists',
      ctx =>
        sessionPointeVersUnCompteInexistant(ctx)
          ? Check.REQUEST_PROMPT // -> renvoie vers le login
          : Check.NO_NEED_TO_PROMPT // -> session OK, on laisse passer
    )

    const policy = interactionPolicy.base() // prompts par défaut : login + consent
    policy.get('login')?.checks.add(forcerLoginSiCompteInexistant)

    this.oidc = new this.opm.Provider(oidcPort, {
      routes: {
        authorization: '/protocol/openid-connect/auth',
        backchannel_authentication: '/protocol/openid-connect/ext/ciba/auth',
        device_authorization: '/protocol/openid-connect/auth/device',
        end_session: '/protocol/openid-connect/logout',
        introspection: '/protocol/openid-connect/token/introspection',
        jwks: '/protocol/openid-connect/certs',
        pushed_authorization_request:
          '/protocol/openid-connect/ext/par/request',
        registration: '/clients-registrations/openid-connect',
        revocation: '/protocol/openid-connect/revoke',
        token: '/protocol/openid-connect/token',
        userinfo: '/protocol/openid-connect/userinfo'
      },
      ttl: {
        RefreshToken: (_ctx, token) =>
          estAccountInvite(token?.accountId) ? TTL_INVITE_JAMAIS : TTL_42_JOURS,
        // Les autorisations accordés dans le Grant sont valables pour tout les access obtenus à partir d'une même refresh, sans limite de temps supplémentaire (donc ISO refresh)
        Grant: (_ctx, grant) =>
          estAccountInvite(grant?.accountId) ? TTL_INVITE_JAMAIS : TTL_42_JOURS,
        Session: TTL_42_JOURS,
        AccessToken: accessTokenTtl,
        IdToken: accessTokenTtl, // Dans l'App Mobile, la validité de l'AccessToken est liée à celle de l'IdToken -> todo: à changer
        // Quand un IDP fait du 2FA avec SMS, on considère qu'un SMS peut mettre jusqu'à 10min pour arriver, on rajoute donc une marge dessus parce qu'il y a des écrans et actions à faire avant et après, ça donne 12 à 15 min
        Interaction: 60 * 60
      },
      issueRefreshToken: async function issueRefreshToken(_ctx, client, _code) {
        return client.grantTypeAllowed('refresh_token')
      },
      rotateRefreshToken: async _ctx => {
        return false
      },
      expiresWithSession: async ctx => {
        return ctx.oidc.client?.applicationType !== 'native'
      },
      // installation_id : posé par l'app mobile sur le /authorize pour
      // corréler les logs de tout le parcours login avec un device précis
      // (les échecs pré-API sont sinon anonymes). Repris dans les labels via
      // le RequestContext (mixin pino).
      extraParams: ['kc_idp_hint', 'installation_id'],
      clients: [
        {
          client_id: clients.api.id,
          client_secret: clients.api.secret,
          grant_types: [tokenExchangeGrantType],
          response_types: []
        },
        {
          client_id: clients.web.id,
          client_secret: clients.web.secret,
          redirect_uris: clients.web.callbacks,
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'client_secret_basic',
          post_logout_redirect_uris: clients.web.logoutCallbacks
        },
        {
          client_id: clients.app.id,
          client_secret: clients.app.secret,
          application_type: 'native',
          redirect_uris: clients.app.callbacks,
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'client_secret_basic'
        },
        {
          client_id: clients.swagger.id,
          client_secret: clients.swagger.secret,
          redirect_uris: clients.swagger.callbacks,
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'client_secret_post'
        }
      ],
      // si besoin de changer l'algo des jwks
      // enabledJWA: {
      //   idTokenSigningAlgValues: ['ES384']
      // },
      // clientDefaults: {
      //   id_token_signed_response_alg: 'ES384',
      // },
      jwks: this.jwks,
      renderError: (ctx, out, error) => {
        ctx.type = 'html'
        ctx.body = `<!DOCTYPE html>
        <html>
        
        <head>
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta charset="utf-8">
          <title>Portail de connexion</title>
          <style>
            @import url(https://fonts.googleapis.com/css?family=Roboto:400,100);
        
            body {
              background-color: #f7f7ff;
              font-family: Roboto, sans-serif;
              margin-top: 100px;
              margin-bottom: 25px
            }
        
            .container {
              background-color: #f9ffff;
              width: 60vw;
              text-align: center;
              padding: 5px;
              margin: 0 auto;
              border-radius: 10px;
              box-shadow: 0 0 10px rgb(59, 105, 209, 0.3);
            }
        
            h1 {
              font-weight: 1000;
              color: rgb(59, 105, 209);
              text-align: center;
              font-size: 2.4em;
              padding: 50px;
            }
            
            p {
              font-size: 1.3em;
            }
        
            .footer-text {
              margin-top: 50px;
              color: rgb(126, 126, 130);
            }
        
            a {
              color: inherit;
            }
        
            pre {
              white-space: pre-wrap;
              white-space: -moz-pre-wrap;
              white-space: -pre-wrap;
              white-space: -o-pre-wrap;
              word-wrap: break-word;
              margin: 0 0 0 1em;
              text-indent: -1em
            }
          </style>
        </head>
        
        <body>
          <div class="container">
            <h1>Portail de connexion</h1>
            <p>Une erreur technique s'est produite, veuillez <b>recharger la page</b> ou contacter le support.</p>
            ${this.logErrors(out, error)}
          </div>
        </body>
        
        </html>`
      },
      cookies: {
        // Lax (et pas None) pour le cookie d'interaction : sur le callback IDP
        // (navigation top-level GET) le cookie Lax est bien renvoyé, alors que
        // None est traité comme cookie tiers et bloqué par les webviews / ITP /
        // navigateurs qui bloquent les cookies tiers -> SessionNotFound systématique.
        short: { path: '/', sameSite: 'lax' }
      },
      adapter: (name: string) => new RedisAdapter(name, this.redisClient),
      findAccount: async (context, accountId: string) => {
        let user: User

        // présent uniquement dans le cas d'un authorize
        if (context.oidc.result) {
          user = {
            userId: context.oidc.result.id as string,
            userRoles: context.oidc.result.userRoles as string[],
            userStructure: context.oidc.result.userStructure as User.Structure,
            userType: context.oidc.result.userType as User.Type,
            email: context.oidc.result.email as string,
            family_name: context.oidc.result.family_name as string,
            given_name: context.oidc.result.given_name as string,
            preferred_username: context.oidc.result.preferred_username as string
          }
        }
        // context non présent dans le cas d'un get/post token
        else {
          const account = Account.fromAccountIdToAccount(accountId)
          const apiUser = await this.passemploiapiService.getUser(account)
          if (isFailure(apiUser)) {
            if (apiUser.error.code === NonTrouveError.CODE) {
              rootLogger.warn(
                {
                  context: 'OidcService',
                  labels: { account_id: accountId },
                  error: toEcsError(apiUser.error)
                },
                'find_account_not_found'
              )
              // undefined = le compte n'existe pas pour findAccount, oidc-provider en déduit l'erreur selon le flow
              // flow token/refresh : lève un invalid_grant (400)
              // flow authorization : le check de policy voit account = undefined et force un re-login
              return undefined
            }
            const error = new Error('Could not get user from API')
            rootLogger.error(
              { context: 'OidcService', error: toEcsError(error) },
              'find_account_failed'
            )
            this.apmService.captureError(error)
            throw error
          }
          user = apiUser.data
        }
        return {
          ...user,
          accountId,
          claims: () => ({
            ...user,
            sub: Account.getSubFromAccountId(accountId)
          })
        }
      },
      claims: {
        openid: ['sub'],
        email: ['email'],
        profile: [
          'userId',
          'userRoles',
          'userStructure',
          'userType',
          'family_name',
          'given_name',
          'preferred_username'
        ]
      },
      extraTokenClaims: (context, _token) => {
        return {
          userId: context.oidc.account?.userId,
          userRoles: context.oidc.account?.userRoles,
          userStructure: context.oidc.account?.userStructure,
          userType: context.oidc.account?.userType,
          email: context.oidc.account?.email,
          family_name: context.oidc.account?.family_name,
          given_name: context.oidc.account?.given_name,
          preferred_username: context.oidc.account?.preferred_username,
          azp: context.oidc.client?.clientId
        }
      },
      features: {
        devInteractions: { enabled: false },
        userinfo: { enabled: true },
        resourceIndicators: {
          enabled: true,
          defaultResource: () => this.configService.get('ressourceServer.url')!,
          useGrantedResource: () => true,
          getResourceServerInfo: () => ({
            scope: this.configService.get('ressourceServer.scopes')!,
            accessTokenFormat: 'jwt',
            accessTokenTTL: 30 * 60
          })
        },
        rpInitiatedLogout: {
          enabled: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          logoutSource: async function logoutSource(ctx: any, form: any) {
            // @param ctx - koa request context
            // @param form - form source (id=""op.logoutForm"") to be embedded in the page and submitted by
            //   the End-User
            ctx.body = `<html>

            <head>
              <meta http-equiv="X-UA-Compatible" content="IE=edge">
              <meta charset="utf-8">
              <title>Portail de connexion</title>
              <style>
                @import url(https://fonts.googleapis.com/css?family=Roboto:400,100);
            
                body {
                  background-color: #f7f7ff;
                  font-family: Roboto, sans-serif;
                  margin-top: 100px;
                  margin-bottom: 25px;
                  text-align: center
                }
            
                .container {
                  width: 40vw;
                  padding: 5px;
                  margin: 0 auto;
                }
            
                button {
                  border: none;
                  outline: none;
                  color: rgb(59, 105, 209);
                  font-size: 14px;
                  font-weight: 700;
                  padding: 10px;
                  width: 100%;
                  border-radius: 10px;
                  background-color: #ffffff;
                }
            
                button:hover {
                  background-color: rgb(59, 105, 209);
                  color: white;
                }
              </style>
            </head>
            
            <body>
              <div class="container">
                ${form}
                <button autofocus type="submit" form="op.logoutForm" value="yes" name="logout">Déconnexion...</button>
              </div>
              <script type="text/javascript">
                document.querySelector('form[id="op.logoutForm"]').submit();
              </script>
            </body>
            
            </html>`
          }
        }
      },
      interactions: {
        policy,
        async url(ctx, interaction) {
          let doitPersister = false
          if (ctx.request.query.kc_idp_hint) {
            interaction.params.kc_idp_hint = ctx.request.query.kc_idp_hint
            doitPersister = true
          }
          if (ctx.request.query.installation_id) {
            interaction.params.installation_id =
              ctx.request.query.installation_id
            doitPersister = true
          }
          if (doitPersister) {
            await interaction.persist()
          }

          if (!interaction.params.kc_idp_hint) {
            return `/choice/${interaction.uid}`
          }

          const connector = `${interaction.params.kc_idp_hint}`

          switch (connector) {
            case 'invite':
              return `/invite/connect/${interaction.uid}`
            case 'similo-jeune':
              return `/milo-jeune/connect/${interaction.uid}`
            case 'similo-conseiller':
              return `/milo-conseiller/connect/${interaction.uid}`
            case 'pe-jeune': // retrocompat
              return `/francetravail-jeune/connect/${interaction.uid}?type=cej`
            case 'pe-brsa-jeune': // retrocompat
              return `/francetravail-jeune/connect/${interaction.uid}?type=brsa`
            case 'pe-aij-jeune': // retrocompat
              return `/francetravail-jeune/connect/${interaction.uid}?type=aij`
            case 'ft-beneficiaire':
              return `/francetravail-jeune/connect/${interaction.uid}?type=ft-beneficiaire`
            case 'ft-conseiller':
              return `/francetravail-conseiller/connect/${interaction.uid}`
            case 'pe-conseiller':
              return `/francetravail-conseiller/connect/${interaction.uid}?type=cej`
            case 'pe-brsa-conseiller':
              return `/francetravail-conseiller/connect/${interaction.uid}?type=brsa`
            case 'pe-aij-conseiller':
              return `/francetravail-conseiller/connect/${interaction.uid}?type=aij`
            case 'avenirpro-conseiller':
              return `/francetravail-conseiller/connect/${interaction.uid}?type=avenirpro`
            case 'conseildepartemental-conseiller':
              return `/conseildepartemental-conseiller/connect/${interaction.uid}`
            case 'ft-accompagnement-intensif-conseiller':
              return `/francetravail-conseiller/connect/${interaction.uid}?type=accompagnement-intensif`
            case 'ft-accompagnement-global-conseiller':
              return `/francetravail-conseiller/connect/${interaction.uid}?type=accompagnement-global`
            case 'ft-equip-emploi-recrut-conseiller':
              return `/francetravail-conseiller/connect/${interaction.uid}?type=equip-emploi-recrut`
            default:
              return `/choice/${interaction.uid}`
          }
        }
      }
    })

    this.oidc.registerGrantType(
      tokenExchangeGrantType,
      this.tokenExchangeGrant.handler,
      tokenExchangeParameters
    )

    this.oidc.proxy = true

    // Ancre de l'étape 1 (GET /authorize initial) : seul moment où l'uid de
    // l'interaction est connu AVANT que MiloJeuneController (et donc
    // ContextInterceptor) ne le reçoive en param de route. On pose l'uid dans
    // le RequestContext (et pas seulement dans ce log) pour que le
    // request_completed de CETTE MÊME requête /authorize (émis plus tard par
    // pino-http) hérite aussi de labels.interaction_id via le mixin — sinon il
    // ne serait retrouvable que par trace.id, un aller-retour en plus.
    this.oidc.on('interaction.started', (ctx: KoaContextWithOIDC) => {
      const interactionId = ctx.oidc?.entities?.Interaction?.uid
      this.requestContext.set(ContextKey.INTERACTION_ID, interactionId)
      const installationId = ctx.oidc?.params?.installation_id
      if (installationId) {
        this.requestContext.set(ContextKey.INSTALLATION_ID, installationId)
      }
      rootLogger.info(
        {
          context: 'OidcService',
          event: { action: 'login_flow_started', outcome: 'success' },
          labels: { idp: ctx.oidc?.params?.kc_idp_hint as string | undefined }
        },
        'login_flow_started'
      )
    })

    // Ancre de l'étape 5 (resume /auth/:uid, émission du code) : cette requête
    // est routée par OidcController (catch-all), pas par MiloJeuneController,
    // donc ContextInterceptor ne pose pas labels.interaction_id (pas de param
    // de route nommé). Sans ce log, seule l'URL contient l'uid (en substring,
    // non filtrable proprement) et aucun champ ne porte l'account_id.
    this.oidc.on('authorization.success', (ctx: KoaContextWithOIDC) => {
      rootLogger.info(
        {
          context: 'OidcService',
          event: { action: 'authorization_succeeded', outcome: 'success' },
          labels: {
            interaction_id: ctx.oidc?.entities?.Interaction?.uid,
            account_id: ctx.oidc?.account?.accountId,
            installation_id: ctx.oidc?.params?.installation_id as
              | string
              | undefined
          }
        },
        'authorization_succeeded'
      )
    })

    // Trace de succès du /token : sans elle, impossible de savoir si une boucle
    // de login vient de connect (grant_error) ou d'en aval (app mobile / api)
    this.oidc.on('grant.success', (ctx: KoaContextWithOIDC) => {
      rootLogger.info(
        {
          context: 'OidcService',
          event: { action: 'grant_succeeded', outcome: 'success' },
          grant: {
            type: ctx.oidc?.params?.grant_type,
            clientId: ctx.oidc?.client?.clientId
          },
          labels: { account_id: accountIdFromGrantContext(ctx) }
        },
        'grant_succeeded'
      )
    })

    // log error_detail avec la raison des erreurs de /token plutot que le message
    // generique par défaut de oidc-provider
    this.oidc.on('grant.error', (ctx: KoaContextWithOIDC, err) => {
      const grantType = ctx.oidc?.params?.grant_type
      const clientId = ctx.oidc?.client?.clientId
      const message = err.error_detail ?? 'n/a'
      // Les 4xx sont des erreurs client OAuth attendues (refresh expiré/déjà utilisé, "refresh token not found", compte supprimé, invalid_target...) on log en warn mais on n'inonde PAS l'APM avec
      // Seules les erreurs serveur (5xx) ou inattendues remontent en error + APM
      const status = err.status ?? err.statusCode
      const isExpectedClientError =
        typeof status === 'number' && status >= 400 && status < 500
      rootLogger[isExpectedClientError ? 'warn' : 'error'](
        {
          context: 'OidcService',
          event: { action: 'grant_error', outcome: 'failure' },
          grant: { type: grantType, clientId },
          labels: { account_id: accountIdFromGrantContext(ctx) },
          error: { type: err.error, message }
        },
        'grant_error'
      )
      if (!isExpectedClientError) {
        this.apmService.captureError(
          new Error(
            `grant.error grant_type=${grantType} client=${clientId} error=${err.error} detail=${message}`
          )
        )
      }
    })
  }

  // Below are the methods that you can use to interact with the oidc-provider library

  callback: Provider['callback'] = () => {
    try {
      return this.oidc.callback()
    } catch (e) {
      rootLogger.error(
        { context: 'OidcService', error: toEcsError(e) },
        'oidc_callback_failed'
      )
      this.apmService.captureError(
        e instanceof Error ? e : new Error(String(e))
      )
      throw e
    }
  }

  interactionDetails: Provider['interactionDetails'] = (req, res) => {
    return this.oidc.interactionDetails(req, res)
  }

  // Retrouve l'interaction via le `state` (qui transite par l'IDP) plutôt que via le
  // cookie `_interaction`, souvent perdu par les webviews/navigateurs mobiles à
  // l'aller-retour vers l'IDP -> SessionNotFound. Repli sur le cookie pour les
  // connexions en vol pendant un déploiement (state au format legacy / absent).
  async recoverInteraction(
    req: Request,
    res: Response
  ): Promise<OidcInteraction> {
    const state =
      typeof req.query.state === 'string' ? req.query.state : undefined
    const interactionId = decodeAuthStateInteractionId(state)
    if (interactionId) {
      const interaction = await this.oidc.Interaction.find(interactionId)
      if (interaction) {
        return interaction
      }
    }
    return this.oidc.interactionDetails(req, res)
  }

  // Mode invité : aucun aller-retour vers un IDP externe, donc ni `state` ni
  // dépendance au cookie `_interaction`. L'uid vient directement du path.
  async findInteraction(
    interactionId: string
  ): Promise<OidcInteraction | undefined> {
    return this.oidc.Interaction.find(interactionId)
  }

  // Termine l'interaction SANS lire le cookie de la requête (contrairement à
  // interactionFinished -> interactionResult -> #getInteraction qui l'exige). On écrit
  // le résultat puis on re-pose `_interaction`/`_interaction_resume` : la reprise
  // /auth/:uid étant une navigation même-site immédiate, le cookie fraîchement posé
  // repart, même si l'original a été perdu pendant l'aller-retour vers l'IDP externe.
  async finishInteraction(
    res: Response,
    interaction: OidcInteraction,
    result: InteractionResults
  ): Promise<void> {
    interaction.result = { ...(interaction.lastSubmission ?? {}), ...result }
    const nowSeconds = Math.floor(Date.now() / 1000)
    await interaction.save(interaction.exp - nowSeconds)

    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
      maxAge: Math.max(1, interaction.exp - nowSeconds) * 1000
    }
    res.cookie(INTERACTION_COOKIE, interaction.uid, {
      ...cookieOptions,
      path: '/'
    })
    res.cookie(INTERACTION_RESUME_COOKIE, interaction.uid, {
      ...cookieOptions,
      path: new URL(interaction.returnTo).pathname
    })

    res.redirect(303, interaction.returnTo)
  }

  interactionFinished: Provider['interactionFinished'] = (req, res, result) => {
    return this.oidc.interactionFinished(req, res, result)
  }

  interactionResult: Provider['interactionResult'] = (req, res, result) => {
    return this.oidc.interactionResult(req, res, result)
  }

  getProvider(): Provider {
    return this.oidc
  }

  createGrant(accountId: string, clientId: string) {
    return new this.oidc.Grant({
      accountId,
      clientId
    })
  }

  findGrant(grantId: string) {
    return this.oidc.Grant.find(grantId)
  }

  private logErrors(errors: ErrorOut, cause?: unknown): string {
    // ErrorOut est un objet pas reconnue par toEcsError, il faut mettre cause dans toEcsError
    rootLogger.error(
      {
        context: 'OidcService',
        error: {
          type: errors.error ?? 'Unknown',
          message: errors.error_description ?? JSON.stringify(errors),
          ...(cause !== undefined && { cause: toEcsError(cause) })
        }
      },
      'oidc_render_error'
    )
    if (this.configService.get('environment') !== 'prod') {
      return Object.entries(errors)
        .map(([key, value]) => {
          this.apmService.captureError(`${key}: ${sanitizeHtml(value)}`)
          return `<pre><strong>${key}</strong>: ${sanitizeHtml(value)}</pre>`
        })
        .join('')
    }
    return '<p>Veuillez réessayer plus tard</p>'
  }
}

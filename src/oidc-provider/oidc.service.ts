/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Inject, Injectable, Logger } from '@nestjs/common'

import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { ErrorOut, JWKS } from 'oidc-provider'
import { Account } from '../domain/account'
import { User } from '../domain/user'
import { PassEmploiAPIClient } from '../api/pass-emploi-api.client'
import { RedisAdapter } from '../redis/redis.adapter'
import { RedisInjectionToken } from '../redis/redis.provider'
import { OIDC_PROVIDER_MODULE, OidcProviderModule, Provider } from './provider'
import {
  TokenExchangeGrant,
  grantType as tokenExchangeGrantType,
  parameters as tokenExchangeParameters
} from './token-exchange.grant'
import * as sanitizeHtml from 'sanitize-html'
import { isFailure } from '../utils/result/result'
import * as APM from 'elastic-apm-node'
import { getAPMInstance } from '../utils/monitoring/apm.init'

@Injectable()
export class OidcService {
  private readonly logger: Logger
  private readonly oidc: Provider
  private readonly jwks: JWKS
  protected apmService: APM.Agent

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

    this.logger = new Logger('OidcService')
    this.apmService = getAPMInstance()

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
        RefreshToken: 3600 * 24 * 42,
        // Les autorisations accordés dans le Grant sont valables pour tout les access obtenus à partir d'une même refresh, sans limite de temps supplémentaire (donc ISO refresh)
        Grant: 3600 * 24 * 42,
        Session: 3600 * 24 * 42,
        AccessToken: 60 * 30,
        IdToken: 60 * 30,
        // Quand un IDP fait du 2FA avec SMS, on considère qu'un SMS peut mettre jusqu'à 10min pour arriver, on rajoute donc une marge dessus parce qu'il y a des écrans et actions à faire avant et après, ça donne 12 à 15 min
        Interaction: 60 * 60
      },
      issueRefreshToken: async function issueRefreshToken(_ctx, client, _code) {
        return client.grantTypeAllowed('refresh_token')
      },
      extraParams: ['kc_idp_hint'],
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
      renderError: (ctx, out, _error) => {
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
            ${this.logErrors(out)}
          </div>
        </body>
        
        </html>`
      },
      cookies: {
        short: { path: '/', sameSite: 'none' }
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
            if (context.oidc.entities.Session) {
              await context.oidc.entities.Session.destroy()
            }
            this.logger.error('Could not get user from API')
            const error = new Error('Could not get user from API')
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
        async url(ctx, interaction) {
          if (ctx.request.query.kc_idp_hint) {
            interaction.params.kc_idp_hint = ctx.request.query.kc_idp_hint
            await interaction.persist()
          }

          if (!interaction.params.kc_idp_hint) {
            return `/choice/${interaction.uid}`
          }

          const connector = `${interaction.params.kc_idp_hint}`

          switch (connector) {
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
  }

  // Below are the methods that you can use to interact with the oidc-provider library

  callback: Provider['callback'] = () => {
    try {
      return this.oidc.callback()
    } catch (e) {
      this.logger.error(e)
      this.apmService.captureError(e)
      throw e
    }
  }

  interactionDetails: Provider['interactionDetails'] = (req, res) => {
    return this.oidc.interactionDetails(req, res)
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

  private logErrors(errors: ErrorOut): string {
    this.logger.error(errors)
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

# Logs ECS — pass-emploi-connect — Design

> Date : 2026-05-22
> Refonte du logging de connect au format ECS, homogène avec pass-emploi-api
> (refonte mergée PR #228, en prod).

## Contexte

Le logging actuel de connect est pré-refonte : `new Logger('Contexte')` ad-hoc
dans ~40 endroits, erreurs freeform non-ECS, pas de `event.action`, pas de
corrélation cross-flow. Un incident de connexion est aujourd'hui difficilement
investigable : un parcours de login s'étale sur **plusieurs requêtes HTTP
séparées**, sans identifiant qui les relie.

Le socle de conventions ECS est **transverse** (partagé api / connect / web) et
déjà figé côté api. Référentiel :

- Conventions : `pass-emploi-api/memory/logs-ecs/transverse/conventions.md`
- Infra Elasticsearch : `.../transverse/infra-elasticsearch.md`
- Use cases Kibana : `.../transverse/kibana.md`

Ce design n'en redéfinit rien : il décrit l'**implémentation connect** de ce
socle et la **taxonomie `event.action` spécifique** au repo.

## Finalité prioritaire

Rendre un **incident de connexion investigable** — équivalent du « RDV Milo »
côté api. Cas déclencheur : un jeune qui n'arrive pas à se connecter via MiLo
(app → connect → `id.pass-emploi` → `sso.i-milo.fr`) doit laisser une trace
reconstituable d'un seul filtre Kibana.

## Décisions structurantes

1. **Ampleur** : refonte complète, homogène avec l'api (socle + taxonomie +
   migration de tous les `new Logger()`).
2. **Corrélation** : `interaction.uid` comme clé de parcours login, propagée via
   un `AsyncLocalStorage`.
3. **Appels sortants** : base class `ExternalApiClient` pour les clients axios +
   helper de log explicite pour les appels `openid-client`.
4. **Granularité login** : trois événements — `login_initiated`,
   `login_redirected`, `login_completed`/`login_failed`.

---

## Section 1 — Socle technique

Réécriture de `src/utils/monitoring/logger.module.ts` sur le modèle de
`pass-emploi-api/src/utils/logger.module.ts`.

### `rootLogger`

Singleton pino unique, partagé par `pino-http` **et** le code applicatif.
Utilisation partout :

```ts
rootLogger.info({ event: { action: 'login_completed', outcome: 'success' } }, 'login_completed')
```

Pas de wrapper, pas de DI.

### `mixin`

Injecté sur chaque log :

- `trace.id` / `transaction.id` — depuis APM (`getAPMInstance().currentTraceIds`).
- `user.{id,type,structure}` — depuis le `Context`, quand l'utilisateur est connu.
- `http.request.id` — depuis le `Context`.
- `labels.interaction_id` — depuis le `Context` : la clé de parcours login.

`mixinMergeStrategy` (deep merge) porté à l'identique de l'api : sans lui pino
fait un shallow merge qui écrase les blocs ECS nested.

### Helpers portés à l'identique depuis l'api

- `toEcsError(error)` — conversion ECS `error.{type,message,stack_trace}`,
  gère Error JS / erreur métier (code/message) / valeur inconnue.
- `isSensitiveKey` + `SENSITIVE_KEY_PATTERNS` — redaction par fragment de clé.
- `redactDeep` — masquage récursif des secrets.
- `serializeBodyForLog` + `truncateBody` — sérialisation des bodies (JSON /
  form-urlencoded / URLSearchParams), tronqués à 4 Ko, binaire/stream gérés.
- `pinoSerializers` — serializers `req` / `res` / `err`.
- `mixinMergeStrategy` / `deepMerge`.

### pino-http

`request_completed` / `request_failed`, `customLogLevel` (`error` si 5xx ou
exception), bodies logués sur échec (et sur succès si `LOG_LEVEL=debug`).
Ignore `/health` (déjà en place).

### `Context` — nouveau module `AsyncLocalStorage`

Nouveau module calqué sur `pass-emploi-api/src/building-blocks/context.ts`.

- Nommage : **`RequestContext`** (et non `Context`) pour éviter toute confusion
  avec le `ContextStorage` Redis existant — qui est un store de config
  issuer/client sans rapport. Le renommage de `ContextStorage` est **hors scope**
  de cette refonte.
- Clés portées : `INTERACTION_ID`, `USER`, `HTTP_REQUEST_ID`.
- Démarré par un middleware en début de requête (`enterWith(new Map())`).

---

## Section 2 — Corrélation du parcours login

Un login s'étale sur plusieurs requêtes : `/auth` → `/{idp}/connect/{uid}` →
redirection IDP externe → `/broker/{idp}/endpoint`. L'APM `trace.id` est
per-requête et ne traverse pas le flow.

**`interaction.uid`** devient le pivot. Il est créé au `/auth`, passé en `nonce`
à l'IDP, présent dans l'URL `/{idp}/connect/{uid}`, et récupérable au callback
via `interactionDetails()`. Il identifie un parcours de login complet.

Propagation via le `RequestContext` :

| Étape | Source de `interaction.uid` |
|---|---|
| `/{idp}/connect/{uid}` | param de route — posé dans le `Context` par un middleware |
| `/broker/{idp}/endpoint` (callback) | `interactionDetails(req, res).uid` — posé dès obtention dans `IdpService.callback` |
| `/auth` initial | l'interaction est créée *dans* oidc-provider → son `request_completed` n'a pas l'`interaction_id`. **Limite assumée** — tout le reste du parcours l'a. |

`user.*` est enrichi dans le `Context` une fois l'utilisateur identifié au
callback (après `putUser`), de sorte que les logs suivants portent `user.id`.

Recherche Kibana : `labels.interaction_id: "<uid>"` reconstitue le parcours.

---

## Section 3 — Taxonomie `event.action` (spécifique connect)

| `event.action` | `log.logger` | site d'émission |
|---|---|---|
| `request_completed` / `request_failed` | _absent_ | requête HTTP entrante (pino-http) |
| `login_initiated` | `<Idp>IdpService` | entrée `/{idp}/connect/{uid}` — l'utilisateur a choisi un IDP |
| `login_redirected` | `<Idp>IdpService` | `getAuthorizationUrl` — succès/échec de construction de l'URL IDP |
| `login_completed` / `login_failed` | `<Idp>IdpService` | fin de `callback()` ; sur échec → champ `login.step` |
| `external_api_call` | `PassEmploiApiClient`, `FrancetravailApiClient`, `<Idp>` | appel HTTP sortant (axios + openid-client) |
| `token_issued` / `token_failed` | `TokenExchangeGrant` | grant token-exchange (client api) |
| `token_refreshed` | `GetAccessTokenUsecase` | refresh de l'access token IDP |
| `account_deleted` | `DeleteAccountUsecase` | suppression de compte |
| `request_routed` | _absent_ | router Scalingo (émis par Logstash — déjà en place) |

### Champs spécifiques connect

- **`login.step`** : reprend la state-machine `codeErreur` existante de
  `IdpService.callback` (`CallbackParams`, `SessionNotFound`, `Callback`,
  `UserInfo`, `Coordonnees`, `ApiPassEmploi`, `Grant`, `CreateSession`,
  `SetAccess`, `SetRefresh`, `SaveSession`). Posé sur `login_failed` — pointe
  exactement où le login casse.
- **`labels.idp`** : quel IDP (`milo-jeune`, `milo-conseiller`,
  `francetravail-jeune`, `francetravail-conseiller`,
  `conseildepartemental-conseiller`).

### `event.outcome` / `level`

Conventions transverses : `outcome` ∈ `success`/`failure` ; `level` ∈
`info`/`error`, **dérivé de la nature de l'erreur** (crash vs échec géré), pas de
sa simple présence. Pas de `warn`.

---

## Section 4 — Appels sortants (`external_api_call`)

Deux familles d'appels sortants, instrumentées différemment :

### Clients axios — base class `ExternalApiClient`

`PassEmploiApiClient` et `FrancetravailApiClient` héritent d'une base class
`ExternalApiClient` calquée sur le Template Method de l'api : émission
automatique de `external_api_call` avec `outcome`, `event.duration`, `http.*`,
`url.*`, `error.*`, bodies sur échec.

### Appels `openid-client` — helper explicite

`openid-client` v5 n'est pas axios. Les appels IDP (`client.callback()`,
`client.userinfo()`) dans `IdpService` sont entourés d'un helper explicite
`logExternalCall(...)` qui émet le même `external_api_call` ECS (mêmes champs,
même format) autour de l'appel.

Ces appels IDP sont précisément ceux qui cassent lors d'un incident MiLo : ils
doivent être visibles avec leur latence et leur erreur.

---

## Section 5 — Migration des `new Logger()`

Remplacement des ~40 `new Logger('X')` / `buildError` ad-hoc par des appels
`rootLogger.<level>({ event, ... }, action)`.

- Les erreurs freeform (`'Callback PUT user error'`, `'Could not get user from
  API'`, `'REDIS UPSERT ERROR'`…) deviennent des événements ECS structurés.
- `apmService.captureError(...)` est **conservé en parallèle** : le monitoring
  APM et les logs sont deux canaux distincts.
- Les `this.logger.debug(...)` existants (dump de tokens dans
  `get-access-token.usecase`) passent par la redaction (`serializeBodyForLog` /
  `isSensitiveKey`) — un token ne doit jamais sortir en clair.

Fichiers concernés (non exhaustif) : `idp/service/idp.service.ts`,
`oidc-provider/oidc.service.ts`, `oidc-provider/token-exchange.grant.ts`,
`oidc-provider/oidc.controller.ts`, les 5 controllers IDP, `token/*.ts`,
`account/delete-account.usecase.ts`, `api/*.client.ts`, `redis/*.ts`.

---

## Cas de validation end-to-end : login MiLo jeune

Trace attendue pour un login MiLo jeune réussi (filtrer sur
`labels.interaction_id`) :

1. `request_completed` `/{idp}/connect/{uid}`
2. `login_initiated` (`MiloJeuneIdpService`)
3. `login_redirected` (success)
4. `request_completed` `/broker/milo-jeune/endpoint`
5. `external_api_call` `<Idp>` — token exchange openid-client (success)
6. `external_api_call` `<Idp>` — userinfo openid-client (success)
7. `external_api_call` `PassEmploiApiClient` — `putUser` (success)
8. `login_completed` (success)

Sur échec : `login_failed` porte `login.step` (ex. `UserInfo` si l'IDP ne
répond pas) et `error.*`.

## Hors scope

- Renommage de `ContextStorage` (store Redis config issuer/client).
- Templates Elasticsearch / Logstash : le socle ECS transverse est déjà en
  place ; tout nouveau sous-namespace de champ (`login.*`) demandera un ajout
  dans `logstash.conf` — à vérifier au moment de l'implémentation.

## Vérifications (cf CLAUDE.md)

- `yarn build` — compilation TypeScript
- `yarn lint` — ESLint
- `yarn test:local` — tests unitaires
</content>
</invoke>

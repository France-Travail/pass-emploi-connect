# Pass Emploi Connect

> Broker OIDC (NestJS + `oidc-provider`) : point d'entrée unique devant les IdP partenaires, émet les
> tokens des apps Pass Emploi. Versions : `package.json` et `.nvmrc`. Toujours `yarn`.

@../pass-emploi-tools/docs/CONTEXTE-TRANSVERSE.md

---

## Vérifications après modification

| Vérification | Commande                                                          |
|--------------|-------------------------------------------------------------------|
| Typecheck    | `yarn tsc --noEmit`                                               |
| Lint         | `yarn lint` / `yarn lint:fix`                                     |
| Tests        | `yarn test:local` (Vitest, démarre Redis Docker)                  |
| Un fichier   | `yarn test:local test/chemin/fichier.test.ts`                     |

Depuis un worktree, `yarn test:local` échoue : le conteneur Redis (`cej-auth-redis`) a un nom
fixe, et le script ne charge pas `.environment`. Réutiliser le Redis déjà lancé, sur une base
isolée :
`REDIS_URL=redis://:myredispassword@localhost:6777/15 yarn dotenv -e ../pass-emploi-connect/.environment -- vitest run`

Pas de scan sécurité local : il ne tourne qu'en CI (`security-checks.yml`).

---

## Architecture

- `src/idp/` : un module par IdP (`milo-jeune`, `milo-conseiller`, `francetravail-jeune`,
  `francetravail-conseiller`, `conseildepartemental-conseiller`, `invite`), tous sur `idp/service/IdpService`.
- `src/oidc-provider/` : config et serveur OIDC (`oidc.service.ts` : clients `api`/`web`/`app`/`swagger`, TTL,
  grant custom `token-exchange.grant.ts`).
- `src/token/`, `src/account/` (suppression de compte), `src/api/` (clients pass-emploi-api, France Travail),
  `src/redis/` (adapter `oidc-provider`), `src/utils/result/` (Result monad, comme l'API).
- Tests : `test/`, structure miroir. Vitest + Sinon pour les stubs.
- Doc à côté du code : `docs/flow-authentification.md`, `docs/stockage-redis.md` (clés, TTL, nettoyage),
  `docs/runbook-revocation-acces.md`.

### Invariants

- **Pas de SQL** : tout l'état est dans Redis ; le service ne démarre pas sans.
- **Account ID** = `TYPE|STRUCTURE|SUB` (parser : `src/domain/account.ts`).
- Infos utilisateur enrichies via pass-emploi-api après l'auth IdP.
- **Refresh token sans rotation** : TTL compté depuis le login, sauf invité (jamais expiré).
- Nouvelles clés JWKS : `yarn generate-key-pair`.

---

## Conventions de code

Prettier et ESLint font foi. Points non évidents : `no-console` → logger ; `no-process-env` →
`ConfigService` ; variables inutilisées préfixées `_`. Nommage : `{Structure}{Type}IdpService`,
`{Service}ApiClient`, `{Type}AuthGuard`, `{Action}Usecase`.

---

## Développement local

`yarn watch` (`.environment` tel quel), `yarn watch:local` (connect branché sur pass-emploi-api local),
`yarn watch:staging` (API staging) ; mêmes variantes en `start:*`.

`.environment.api-local` / `.environment.api-staging` sont **committés et sans secret**, chargés avant
`.environment` (premier fichier gagne). En `:local`, sans nginx ni `/etc/hosts`, seuls les flows sans IdP
externe (invité) fonctionnent : les redirect URIs des IdP sont enregistrées sur le domaine staging.

Flows avec IdP en local : `docker compose up --build --watch` (nginx-proxy), avec
`127.0.0.1 id.pass-emploi.incubateur.net` dans `/etc/hosts` et un certificat `mkcert` :

```bash
mkcert -cert-file certs/id.pass-emploi.incubateur.net.crt \
       -key-file certs/id.pass-emploi.incubateur.net.key \
       id.pass-emploi.incubateur.net
```

Secrets : dotvault (voir `CONTEXTE-TRANSVERSE.md`). Prod sur la branche **`main`**.

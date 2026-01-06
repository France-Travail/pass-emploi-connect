# Pass Emploi Connect - Contexte Technique

> Service d'authentification OIDC centralisé
> Voir le contexte global Pass Emploi dans `pass-emploi-api/CLAUDE.md` (section "Contexte Global")

---

## Rôle

**Pass Emploi Connect** est un broker d'authentification OIDC qui fédère plusieurs Identity Providers (IDPs) en un point
d'entrée unique pour les applications Pass Emploi.

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  App Mobile     │     │                     │     │ France Travail  │
│  (Flutter)      │────►│  Pass Emploi        │────►│ IDP (OIDC)      │
├─────────────────┤     │  Connect            │     ├─────────────────┤
│  App Web        │────►│  (OIDC Server)      │────►│ MILO IDP        │
│  (Next.js)      │     │                     │     │ (OIDC)          │
└─────────────────┘     └─────────────────────┘     ├─────────────────┤
                                                    │ Conseil Dept.   │
                                                    │ (OIDC)          │
                                                    └─────────────────┘
```

---

## Stack Technique

### Framework & Runtime

| Technologie         | Version    | Notes                    |
|---------------------|------------|--------------------------|
| **NestJS**          | 11.0.0     | Framework principal      |
| **TypeScript**      | 5.0        | Config stricte           |
| **Node.js**         | 22.14.0    | Défini dans `.nvmrc`     |
| **Package Manager** | Yarn 4.9.3 | Toujours utiliser `yarn` |

### OIDC & Auth

| Technologie       | Version | Usage                            |
|-------------------|---------|----------------------------------|
| **oidc-provider** | 9.2.0   | Serveur OIDC                     |
| **openid-client** | 5.6.5   | Client OIDC pour brokers         |
| **jose**          | 5.2.4   | JWT signing/verification (RS256) |

### Stockage

| Technologie | Version              | Usage                    |
|-------------|----------------------|--------------------------|
| **Redis**   | (ioredis 5.3.2)      | Stockage sessions/tokens |
| **Docker**  | redis-stack:7.2.0-v9 | Image locale             |

**Note :** Pas de base de données SQL en production, seulement Redis.

### Autres dépendances

- `axios@1.7.4` : Client HTTP
- `nestjs-pino@4.0.0` : Logging structuré
- `elastic-apm-node@3.52.2` : Monitoring APM
- `sanitize-html@2.13.0` : Protection XSS
- `luxon@3.4.4` : Manipulation dates

### Testing

| Outil     | Version | Usage       |
|-----------|---------|-------------|
| **Mocha** | -       | Test runner |
| **Chai**  | -       | Assertions  |
| **Sinon** | -       | Mocking     |
| **NYC**   | -       | Coverage    |

---

## Architecture

### Structure des dossiers

```
src/
├── app.module.ts                # Module racine
├── app.controller.ts            # Health check + Delete account
├── main.ts                      # Point d'entrée (APM init)
│
├── idp/                         # Identity Providers
│   ├── service/                 # Service abstrait IDP
│   ├── milo-conseiller/
│   ├── milo-jeune/
│   ├── francetravail-conseiller/
│   │   └── (sous-services: CEJ, BRSA, AIJ, etc.)
│   ├── francetravail-jeune/
│   └── conseildepartemental-conseiller/
│
├── oidc-provider/               # Serveur OIDC
│   ├── oidc.service.ts
│   ├── oidc.controller.ts
│   ├── provider.ts              # Config oidc-provider
│   ├── token-exchange.grant.ts  # Custom grant
│   └── oidc.module.ts
│
├── token/                       # Gestion tokens
│   ├── token.service.ts
│   └── token.module.ts
│
├── account/                     # Suppression compte
│   ├── delete-account.usecase.ts
│   └── account.module.ts
│
├── redis/                       # Client Redis
│   ├── redis.client.ts
│   ├── redis.adapter.ts         # Adapter pour OIDC
│   ├── redis.provider.ts
│   └── redis.module.ts
│
├── api/                         # Clients HTTP externes
│   ├── pass-emploi-api.client.ts
│   ├── francetravail-api.client.ts
│   └── api.module.ts
│
├── domain/                      # Domain models
│   ├── user.ts                  # Types utilisateur
│   ├── account.ts               # Format: "TYPE|STRUCTURE|SUB"
│   └── error.ts
│
├── config/                      # Configuration
│   ├── configuration.ts         # Loader avec Joi validation
│   └── configuration.schema.ts
│
├── guards/                      # Auth guards
│   └── api-key.auth-guard.ts
│
└── utils/
    ├── result/                  # Result pattern
    │   ├── result.ts            # Success/Failure
    │   └── result.handler.ts
    └── monitoring/              # APM + Logging
```

### Patterns

**Result Monad :**

```typescript
import { Result, success, failure } from './utils/result/result'

// Retourner succès/échec
return success(data)
return failure(new NonTrouveError())
```

**Service abstrait IDP :**

```typescript
// Chaque IDP étend IdpService
abstract class IdpService {
  abstract getAuthorizationUrl(): string

  abstract exchangeCode(code: string): Promise<Result<Token>>

  abstract getUserInfo(token: string): Promise<Result<User>>
}
```

---

## Identity Providers intégrés

### 5 IDPs configurés

| IDP                           | Public                       | Sous-types                                                              |
|-------------------------------|------------------------------|-------------------------------------------------------------------------|
| **France Travail Conseiller** | Conseillers                  | CEJ, BRSA, AIJ, AveninPro, Accomp. Intensif/Global, Equip Emploi Recrut |
| **France Travail Jeune**      | Bénéficiaires                | BRSA, Standard                                                          |
| **MILO Conseiller**           | Conseillers Mission Locale   | -                                                                       |
| **MILO Jeune**                | Bénéficiaires Mission Locale | -                                                                       |
| **Conseil Départemental**     | Conseillers                  | -                                                                       |

### Flux d'authentification

```
1. Client (Web/App) → Pass-Emploi-Connect
   GET /auth/realms/pass-emploi/protocol/openid-connect/auth

2. Pass-Emploi-Connect → IDP externe
   Redirection vers l'IDP choisi

3. IDP → Pass-Emploi-Connect (callback)
   Code d'autorisation

4. Pass-Emploi-Connect → Pass-Emploi-API
   Enrichissement des infos utilisateur

5. Pass-Emploi-Connect → Client
   Access Token + ID Token (JWT RS256)
```

---

## Endpoints OIDC

### Routes principales

| Endpoint                                                    | Description           |
|-------------------------------------------------------------|-----------------------|
| `/auth/realms/pass-emploi/protocol/openid-connect/auth`     | Authorization         |
| `/auth/realms/pass-emploi/protocol/openid-connect/token`    | Token exchange        |
| `/auth/realms/pass-emploi/protocol/openid-connect/userinfo` | User info             |
| `/auth/realms/pass-emploi/protocol/openid-connect/certs`    | JWKS (clés publiques) |
| `/auth/realms/pass-emploi/protocol/openid-connect/logout`   | Logout                |
| `/auth/realms/pass-emploi/protocol/openid-connect/revoke`   | Token revocation      |
| `/.well-known/openid-configuration`                         | Discovery             |

### Routes broker

| Endpoint                                         | Description  |
|--------------------------------------------------|--------------|
| `/auth/realms/pass-emploi/broker/{idp}/endpoint` | Callback IDP |

### TTLs des tokens

| Token         | Durée      |
|---------------|------------|
| Access Token  | 30 minutes |
| Refresh Token | 42 jours   |
| Session       | 42 jours   |
| Interaction   | 1 heure    |

---

## Conventions de code

### Prettier

```json
{
  "tabWidth": 2,
  "semi": false,
  "singleQuote": true,
  "trailingComma": "none",
  "arrowParens": "avoid"
}
```

### ESLint (règles importantes)

- `no-console`: error → utiliser le logger
- `no-process-env`: error → utiliser ConfigService
- `@typescript-eslint/explicit-function-return-type`: error
- `@typescript-eslint/no-explicit-any`: error
- Variables inutilisées ignorées avec préfixe `_`

### Nommage

| Type        | Convention                    | Exemple                    |
|-------------|-------------------------------|----------------------------|
| Service IDP | `{Structure}{Type}IdpService` | `MiloConseillerIdpService` |
| Client API  | `{Service}ApiClient`          | `PassEmploiApiClient`      |
| Guard       | `{Type}AuthGuard`             | `ApiKeyAuthGuard`          |
| Usecase     | `{Action}Usecase`             | `DeleteAccountUsecase`     |

---

## Scripts disponibles

### Développement

| Commande              | Description                              |
|-----------------------|------------------------------------------|
| `yarn watch`          | Dev server avec hot reload + logs pretty |
| `yarn start:debug`    | Avec debugger                            |
| `yarn start:redis:db` | Démarrer Redis (Docker)                  |

### Build & Lint

| Commande        | Description              |
|-----------------|--------------------------|
| `yarn build`    | Build TypeScript (dist/) |
| `yarn lint`     | ESLint check             |
| `yarn lint:fix` | ESLint auto-fix          |

### Tests

| Commande          | Description            |
|-------------------|------------------------|
| `yarn test:local` | Tests avec Redis local |
| `yarn test:ci`    | Tests CI avec coverage |
| `yarn cover`      | Coverage report        |

### Utilitaires

| Commande                 | Description                            |
|--------------------------|----------------------------------------|
| `yarn generate-key-pair` | Générer une paire de clés JWKS (RS256) |

### Release

| Commande             | Description   |
|----------------------|---------------|
| `yarn release:patch` | Version patch |
| `yarn release:minor` | Version minor |
| `yarn release:major` | Version major |

---

## Développement local

### Prérequis

1. **Hosts** : Ajouter dans `/etc/hosts` :
   ```
   127.0.0.1 id.pass-emploi.incubateur.net
   ```

2. **Certificats HTTPS** :
   ```bash
   mkcert -cert-file certs/id.pass-emploi.incubateur.net.crt \
          -key-file certs/id.pass-emploi.incubateur.net.key \
          id.pass-emploi.incubateur.net
   ```

3. **Variables d'environnement** :
   ```bash
   # Récupérer DOTVAULT_KEY sur Dashlane
   npx dotvault decrypt
   ```

### Démarrage

```bash
# Avec Docker Compose (recommandé)
docker compose up --build --watch

# Ou manuellement
yarn start:redis:db
yarn watch
```

### Ports

| Service         | Port |
|-----------------|------|
| API (interne)   | 5000 |
| API (exposé)    | 8082 |
| Debug Node      | 9229 |
| Redis           | 6777 |
| Redis Dashboard | 8001 |

---

## Configuration

### Clients OIDC

4 clients configurés :

| Client    | Usage                           |
|-----------|---------------------------------|
| `web`     | Application web conseiller      |
| `app`     | Application mobile bénéficiaire |
| `api`     | Backend API                     |
| `swagger` | Documentation API               |

Chaque client a :

- `CLIENT_ID`, `CLIENT_SECRET`
- `CALLBACKS` (URLs de callback autorisées)
- `LOGOUT_CALLBACKS`, `ERROR_CALLBACK`

### Variables d'environnement principales

**Serveur :**

- `PORT` : 5050 (default)
- `PUBLIC_ADDRESS` : URL publique
- `ENVIRONMENT` : prod | staging
- `CORS_ALLOWED_ORIGINS` : JSON array

**IDPs (5 * ~10 vars) :**

- `IDP_{NAME}_ISSUER`, `AUTHORIZATION_URL`, `TOKEN_URL`
- `IDP_{NAME}_JWKS`, `USERINFO`, `LOGOUT`
- `IDP_{NAME}_CLIENT_ID`, `CLIENT_SECRET`
- `IDP_{NAME}_SCOPES`, `REDIRECT_URI`

**Autres :**

- `JWKS` : Clés privées (JSON)
- `REDIS_URL`
- `PASS_EMPLOI_API_URL`, `PASS_EMPLOI_API_KEY`
- `AUTHORIZED_API_KEYS` : JSON array

---

## CI/CD

### GitHub Actions

**Workflow principal (`github-actions.yml`) :**

- Trigger : push sur `develop`/`master`, PR
- Services : Redis 8-alpine
- Jobs : Install → Lint → Test → SonarQube

**Autres workflows :**

- `codeql.yml` : Scan sécurité CodeQL
- `semgrep-*.yml` : Analyse SAST
- `sonar-scheduled.yml` : Scan SonarCloud hebdomadaire

### Déploiement (Scalingo)

| Environnement | Branche   | Déclenchement |
|---------------|-----------|---------------|
| Staging       | `develop` | Automatique   |
| Production    | `master`  | Automatique   |

---

## Sécurité

### Authentification des appels

- **Endpoints publics** : Authorization, Token, Discovery
- **Endpoints protégés** : Delete account → `ApiKeyAuthGuard`

### Tokens

- **Signing** : RS256 (asymétrique)
- **JWKS** : Clés publiques exposées sur `/certs`
- **Rotation** : Refresh token avec rotation automatique

### Bonnes pratiques

- CORS configuré par environnement
- HTTPS obligatoire en production
- Sanitization HTML sur les inputs
- Logging APM des erreurs

---

## Points d'attention

1. **Génération de clés** : Utiliser `yarn generate-key-pair` pour créer de nouvelles clés JWKS
2. **Redis obligatoire** : Le service ne démarre pas sans Redis
3. **IDPs multiples** : Un même utilisateur peut s'authentifier via différents IDPs selon son type
4. **Format Account ID** : `TYPE|STRUCTURE|SUB` (parser dans `domain/account.ts`)
5. **Enrichissement** : Les infos utilisateur sont enrichies via l'API Pass Emploi après auth IDP

---

## Glossaire

Voir le glossaire complet dans `pass-emploi-api/CLAUDE.md` (section "Contexte Global").
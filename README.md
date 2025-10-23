# Pass Emploi Connect

Un service d’authentification OIDC qui fédère des IdP tiers (France Travail, i‑Milo, etc.) pour l’écosystème Pass Emploi.

![Node](https://img.shields.io/badge/Node-22.x-339933?logo=node.js&logoColor=white) ![NestJS](https://img.shields.io/badge/NestJS-Framework-e0234e?logo=nestjs&logoColor=white) ![License](https://img.shields.io/badge/License-MIT-blue)

## Pré-requis <a name="pré-requis"></a>

- Installer nvm (Node Version Manager) - https://github.com/nvm-sh/nvm
- Faire un `nvm use` (version dans .nvmrc)
- Docker et docker compose
- Lancer `yarn`

## Récupérer les variables d'environnement

Le fichier d'env est chiffré et versionné

1. Créer un fichier `.environment` en copiant le `.environment.template`
2. Mettre la valeur `DOTVAULT_KEY` indiquée sur **Vaultwarden**
3. Exécuter `dotvault decrypt`
4. **Ajouter/Modifier** les vars d'env : `dotvault encrypt`

## Lancer l'application en local

- S'assurer que `localhost` pointe sur `id.pass-emploi.incubateur.net` en **https**
- `sudo nano /etc/hosts` et ajouter la ligne `127.0.0.1 id.pass-emploi.incubateur.net`
- Générer des certificats pour le **https** : `mkdir -p certs && mkcert -install && mkcert -cert-file certs/id.pass-emploi.incubateur.net.crt -key-file certs/id.pass-emploi.incubateur.net.key id.pass-emploi.incubateur.net`
- `docker compose up --build --watch`

## Lancer les tests

- `yarn test`

## Mettre en production

### Cas 1 — Release standard (depuis `develop`)

1. Se positionner sur la branche `develop` et pull
2. Faire une nouvelle release `yarn release:<level: patch | minor | major>`
3. `git push --tags`
4. `git push origin develop`
5. OPTIONNEL : Créer la PR depuis `develop` sur `master` (pour vérifier les changements)
6. Se positionner sur `master` et pull
7. `git merge develop` sur `master`
8. `git push` sur `master`

### Cas 2 — Hotfix en production

- Mettre en PROD un **HOTFIX** : faire une nouvelle version (`yarn release`) et un `cherry-pick`

---

## Sommaire

- 🧭 [Architecture technique et architecture du code](ARCHITECTURE.md)
- 🔐 [Authentification, autorisation, discovery et JWKS](AUTHENTICATION.md)

## Pass Emploi Connect

### Pré-requis <a name="pré-requis"></a>

- Node 20
- Docker et docker compose
- Lancer `yarn`

### Récupérer les variables d'environnement

Le fichier d'env est chiffré et versionné

1. Créer un fichier `.environment` en copiant le `.environment.template`
2. Mettre la valeur `DOTVAULT_KEY` indiquée sur **Dashlane**
3. Exécuter `dotvault decrypt`
4. **Ajouter/Modifier** les vars d'env : `dotvault encrypt`

### Lancer l'application en local

- S'assurer que `localhost` pointe sur `id.pass-emploi.incubateur.net` en **https**
- `sudo nano /etc/hosts` et ajouter la ligne `127.0.0.1 id.pass-emploi.incubateur.net`
- Générer des certificats pour le **https** : `mkdir -p certs && mkcert -install && mkcert -cert-file certs/id.pass-emploi.incubateur.net.crt -key-file certs/id.pass-emploi.incubateur.net.key id.pass-emploi.incubateur.net`
- `docker compose up --build --watch`

### Lancer les tests

- `yarn test`

### METTRE EN PROD

Depuis `develop` :

1. Se positionner sur la branche `develop` et pull
2. Faire une nouvelle release `yarn release:<level: patch | minor | major>`
3. `git push --tags`
4. `git push origin develop`
5. OPTIONNEL : Créer la PR depuis `develop` sur `master` (pour vérifier les changements)
6. Se positionner sur `master` et pull
7. `git merge develop` sur `master`
8. `git push` sur `master`

Mettre en PROD un **HOTFIX** : faire une nouvelle version (`yarn release`) et un `cherry-pick`

### Générer les JWKS

- `yarn generate-key-pair`
- Copier la clé
- Attention : il faut au minimum 2 clés

### IDPs et Discover

- [Pass Emploi Connect](https://id.pass-emploi.incubateur.net/auth/realms/pass-emploi/.well-known/openid-configuration)
- [FT Conseiller](https://authentification-agent-va.pe-qvr.net/connexion/oauth2/.well-known/openid-configuration?realm=/agent)
- [FT Bénéficiaire](https://authentification-candidat-r.ft-qvr.fr/connexion/oauth2/realms/root/realms/individu/.well-known/openid-configuration)
- [MILO Conseiller](https://sso-qlf.i-milo.fr/auth/realms/imilo-qualif/.well-known/openid-configuration)
- [MILO Jeune](https://sso-qlf.i-milo.fr/auth/realms/sue-jeunes-qualif/.well-known/openid-configuration)

### Schéma du flow d'authorization utilisé

Flow générique : ![Authorization Code](https://i.imgur.com/xn6HjU0.png)

Détail de notre implémentation (broker, vocabulaire, étapes, exemple concret) :
[docs/flow-authentification.md](./docs/flow-authentification.md)

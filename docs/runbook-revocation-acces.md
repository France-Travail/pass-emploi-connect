# Runbook — Révoquer les accès d'utilisateurs

Coupe toutes les sessions et tous les tokens connect d'une liste d'utilisateurs
(compte compromis, incident de sécurité).

## Prérequis

- **L'IdP a fermé les sessions de ces utilisateurs avant** (sessions SSO + offline,
  reset mdp). Sinon une session SSO encore active chez lui reconnecte
  l'utilisateur sans mire, et la purge ne sert à rien.
- Le script est déployé sur l'app visée (il tourne depuis `dist/`).

## Fichier d'entrée

Un `sub` par ligne : le `sub` de l'IdP, troisième segment de l'accountId
`TYPE|STRUCTURE|SUB`. Les lignes vides sont ignorées, les doublons dédoublonnés.

```
e096fa16-1234-4abc-8def-0123456789ab
3b1c9d2e-5678-4fed-9cba-9876543210fe
```

Tous les comptes qui portent ce `sub` sont traités, quel que soit leur type
(jeune, conseiller) ou leur structure.

## Lancer

```bash
# 1. Dry-run : liste ce qui serait supprimé, ne touche à rien
scalingo --app <app-connect> run --file subs.txt \
  node dist/scripts/revoquer-acces.js /tmp/uploads/subs.txt \
  | tee bilan-dry-run.txt

# 2. Exécution
scalingo --app <app-connect> run --file subs.txt \
  node dist/scripts/revoquer-acces.js /tmp/uploads/subs.txt --execute \
  | tee bilan-execute.txt
```

Toujours faire le dry-run d'abord. Répéter sur staging avant la prod.
Le script peut être relancé sans risque.

## Lire le bilan

Le bilan s'affiche **uniquement dans le terminal** qui lance la commande, et
n'est conservé nulle part ailleurs : le `tee` en garde une copie locale, à
joindre au suivi d'incident. Il est mêlé aux logs de démarrage (Nest, Redis,
APM) : les lignes utiles sont celles qui contiennent `[RevoquerAccesScript]`.

```bash
grep '\[RevoquerAccesScript\]' bilan-dry-run.txt
```

Exemple en dry-run, avec 2 subs dont un seul a des traces chez nous :

```
LOG [RevoquerAccesScript] 2 subs à traiter, mode DRY-RUN
LOG [RevoquerAccesScript] Grants : 1, sessions : 1, tokens IdP : 2, clés supprimées : 0
LOG [RevoquerAccesScript] Comptes trouvés (1) :
LOG [RevoquerAccesScript]   JEUNE|MILO|e096fa16-1234-4abc-8def-0123456789ab
LOG [RevoquerAccesScript] Subs sans aucune trace (1) :
LOG [RevoquerAccesScript]   3b1c9d2e-5678-4fed-9cba-9876543210fe
```

- **Grants** : nombre de grants, c'est-à-dire de connexions encore ouvertes
  (une par app où l'utilisateur est connecté). Ce sont eux qui permettent le refresh.
- **Sessions** : sessions de navigateur, qui permettent un login sans mire.
- **Tokens IdP** : nombre de clés (access, refresh, verrou), pas de comptes.
- **Clés supprimées** : toujours `0` en dry-run. En exécution, nombre de clés
  réellement supprimées, tokens des grants compris (plus que la somme des
  compteurs ci-dessus).
- **Comptes trouvés** : accountIds qui avaient au moins un objet chez nous.
- **Subs sans aucune trace** : aucune session ni aucun token chez nous. Pour une
  investigation, ça veut dire que l'utilisateur ne s'est pas connecté via nos
  apps ces 42 derniers jours, ou qu'il s'est déconnecté depuis (sur le web).
- **Clés illisibles** (n'apparaît que s'il y en a) : `Grant` ou `Session` dont
  le contenu n'est pas du JSON. Le script les saute sans s'arrêter, mais elles
  peuvent appartenir à un sub visé : les lire avec `GET 'oidc:<clé>'` et les
  supprimer à la main si besoin.

Après l'exécution, relancer le dry-run doit afficher `Grants : 0, sessions : 0,
tokens IdP : 0` : tous les subs passent alors en « sans aucune trace ».

## Ce qui reste après la purge

- **Access tokens déjà émis** : ce sont des JWT non stockés, valides 30 min max.
- **Firebase (messagerie)** : rien à voir avec connect, il faut révoquer côté api
  (`revokeRefreshTokens`).

Clés supprimées et pourquoi : voir `stockage-redis.md`.

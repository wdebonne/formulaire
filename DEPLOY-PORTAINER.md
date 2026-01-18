# Déploiement sur Portainer

> Nouvelle fonctionnalité : partage de formulaire (lien direct, shortcode, embed, QR code) accessible via le bouton "Partager" dans l'éditeur visuel. Le slug (URL) du formulaire est modifiable dans les paramètres du formulaire.

Ce guide explique comment déployer FormBuilder Standalone sur Portainer avec Docker Compose.

## Prérequis
- Portainer installé et accessible
- Un repository Git (GitHub, GitLab, etc.) contenant le code source
- Variables d'environnement configurées (voir `.env.example`)

## 1. Déployer via Portainer (Repository Git)

1. Connectez-vous à Portainer
2. Allez dans "Stacks" > "Add stack"
3. Sélectionnez **"Repository"**
4. Configurez votre repository Git :
   - **Repository URL** : `https://github.com/votre-compte/votre-repo.git`
   - **Repository reference** : `main` (ou votre branche)
   - **Compose path** : `docker-compose.yml`
5. Dans **Environment variables**, ajoutez vos variables :
   ```
   DATABASE_URL=file:./dev.db
   JWT_SECRET=votre-secret-jwt-securise
   APP_URL=https://votre-domaine.fr
   SMTP_HOST=smtp.votre-fournisseur.com
   SMTP_PORT=587
   SMTP_USER=votre-utilisateur
   SMTP_PASS=votre-mot-de-passe
   SMTP_FROM=noreply@votre-domaine.fr
   ```
6. Cliquez sur **"Deploy the stack"**

## 2. Structure des fichiers Docker

Le projet inclut :
- `Dockerfile` : Build multi-stage optimisé pour Next.js
- `docker-compose.yml` : Configuration des services
- `.dockerignore` : Fichiers exclus du build

## 3. Volumes persistants

Le docker-compose configure automatiquement :
- `sqlite-data` : Base de données SQLite
- `uploads-data` : Fichiers uploadés

## 4. Accéder à l'application

- Rendez-vous sur `http://[votre-serveur]:3110`

## 5. Premier accès

Après le déploiement, vous pouvez vous connecter avec :

| Champ | Valeur |
|-------|--------|
| **Email** | `admin@formbuilder.local` |
| **Mot de passe** | `admin123` |

⚠️ **Changez ce mot de passe immédiatement !**

Ou créez un nouveau compte via `/register`.

## 🚀 Accès public des formulaires

Depuis janvier 2026, les liens publics des formulaires sont accessibles directement à la racine du site :

- Exemple : `https://www.monsite.fr/test2` (au lieu de `https://www.monsite.fr/f/test2`)
- Les anciennes URLs `/f/[slug]` sont automatiquement redirigées vers la nouvelle structure.
- Le lien de partage et l'URL affichée dans l'administration ont été mis à jour.

## Notes
- Le build peut prendre quelques minutes lors du premier déploiement
- Pour la production, utilisez un JWT_SECRET sécurisé et unique
- Les mises à jour se font en "redéployant" le stack dans Portainer

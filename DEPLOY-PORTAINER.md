# Déploiement sur Portainer

> **English version**: [DEPLOY-PORTAINER.en.md](DEPLOY-PORTAINER.en.md)

> **Nouveautés (Janvier 2026)** :
> - **Interface redessinée** : Dashboard et page Réponses avec design moderne
> - **Sélecteur de colonnes** : Choisissez quelles colonnes afficher dans le tableau des réponses
> - **Autocomplete partage** : Recherchez les utilisateurs facilement lors du partage
> - **Gestion avancée des droits** : 3 niveaux (Lecture, Édition, Administrateur)
> - **Partage de formulaire** : Lien direct, shortcode, embed, QR code
> - Le slug (URL) du formulaire est modifiable dans les paramètres

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
- `docker-compose.yml` : Configuration universelle (auto-détection architecture)
- `docker-compose.amd64.yml` : Configuration pour processeurs Intel/AMD (x86_64)
- `docker-compose.arm64.yml` : Configuration pour processeurs ARM (Raspberry Pi, Apple Silicon)
- `.dockerignore` : Fichiers exclus du build

### Choix du fichier docker-compose

| Architecture | Exemples de serveurs | Fichier à utiliser |
|--------------|---------------------|-------------------|
| **AMD64 / x86_64** | Serveurs Intel, AMD, VPS classiques | `docker-compose.amd64.yml` |
| **ARM64 / aarch64** | Raspberry Pi 4/5, Apple Silicon M1/M2/M3, Oracle Cloud ARM | `docker-compose.arm64.yml` |
| **Auto-détection** | N'importe quel serveur | `docker-compose.yml` |

> 💡 **Conseil** : Utilisez `docker-compose.yml` pour une détection automatique de l'architecture. Si vous rencontrez des problèmes de compatibilité, choisissez le fichier spécifique à votre architecture.

#### Comment connaître l'architecture de votre serveur ?

```bash
# Linux / macOS
uname -m
# Retourne "x86_64" (AMD64) ou "aarch64" (ARM64)

# Windows (PowerShell)
$env:PROCESSOR_ARCHITECTURE
# Retourne "AMD64" ou "ARM64"
```

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
- Le build peut prendre quelques minutes lors du premier déploiement (plus long sur ARM)
- Pour la production, utilisez un JWT_SECRET sécurisé et unique
- Les mises à jour se font en "redéployant" le stack dans Portainer
- Sur ARM64, le temps de démarrage peut être légèrement plus long (healthcheck ajusté)

## Dépannage

### Problème de compatibilité d'architecture
Si l'image ne démarre pas avec une erreur de format, vérifiez que vous utilisez le bon fichier docker-compose pour votre architecture.

### Le conteneur redémarre en boucle
Vérifiez les logs avec : `docker logs formbuilder`

### Base de données vide après redémarrage
Assurez-vous que le volume `sqlite-data` est bien persistant et non recréé à chaque déploiement.

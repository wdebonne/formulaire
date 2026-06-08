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
- `sqlite-data` : Base de données SQLite (`/app/prisma/data`)
- `uploads-data` : Fichiers uploadés

> La base de données réside dans son propre sous-dossier `/app/prisma/data` (et non directement dans `/app/prisma`) afin que le volume persistant ne recouvre pas `schema.prisma` et les fichiers de migration embarqués dans l'image.

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

## 6. Personnalisation du site

Après connexion en tant qu'admin, rendez-vous dans **Admin → Personnalisation** (`/admin/customization`) pour configurer :

- **Nom du site** — affiché dans l'en-tête du dashboard, l'onglet navigateur et la page de connexion
- **Logo** — remplace l'icône "FB" par défaut dans l'en-tête et la page de connexion (recommandé : 200×50 px)
- **Favicon** — affiché dans les onglets du navigateur (recommandé : 32×32 px)

Plus bas sur la même page, la carte **Page de connexion** permet de personnaliser :

- L'affichage ou non du lien **"Mot de passe oublié ?"**
- Le **fond de la page** : couleur unie, dégradé (avec direction et couleurs personnalisées), ou image avec un **flou réglable** pour créer un effet fondu derrière la carte de connexion
- L'option **"Autoriser les inscriptions"** — un raccourci vers le même réglage que la section Paramètres généraux

Un aperçu en direct affiche le rendu exact de la page de connexion avant l'enregistrement.

Les modifications prennent effet immédiatement au prochain chargement de page.

---

## 7. Sécurité (anti-bruteforce et contrôle d'accès par IP)

Rendez-vous dans **Admin → Sécurité** (`/admin/security`) pour configurer :

- **Protection anti-bruteforce** — activation/désactivation, nombre maximal de tentatives échouées, fenêtre de temps et durée de blocage qui en résulte
- **Liste blanche d'IP** — adresses qui contournent toujours le blocage, quel que soit le nombre de tentatives échouées
- **Liste noire d'IP** — adresses rejetées (HTTP 403) avant même d'atteindre l'application, directement au niveau du `middleware.ts`
- **IP actuellement bloquées** — liste en direct avec le nombre de tentatives échouées et le temps de blocage restant, avec possibilité de débloquer manuellement

> Les changements de liste blanche/noire peuvent prendre jusqu'à 60 secondes pour se propager, le middleware Edge rafraîchissant son cache d'IP depuis la base de données à cet intervalle.

---

## 8. RGPD (rétention et droits des personnes)

Rendez-vous dans **Admin → RGPD** (`/admin/gdpr`) pour configurer :

- **Durée de conservation des réponses** — activation/désactivation et durée en mois (durée légale par défaut : 36 mois, avec un bouton de réinitialisation) ; le panneau affiche le nombre de réponses actuellement au-delà de cette durée (avec répartition par formulaire) avant toute purge — la suppression est **toujours déclenchée manuellement**, il n'y a pas de tâche planifiée
- **Recherche & droits des personnes** — recherche globale (tous formulaires confondus) des réponses correspondant à une personne (nom, email, tout texte présent dans les données) ; les résultats sont à revoir et cocher/décocher avant d'agir, puis :
  - **Export** au format Excel (portabilité — valeurs en clair) ou PDF (récapitulatif nominatif "Formulaire — Date de soumission") à transmettre à la personne
  - **Suppression** (droit à l'effacement) des réponses sélectionnées, avec confirmation

> L'export PDF nécessite que `pdfkit` soit présent dans l'image construite (voir [Dépannage](#dépannage) ci-dessous si l'export échoue avec une erreur 500 après une mise à jour).

---

## 9. Journal d'activité (audit trail)

Rendez-vous dans **Admin → Logs** (`/admin/logs`) pour consulter et configurer :

- **Journal d'activité** — historique consultable, filtrable et paginé des connexions (qui, adresse IP, succès/échec et raison), des événements liés au cycle de vie des formulaires (création, modification, publication/dépublication, suppression, restauration, duplication, versions) et des actions de gestion des utilisateurs (création, modification, suppression) ; filtrage par action/catégorie, statut, plage de dates ou recherche libre, puis export de la vue actuelle vers Excel
- **Conservation** — activation/désactivation et durée en jours (365 par défaut) ; le panneau affiche le nombre d'entrées actuellement au-delà de cette durée avant toute purge — la suppression est **toujours déclenchée manuellement**, il n'y a pas de tâche planifiée
- **Alertes email en cas de connexions échouées** — réglage situé aux côtés des paramètres anti-bruteforce dans **Admin → Sécurité** : activation, seuil de tentatives consécutives, et adresse devant recevoir l'alerte ; un seul email est envoyé par cycle d'échecs (le compteur revient à zéro sur connexion réussie ou nouvelle fenêtre de temps), pas un par tentative au-delà du seuil

---

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

### Erreur 500 sur l'export PDF (RGPD)
Si **Admin → RGPD → Exporter (PDF)** renvoie une erreur 500, l'image en cours d'exécution date d'avant le correctif intégrant `pdfkit` au build `standalone` (le module et ses fichiers de polices `.afm` ne sont alors pas présents dans l'image). Reconstruisez l'image (`docker compose build --no-cache` ou un nouveau déploiement complet du stack dans Portainer) puis redémarrez le conteneur — un simple redémarrage sans reconstruction ne suffit pas.

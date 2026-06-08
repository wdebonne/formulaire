# FormBuilder Standalone

Un créateur de formulaires auto-hébergé avec éditeur visuel par glisser-déposer, logique conditionnelle, webhooks, thèmes et gestion multi-utilisateurs.

> **English version**: [README.md](README.md)

---

## Fonctionnalités

### Construction de formulaires
- **Éditeur par glisser-déposer** — réordonnez les blocs visuellement, panneaux redimensionnables
- **25+ types de blocs** — voir la [liste complète](#types-de-blocs) ci-dessous
- **Logique conditionnelle visuelle** — afficher/masquer/sauter/rendre obligatoire selon les réponses ; éditeur texte avec recherche de blocs + éditeur de flux visuel plein écran (style Tripetto) avec flèches SVG, routage en lanes et éditeur de règle intégré
- **Aperçu temps réel et fidèle** — le panneau central se met à jour instantanément à chaque modification (libellé, choix, type, thème) via Zustand ; le bouton Aperçu sauvegarde les changements puis affiche le formulaire dans un iframe plein écran avec exactement le même renderer que la page publiée — aucune différence visuelle
- **Historique des versions** — snapshot automatique toutes les 10 sauvegardes + versions manuelles avec label optionnel ; restauration ou suppression depuis le builder ou le dashboard ; recherche dans les versions ; l'état courant est toujours préservé avant chaque restauration
- **Thèmes** — couleurs, polices, fonds (uni, dégradé, image), styles de boutons et champs, couleur de fond des choix ; l'aperçu central de l'éditeur reflète le thème en temps réel (arrondi, style des champs, couleurs)
- **Webhooks** — envoi des réponses vers des URLs externes, mapping personnalisé, réorganisation par drag & drop, recherche
- **Paramètres** — barre de progression (position, taille), numérotation, animations, branding, affichage du logo (position + alignement)

### Partage & Publication
- Formulaires publics accessibles à `/{slug}` directement à la racine du site
- Partage via lien direct, shortcode, embed (iframe) ou QR code
- Slug personnalisable dans les paramètres
- 3 niveaux de permissions : **Lecture**, **Édition**, **Administrateur**
- Autocomplétion lors de la recherche d'utilisateurs à partager

### Panneau d'administration
- Gestion des utilisateurs (créer, modifier, supprimer)
- **RGPD** (`/admin/gdpr`) — durée de conservation des réponses configurable (durée légale par défaut : 36 mois) avec purge manuelle des données expirées ; recherche globale, tous formulaires confondus, des réponses d'une personne avec revue avant action (export Excel de portabilité ou récapitulatif PDF nominatif) et suppression au titre du droit à l'effacement ; mention RGPD optionnelle (lien + fenêtre modale) sur les écrans d'accueil et de fin
- **Sécurité** — protection anti-bruteforce de la connexion (tentatives max, fenêtre de temps et durée de blocage configurables) et listes blanche/noire d'adresses IP avec vue en direct des IP bloquées
- Corbeille / soft delete avec restauration et réassignation
- **Personnalisation du site** — nom du site, logo et favicon appliqués globalement (en-tête du dashboard, onglet navigateur, page de connexion)
- **Personnalisation de la page de connexion** — afficher ou masquer les liens "mot de passe oublié" et "s'inscrire", et définir un fond personnalisé (couleur unie, dégradé ou image floutée)
- Gestion des polices personnalisées
- Configuration SMTP avec test d'envoi
- Intégration Nextcloud
- Sauvegarde et restauration de la base de données
- Bibliothèque de modèles

### Réponses
- Visualisation de toutes les réponses par formulaire
- Sélecteur de colonnes (choisir les champs à afficher)
- Export Excel (XLSX)
- Suivi des réponses complètes et partielles
- Renvoi de webhook par réponse
- Indicateur visuel du statut webhook (vert / orange / rouge / gris)

---

## Types de blocs

| Bloc | Description |
|------|-------------|
| Écran d'accueil | Page d'introduction du formulaire |
| Texte court | Champ mono-ligne (transformation optionnelle : majuscules, initiales) |
| Texte long | Zone de texte multi-lignes |
| Email | Champ email avec validation stricte configurable |
| Téléphone | Champ téléphone (format standard ou international, nombre de chiffres configurable) |
| Adresse | Champ adresse avec autocomplétion (API Adresse / BAN officielle française) |
| Nombre | Champ numérique |
| Choix multiple | Sélection unique ou multiple (avec option "Autre" pour réponse libre) |
| Sélection image | Choix illustrés par des images cliquables |
| Menu déroulant | Liste avec autocomplétion, saisie libre optionnelle et filtrage dynamique |
| Quantité | Liste d'articles avec saisie de quantités individuelles |
| Date | Sélecteur de date natif |
| Date avancée | Calendrier visuel avec plage de dates et contraintes min/max configurables |
| Heure | Sélecteur d'heure ou plage horaire |
| Téléchargement | Pièce jointe |
| Signature | Zone de signature tactile/souris |
| Curseur | Valeur numérique avec slider |
| Site web | URL avec validation |
| Mention légale | Case à cocher obligatoire |
| Énoncé | Texte informatif (sans saisie) |
| Oui / Non | Question avec deux boutons Oui/Non |
| Groupe | Regroupe plusieurs questions sur la même page |
| Bloc répétable | Répétition dynamique d'un ensemble de questions |
| Écran de remerciement | Page de fin personnalisée (bouton "Recommencer" optionnel) |

---

## Stack technique

| Couche | Technologie |
|--------|------------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Langage | TypeScript |
| Base de données | SQLite via [Prisma ORM](https://www.prisma.io/) |
| Auth | JWT (cookies HTTP-only) + bcrypt |
| UI | [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) |
| Drag & Drop | [@dnd-kit](https://dndkit.com/) |
| État global | [Zustand](https://zustand-demo.pmnd.rs/) |
| Email | [Nodemailer](https://nodemailer.com/) |
| Animations | [Framer Motion](https://www.framer.com/motion/) |
| Déploiement | Docker (multi-stage, multi-arch AMD64 + ARM64) |

---

## Démarrage rapide (développement local)

### Prérequis
- Node.js 18+
- npm ou yarn

### Installation

```bash
# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditez .env avec vos valeurs

# Initialiser la base de données
npm run db:push
npm run db:seed

# Lancer le serveur de développement
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

### Identifiants par défaut

| Champ | Valeur |
|-------|--------|
| Email | `admin@formbuilder.local` |
| Mot de passe | `admin123` |

> **Changez ce mot de passe immédiatement après la première connexion.**

Vous pouvez aussi créer un nouveau compte via `/register`.

---

## Déploiement Docker

```bash
docker compose up -d
```

L'application est accessible sur le port `3110` par défaut (`http://localhost:3110`).

Pour le déploiement sur Portainer et en production, consultez [DEPLOY-PORTAINER.md](DEPLOY-PORTAINER.md).

---

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | Chemin vers le fichier SQLite | `file:./dev.db` |
| `JWT_SECRET` | Clé secrète pour les tokens JWT | *(requis en prod)* |
| `NEXT_PUBLIC_APP_URL` | URL publique de l'application | `http://localhost:3000` |
| `SMTP_HOST` | Serveur SMTP | — |
| `SMTP_PORT` | Port SMTP | `587` |
| `SMTP_USER` | Utilisateur SMTP | — |
| `SMTP_PASS` | Mot de passe SMTP | — |
| `SMTP_FROM` | Adresse email d'expéditeur | `noreply@formbuilder.local` |
| `SMTP_FROM_NAME` | Nom de l'expéditeur | `FormBuilder` |

---

## Structure du projet

```
formbuilder-standalone/
├── prisma/
│   ├── schema.prisma        # Schéma de la base de données
│   └── seed.ts              # Données initiales (thèmes, compte admin)
├── src/
│   ├── app/
│   │   ├── [slug]/          # Formulaire public (/{slug})
│   │   ├── admin/           # Panneau d'administration
│   │   ├── builder/[id]/    # Éditeur de formulaires
│   │   ├── dashboard/       # Liste des formulaires
│   │   ├── forms/[id]/
│   │   │   ├── preview/     # Prévisualisation auth-protégée (brouillon ou publié)
│   │   │   └── responses/   # Visualisation des réponses
│   │   └── api/             # Points d'accès REST
│   ├── components/
│   │   ├── builder/         # Interface du builder (blocs, logique, thème, webhooks…)
│   │   └── ui/              # Composants UI génériques (Button, Dialog, Input…)
│   ├── lib/                 # Auth, client Prisma, email, utilitaires
│   ├── hooks/               # Hooks React personnalisés
│   ├── stores/              # État global Zustand
│   └── types/               # Définitions TypeScript
├── docker-compose.yml       # Docker Compose universel (détection auto architecture)
├── docker-compose.amd64.yml # Spécifique AMD64
├── docker-compose.arm64.yml # Spécifique ARM64 (Raspberry Pi, Apple Silicon)
└── Dockerfile               # Build multi-stage
```

---

## Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarrer le serveur de développement |
| `npm run build` | Compiler pour la production |
| `npm start` | Démarrer le serveur de production |
| `npm run lint` | Lancer ESLint |
| `npm run db:push` | Appliquer le schéma Prisma à la base |
| `npm run db:studio` | Ouvrir Prisma Studio |
| `npm run db:generate` | Regénérer le client Prisma |
| `npm run db:seed` | Initialiser la base avec les données par défaut |

---

## Sécurité

- Mots de passe hashés avec bcrypt
- Tokens JWT avec expiration (cookies HTTP-only)
- Validation côté serveur sur toutes les routes API
- Vérification des autorisations sur tous les endpoints protégés
- Protection anti-bruteforce de la connexion avec seuils configurables et listes blanche/noire d'IP (`/admin/security`)

---

## Contribution

Consultez [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md) pour les règles de contribution.

## Journal des modifications

Consultez [CHANGELOG.fr.md](CHANGELOG.fr.md) pour l'historique des versions.

## Licence

[GNU Affero General Public License v3.0](LICENSE)

---

*Inspiré par [QuillForms](https://quillforms.com)*

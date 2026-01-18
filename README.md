
# FormBuilder Standalone

Un créateur de formulaires autonome avec éditeur visuel, logique conditionnelle, webhooks et personnalisation avancée des thèmes.


## ✨ Fonctionnalités

- 🔐 **Authentification** - Inscription, connexion, mot de passe oublié
- 📝 **Éditeur visuel** - Glisser-déposer pour construire vos formulaires
- 🎯 **Logique conditionnelle** - Afficher/masquer des questions selon les réponses
- 🔗 **Webhooks** - Envoyer les données à des services externes
- 📊 **Réponses** - Visualiser et exporter les réponses en CSV
- 🎨 **Thèmes** - Personnaliser l'apparence de vos formulaires (polices, couleurs, formes des boutons et champs, suppression de thèmes personnalisés)
- 📤 **Import/Export** - Sauvegarder et partager vos formulaires en JSON

## 🆕 Nouveautés

- Suppression des thèmes personnalisés (les thèmes par défaut sont protégés)
- Plus de 20 polices disponibles
- Choix de la forme des boutons et des champs (arrondi, carré, etc.)
- Styles d'inputs : souligné, encadré, rempli

## 🚀 Installation

### Prérequis

- Node.js 18+
- npm ou yarn

### Installation

1. Clonez le repository et installez les dépendances :

```bash
cd formbuilder-standalone
npm install
```

2. Copiez le fichier d'environnement :

```bash
cp .env.example .env
```

3. Modifiez les variables dans `.env` selon votre configuration

4. Initialisez la base de données :

```bash
npm run db:push
npm run db:seed
```

5. Lancez le serveur de développement :

```bash
npm run dev
```


6. Ouvrez http://localhost:3000

## 🐳 Déploiement Docker/Portainer

Un guide complet est disponible dans le fichier `DEPLOY-PORTAINER.md` pour déployer l'application sur Portainer avec Docker Compose.

## 📂 Fichiers utiles

- `.gitignore` : fichiers/dossiers exclus du versionnement Git
- `DEPLOY-PORTAINER.md` : guide de déploiement sur Portainer

## 📦 Types de blocs disponibles

- **Écran d'accueil** - Introduction au formulaire
- **Texte court** - Champ de saisie simple
- **Texte long** - Zone de texte multi-lignes
- **Email** - Champ email avec validation
- **Nombre** - Champ numérique
- **Choix multiple** - Sélection unique ou multiple
- **Menu déroulant** - Liste de choix
- **Date** - Sélecteur de date
- **Curseur** - Valeur numérique avec slider
- **Site web** - URL avec validation
- **Mention légale** - Case à cocher obligatoire
- **Déclaration** - Texte informatif
- **Écran de remerciement** - Page de fin personnalisée

## 🔧 Configuration

### Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de la base de données SQLite |
| `JWT_SECRET` | Secret pour les tokens JWT |
| `SMTP_HOST` | Serveur SMTP pour les emails |
| `SMTP_PORT` | Port SMTP |
| `SMTP_USER` | Utilisateur SMTP |
| `SMTP_PASS` | Mot de passe SMTP |
| `SMTP_FROM` | Adresse email d'expédition |
| `APP_URL` | URL de base de l'application |

## 📁 Structure du projet

```
formbuilder-standalone/
├── prisma/
│   ├── schema.prisma    # Schéma de base de données
│   └── seed.ts          # Données initiales (thèmes)
├── src/
│   ├── app/
│   │   ├── api/         # Routes API
│   │   ├── builder/     # Éditeur de formulaires
│   │   ├── dashboard/   # Tableau de bord
│   │   ├── f/           # Formulaires publics
│   │   ├── forms/       # Gestion des réponses
│   │   ├── login/       # Authentification
│   │   └── ...
│   ├── components/
│   │   ├── builder/     # Composants de l'éditeur
│   │   └── ui/          # Composants UI réutilisables
│   ├── hooks/           # Hooks React personnalisés
│   ├── lib/             # Utilitaires (Prisma, auth, etc.)
│   ├── stores/          # État global (Zustand)
│   └── types/           # Types TypeScript
└── ...
```

## 🔒 Sécurité

- Mots de passe hashés avec bcrypt
- Tokens JWT avec expiration
- Protection CSRF sur les formulaires
- Validation côté serveur

## 📄 Licence

MIT

## 🙏 Crédits

Inspiré par [QuillForms](https://quillforms.com)

# Contribuer à FormBuilder Standalone

> **English version**: [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Configuration de l'environnement de développement

### Prérequis

- Node.js 18+
- npm ou yarn
- Git

### Installation locale

```bash
# Cloner le dépôt
git clone <url-du-depot>
cd formbuilder-standalone

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditez .env — au minimum définissez JWT_SECRET

# Initialiser la base de données
npm run db:push
npm run db:seed

# Démarrer le serveur de développement
npm run dev
```

L'application tourne sur [http://localhost:3000](http://localhost:3000).

### Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarrer le serveur de développement avec rechargement automatique |
| `npm run build` | Compiler pour la production |
| `npm run lint` | Lancer ESLint |
| `npm run db:push` | Synchroniser le schéma Prisma avec SQLite |
| `npm run db:studio` | Ouvrir Prisma Studio (interface base de données) |
| `npm run db:seed` | Réinitialiser les données par défaut (thèmes, compte admin) |

---

## Architecture du projet

### Répertoires clés

| Chemin | Rôle |
|--------|------|
| `src/app/api/` | Routes API REST (Next.js Route Handlers) |
| `src/app/builder/[id]/` | Page de l'éditeur de formulaires |
| `src/app/[slug]/` | Page du formulaire public |
| `src/components/builder/` | Tous les composants UI du builder |
| `src/components/ui/` | Composants UI génériques réutilisables |
| `src/lib/auth.ts` | Utilitaires JWT d'authentification |
| `src/lib/prisma.ts` | Singleton du client Prisma |
| `src/stores/form-builder.ts` | Store Zustand pour l'état du builder |
| `src/types/form.ts` | Définitions TypeScript centrales |
| `prisma/schema.prisma` | Schéma de base de données |

### Gestion de l'état

L'état du builder est géré par un store [Zustand](https://zustand-demo.pmnd.rs/) (`src/stores/form-builder.ts`). Toutes les mutations de blocs, la logique, le thème et les webhooks passent par ce store. Le store est persisté via des appels API à chaque modification significative.

### Authentification

Les JWT sont stockés dans des cookies HTTP-only. Le module `src/lib/auth.ts` fournit des utilitaires pour la signature, la vérification des tokens et la vérification des permissions. Le middleware (`src/middleware.ts`) protège les routes qui nécessitent une authentification.

### Personnalisation du site

Le nom du site, le logo et le favicon sont stockés dans la table `SystemSettings` (ligne unique, `id = "system"`). Les pages serveur qui affichent la marque (dashboard, layout) récupèrent cette ligne au rendu via Prisma. `src/app/layout.tsx` exporte une fonction `generateMetadata()` async pour injecter le titre et le favicon dynamiquement. L'endpoint public `/api/settings/public` expose uniquement `siteName`, `siteLogo`, `siteFavicon` et `registrationEnabled` sans authentification (utilisé par la page de connexion et les pages publiques).

### Ajouter un nouveau type de bloc

1. Ajouter le nouveau type dans l'union `BlockType` dans `src/types/form.ts`
2. Ajouter les attributs par défaut dans `src/stores/form-builder.ts` (initialiseur de bloc)
3. Créer le panneau de paramètres dans `src/components/builder/block-editor.tsx`
4. Créer le composant d'aperçu dans `src/components/builder/block-preview.tsx`
5. Créer le composant du formulaire public dans `src/app/[slug]/public-form-client.tsx`
6. Gérer la réponse dans le visualiseur de réponses (`src/app/forms/[id]/responses/responses-client.tsx`)
7. Gérer le bloc dans la sérialisation du payload webhook (route API)

---

## Style de code

- **TypeScript** — mode strict ; pas de `any` sans justification
- **Composants** — composants fonctionnels avec props typées ; pas de classes
- **Imports** — chemins absolus (`@/…` via tsconfig) ; éviter les `../../../`
- **Style** — classes utilitaires Tailwind CSS ; éviter les styles inline
- **Commentaires** — uniquement quand le **pourquoi** est non évident ; pas de commentaires explicatifs sur du code auto-descriptif
- **Nommage des fichiers** — kebab-case pour les fichiers et dossiers ; PascalCase pour les noms de composants

---

## Workflow Git

### Nommage des branches

```
feat/description-courte     # Nouvelle fonctionnalité
fix/description-courte      # Correction de bug
refactor/description-courte # Refactoring
docs/description-courte     # Documentation uniquement
```

### Messages de commit

Suivre les [Conventional Commits](https://www.conventionalcommits.org/fr/) :

```
feat: ajout du bloc quantité
fix: stale closure dans le repeater interne
refactor: extraction de findBlockDeep
docs: mise à jour du CHANGELOG pour v1.5.0
```

### Pull Requests

- Garder les PRs ciblées — une fonctionnalité ou un correctif par PR
- Mettre à jour `CHANGELOG.fr.md` sous `[Non publié]` pour tout changement visible par l'utilisateur
- Vérifier que `npm run lint` passe avant d'ouvrir une PR
- Décrire **ce qui** a changé et **pourquoi** dans la description de la PR

---

## Variables d'environnement

Ne jamais commiter de secrets. Le fichier `.env` est dans le `.gitignore`. Utiliser `.env.example` pour documenter les variables requises sans leurs valeurs.

---

## Migrations de base de données

Ce projet utilise `prisma db push` (schema-first, sans fichiers de migration). Lors d'une modification de `prisma/schema.prisma` :

```bash
npm run db:push     # Appliquer les changements de schéma
npm run db:generate # Regénérer le client Prisma
```

> En production, testez d'abord les changements de schéma en local. `db push` est destructif pour les champs renommés ou supprimés.

---

## Signaler un problème

Ouvrir une issue avec :
- Un titre clair décrivant le problème
- Les étapes pour reproduire
- Le comportement attendu vs le comportement observé
- L'environnement (OS, version Node, navigateur si pertinent)

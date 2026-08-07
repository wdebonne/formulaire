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
| `src/components/forms/` | Modales Modèle de document et E-mail d'envoi |
| `src/lib/auth.ts` | Utilitaires JWT d'authentification |
| `src/lib/prisma.ts` | Singleton du client Prisma |
| `src/lib/document-fields.ts` | Catalogue des champs/jetons des modèles Word (pur, utilisable côté client) |
| `src/lib/docx-template.ts` | Moteur docxtemplater (server-only) |
| `src/lib/document-delivery.ts` | Génère le document d'une réponse et l'envoie par e-mail |
| `src/stores/form-builder.ts` | Store Zustand pour l'état du builder |
| `src/types/form.ts` | Définitions TypeScript centrales |
| `prisma/schema.prisma` | Schéma de base de données |
| `prisma/migrations/` | Fichiers de migration rejoués en production — voir [Migrations](#migrations-de-base-de-données) |

### Gestion de l'état

L'état du builder est géré par un store [Zustand](https://zustand-demo.pmnd.rs/) (`src/stores/form-builder.ts`). Toutes les mutations de blocs, la logique, le thème et les webhooks passent par ce store. Le store est persisté via des appels API à chaque modification significative.

### Authentification

Les JWT sont stockés dans des cookies HTTP-only. Le module `src/lib/auth.ts` fournit des utilitaires pour la signature, la vérification des tokens et la vérification des permissions. Le middleware (`src/middleware.ts`) protège les routes qui nécessitent une authentification.

### Personnalisation du site

Le nom du site, le logo et le favicon sont stockés dans la table `SystemSettings` (ligne unique, `id = "system"`). Les pages serveur qui affichent la marque (dashboard, layout) récupèrent cette ligne au rendu via Prisma. `src/app/layout.tsx` exporte une fonction `generateMetadata()` async pour injecter le titre et le favicon dynamiquement. L'endpoint public `/api/settings/public` expose uniquement `siteName`, `siteLogo`, `siteFavicon`, `registrationEnabled` et `loginPageSettings` sans authentification (utilisé par la page de connexion et les pages publiques).

**Important** : cette route n'a aucune fonction dynamique (`cookies()`, `headers()`, paramètre `Request`), donc sans `export const dynamic = 'force-dynamic'`, Next.js met sa réponse en cache au moment du build — toute modification de réglage faite après `next build` ne serait jamais répercutée sur le site en ligne. Conserver cet export ; il reproduit le même correctif appliqué sur `src/app/dashboard/page.tsx`.

#### Personnalisation de la page de connexion

`SystemSettings.loginPageSettings` stocke un blob JSON (colonne texte, même convention que `Form.settings`) typé `LoginPageSettings` dans `src/types/form.ts` — contrôle la visibilité du lien "mot de passe oublié" et le fond de la page (couleur unie / dégradé / image avec flou). `src/lib/utils.ts` exporte `getLoginBackgroundStyle()`, source unique de vérité pour transformer ces réglages en CSS ; la page `src/app/login/page.tsx` et l'aperçu en direct dans `src/app/admin/customization/customization-client.tsx` l'utilisent tous les deux, garantissant un rendu identique au pixel près. Le bascule "Autoriser les inscriptions" de cette section écrit dans la même colonne `registrationEnabled` que Admin → Paramètres généraux — c'est un raccourci de confort, pas un indicateur séparé.

### Modèles de documents Word

`src/lib/document-fields.ts` est volontairement **pur** — aucun import Prisma, aucun accès disque — pour que les composants `'use client'` puissent l'importer pour le tableau des champs et jetons ; le moteur de rendu vit à part dans `src/lib/docx-template.ts`. C'est la même séparation serveur/client qu'entre `audit-actions.ts` et `audit-log.ts` : importer un module touchant à Prisma dans un composant client casse le build.

Deux invariants à connaître avant de toucher à cette partie :

- **Les jetons sont persistés, pas dérivés.** `Form.documentSettings` conserve une association `jeton → blockId`, et `buildFieldCatalog(blocks, savedMappings)` privilégie toujours un jeton enregistré sur un libellé fraîchement transformé en slug. C'est ce qui garantit qu'un `.docx` déjà rédigé continue de fonctionner après le renommage d'une question. Ne jamais regénérer les jetons uniquement à partir des libellés.
- **Les jetons sont dédupliqués globalement**, enfants de répéteurs compris, car docxtemplater résout d'abord dans la boucle puis remonte au scope parent — un jeton d'enfant en collision masquerait silencieusement un champ de premier niveau.

Un nouveau type de bloc ne demande rien ici : le catalogue est dérivé des blocs, il apparaît automatiquement.

`docxtemplater/js/inspect-module.js` (l'inspecteur de jetons officiel) fait un `require` de **lodash, qui n'est pas une dépendance de docxtemplater** — l'importer casse le build. La détection des jetons passe donc par `get-tags.js`, exempt de lodash, plus un petit module local qui n'implémente que `set()` pour capturer le `postparsed` de chaque fichier.

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

Le projet fait tourner **deux mécanismes différents**, et les confondre a déjà provoqué une panne en production — lisez cette section avant de toucher à `prisma/schema.prisma`.

| Environnement | Mécanisme | Point d'entrée |
|---------------|-----------|----------------|
| Développement local | `prisma db push` — recrée les tables dans l'ordre du schéma | `npm run db:push` |
| Docker / production | `prisma migrate deploy` — rejoue `prisma/migrations/` dans l'ordre | `docker-entrypoint.sh` |

```bash
npm run db:push     # Appliquer les changements de schéma en local
npm run db:generate # Regénérer le client Prisma
```

**Tout changement de schéma doit être accompagné d'un fichier de migration** dans `prisma/migrations/`, sans quoi il n'atteindra jamais la production — `db push` ne met à jour que votre propre machine.

### Le piège : l'ordre physique des colonnes diffère entre les deux

`db push` recrée une table dans l'ordre déclaré dans le schéma, alors que `migrate deploy` ajoute en fin de table chaque colonne introduite par un `ALTER TABLE` ultérieur. Le même schéma produit donc **deux ordres physiques différents**.

Cela compte car SQLite n'a pas d'`ALTER COLUMN` : modifier la nullabilité d'une colonne ou une clé étrangère impose de recréer la table et d'y recopier les lignes. Ne jamais copier par position :

```sql
-- FAUX — associe les colonnes par position, casse sur l'une ou l'autre des lignées
INSERT INTO "Form_new" SELECT * FROM "Form";

-- JUSTE — correct quel que soit l'ordre physique
INSERT INTO "Form_new" ("id", "title", …) SELECT "id", "title", … FROM "Form";
```

C'est cette forme positionnelle qui a fait échouer `20260609000000_form_userid_nullable` en production alors qu'elle passait en local. Rendez aussi ces migrations rejouables : `DROP TABLE IF EXISTS "<table>_new"` en tête et `IF NOT EXISTS` sur la création des index, pour qu'une reprise après échec reste sûre.

### Tester une migration avant de la livrer

Une migration qui fonctionne sur votre base issue de `db push` ne prouve rien. Reconstruisez une base jetable dans l'ordre `migrate deploy` (le `CREATE TABLE` d'origine, puis chaque `ALTER TABLE` dans l'ordre des migrations), appliquez-y la migration, et vérifiez à la fois qu'elle réussit et que les valeurs ne se sont pas décalées d'une colonne à l'autre.

> `db push` est destructif pour les champs renommés ou supprimés. Testez d'abord en local.

---

## Signaler un problème

Ouvrir une issue avec :
- Un titre clair décrivant le problème
- Les étapes pour reproduire
- Le comportement attendu vs le comportement observé
- L'environnement (OS, version Node, navigateur si pertinent)

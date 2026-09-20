# Contribuer à FormBuilder Standalone

> **English version**: [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Configuration de l'environnement de développement

### Prérequis

- Node.js 24 — identique à `.nvmrc` et à l'image Docker. Les versions antérieures compilent, mais une API absente du Node de l'image passera tous les tests locaux et n'échouera qu'en production (voir [Parité des versions](#parité-des-versions-dexécution))
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
| `npm test` | Lancer la suite de tests (Vitest, une passe) |
| `npm run test:watch` | Relancer les tests à chaque modification |
| `npm run typecheck` | Vérifier les types sans compiler (`tsc --noEmit`) |
| `npm run lint` | Lancer ESLint — voir la note ci-dessous |
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
5. Créer le composant du formulaire public dans `src/app/[slug]/public-form-client.tsx` — dans les **trois** rendus (`QuestionBlock`, `GroupBlock.renderInnerInput`, `InnerBlockInput`), et avec les attributs d'accessibilité décrits ci-dessous
6. Gérer la réponse dans le visualiseur de réponses (`src/app/forms/[id]/responses/responses-client.tsx`)
7. Gérer le bloc dans la sérialisation du payload webhook (route API)

---

## Accessibilité

Le formulaire public vise le **RGAA 4.1 (WCAG 2.1 AA)**. Pour les organismes publics français, c'est une obligation légale : une contribution qui ajoute un contrôle inaccessible fait régresser la conformité de tout le monde.

### Ce qu'un nouveau champ doit porter

- **Les attributs viennent de `fieldA11y()`** (`src/lib/a11y.ts`), à étaler sur le contrôle : `id`, `aria-labelledby` (ou `aria-label` quand `hideLabel` retire l'intitulé du document), `aria-describedby`, `aria-invalid`, `aria-required`. N'écrivez pas ces identifiants à la main — `labelId()`, `descId()`, `errorId()` en sont la seule source, faute de quoi un `aria-describedby` finit par désigner un élément que personne ne rend.
- **Un contrôle composé de plusieurs boutons** (choix, note, quantité, signature, fichier, plage de dates) va dans un conteneur `role="group"` portant `groupA11y` — le même objet sans `id`. Un `<h2>` ne peut pas être un `<label for>`.
- **Une liste de choix** prend `choiceListProps()` sur le conteneur et `choiceOptionProps()` sur chaque option (`src/lib/choice-list.ts`) : rôle `radio` ou `checkbox`, `aria-checked`, et une seule tabulation pour le groupe entier.
- **Les trois rendus comptent.** Un bloc câblé dans `QuestionBlock` seulement est accessible sur une question isolée et muet dans un groupe ou un bloc répétable.
- **Décoratif veut dire `aria-hidden`** — pastilles de lettres, icône de coche, numéros de question. Un bouton sans texte visible (icône seule) veut au contraire un `aria-label` explicite.

### Ce qu'il ne faut pas défaire

- Le garde-fou de l'écouteur global d'`Entrée` dans `public-form-client.tsx` : sans lui, `preventDefault()` empêche le navigateur d'actionner le bouton ou l'option qui a le focus, et **plus rien n'est cochable au clavier seul**.
- Le déplacement du focus au changement de question, et sa réserve « sauf si un champ a déjà pris le focus » : la retirer empêcherait de taper dans les champs texte.
- `maximumScale` / `userScalable` dans `src/app/layout.tsx` : les rétablir bloquerait le zoom, échec direct du critère WCAG 1.4.4.

### Vérifier

`npm run build` ne dit rien de l'accessibilité. Au minimum, avant d'ouvrir une PR touchant au rendu public :

1. Parcourir le formulaire **au clavier seul** (Tab, flèches, Entrée, Espace) sans jamais utiliser la souris.
2. Ouvrir l'onglet *Accessibility* des outils de développement et vérifier le **nom accessible** et l'**état** de chaque contrôle ajouté.
3. Contrôler qu'aucun `aria-labelledby` / `aria-describedby` ne désigne un identifiant absent du document.

---

## Tests

Les modules « purs » de `src/lib` — ceux qui n'importent ni Prisma, ni `next/headers`, ni nodemailer
— sont couverts par une suite [Vitest](https://vitest.dev) dans `tests/lib/`. Ils s'exécutent sans
base de données, sans serveur et sans navigateur : la suite entière tourne en moins d'une seconde.

```bash
npm test                          # toute la suite
npm run test:watch                # en continu pendant le développement
npx vitest run tests/lib/catalog.test.ts   # un seul fichier
```

### Modules couverts

| Module | Ce que la suite garantit |
|--------|--------------------------|
| `report-stats.ts` | Résolution des périodes, plafond de la date de clôture, normalisation des choix stockés sous plusieurs formes, échelles de notes, taux de remplissage |
| `catalog.ts` | Période déduite des dates répondues, plafonds de quantité, prestation jamais masquée comme un stock épuisé, filtres transmis en amont |
| `form-options.ts` | Fusion au-dessus des défauts, anti-spam actif par défaut, condensat jamais exposé, état d'ouverture d'un formulaire |
| `condition-eval.ts` | Un circuit sans condition part toujours, normalisation slug / identifiant / libellé, « est égal à » vrai sur une option cochée parmi d'autres |
| `response-format.ts` | Résolution des libellés, formats de date, pièces jointes et signatures recopiées intactes |
| `document-fields.ts` | Stabilité des jetons après renommage, déduplication globale, jetons de cases à cocher |
| `webhook-retry.ts` | Cadence des reprises : progression croissante, écart aléatoire jamais négatif, épuisement après six tentatives |

### Écrire un test qui serve à quelque chose

- **Nommez le comportement, pas la fonction.** « ne compte pas deux fois une option stockée sous deux
  formes » se lit ; « teste computeReportStats » ne dit rien.
- **Expliquez le *pourquoi* quand il n'est pas évident**, en commentaire au-dessus du test — même
  règle que pour le code. Un test qui paraphrase l'implémentation n'apprend rien et bloque toute
  refonte.
- **Testez ce que la documentation promet.** Les sections de [CLAUDE.md](CLAUDE.md) décrivent des
  décisions précises — les libellés résolus à l'affichage et jamais réécrits, l'anti-spam actif par
  défaut, la date de clôture qui plafonne toute période, un jeton de document qui survit à un
  renommage. Ce sont ces garanties-là qui méritent un test.
- **Vérifiez que le test échoue quand le comportement casse.** Cassez volontairement la ligne
  concernée et relancez : si la suite reste verte, le test ne teste rien. Cette suite a été
  contrôlée ainsi, et le procédé a révélé un vrai trou — une reconstitution de libellé n'était
  exercée que par son court-circuit, jamais par la boucle qui lui donne sa raison d'être.

### Ce qui n'est pas couvert

Les routes API, les composants React et les modules serveur (Prisma, envoi d'e-mails, rendu PDF,
conversion de documents, file de reprise des webhooks) n'ont pas de tests automatisés. C'est le `next build` de l'intégration
continue qui les garde compilables, et rien de plus : une modification qui les touche demande une
vérification manuelle.

---

## Intégration continue

`.github/workflows/ci.yml` s'exécute à chaque poussée sur `main` et à chaque pull request.

**Vérification** — `npm ci`, génération du client Prisma, `npm run typecheck`, `npm test`, puis
`npm run build`. Le build n'est pas redondant avec le typecheck : lui seul détecte un module serveur
importé depuis un composant `'use client'`, un paquet qui ne s'empaquette pas, ou une route qui ne
compile pas.

**Migrations** — un second job rejoue `prisma migrate deploy` sur une base vide, la peuple avec
`db:seed`, puis rejoue les migrations. Ce n'est pas une formalité : une migration qui reconstruit une
table passe sur une base vide (le `INSERT ... SELECT` ne copie alors aucune ligne) et échoue sur une
base peuplée. C'est exactement ainsi que `20260609000000_form_userid_nullable` est partie cassée et a
bloqué toutes les instances existantes sur `P3009`. Voir [Migrations de base de données](#migrations-de-base-de-données).

La version de Node vient de `.nvmrc`, pour que le runner, l'image Docker et le poste de
développement ne puissent pas diverger — voir [Parité des versions d'exécution](#parité-des-versions-dexécution).

**`npm run lint` n'est pas lancé en CI** : sans configuration ESLint préexistante, la commande ouvre
l'assistant interactif de Next et se bloque indéfiniment sur un shell non interactif. Ce sont
`typecheck`, `test` et `build` qui font foi.

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

## Parité des versions d'exécution

L'image Docker utilise la version de Node fixée dans `.nvmrc` (actuellement **24**). Gardez votre
Node local sur la même version majeure.

Quand les deux divergent, une API présente en local compile, passe tous les tests locaux, et
n'échoue qu'en production — le build ne détecte rien. C'est déjà arrivé : l'image tournait sur
`node:18-alpine` tandis que le développement se faisait sous Node 24, et `file instanceof File`
levait `ReferenceError: File is not defined` à chaque import de modèle, `File` n'étant devenu un
global Node qu'en **Node 20**.

Deux réflexes en découlent :

- Préférer un test de forme à `instanceof` pour tout ce qui vient du runtime (fichiers envoyés,
  flux). La validation d'import dans `src/app/api/forms/[id]/document/template/route.ts` vérifie la
  présence de `arrayBuffer()` et `size` — indépendant de la version, et pas une ligne de plus.
- Avant de changer la version de l'image, consulter le [calendrier des versions Node](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json)
  plutôt que de supposer qu'une majeure est encore suivie : la 18 est en fin de vie depuis avril
  2025 et la 20 depuis avril 2026.

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

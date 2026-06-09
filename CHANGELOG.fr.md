# Journal des modifications

Toutes les évolutions notables de FormBuilder Standalone sont documentées ici.

> **English version**: [CHANGELOG.md](CHANGELOG.md)

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [Non publié]

### Ajouts
- **Suppression de compte — formulaires préservés dans la corbeille** — la suppression d'un compte utilisateur ne détruit plus définitivement ses formulaires ; tous les formulaires actifs sont d'abord placés en corbeille avant la suppression du compte ; `Form.userId` est ensuite mis à `null` par `onDelete: SetNull` ; les formulaires orphelins s'affichent dans la corbeille avec un badge amber "Compte supprimé" et nécessitent une réassignation obligatoire de propriétaire avant de pouvoir être restaurés (la route de restauration renvoie 400 sans `userId`)

### Corrections
- **Dockerfile — conflit de version Prisma en CI/CD** — `npx prisma generate` à l'étape de build pouvait télécharger silencieusement une version plus récente du CLI Prisma (Prisma v6+ en 2026 utilise un format de configuration `url` différent), provoquant l'échec de `npm run build` ; remplacé par `./node_modules/.bin/prisma generate` pour toujours utiliser le binaire local du projet ; `package-lock.json` est désormais versionné (retiré de `.gitignore`) et le Dockerfile utilise `npm ci` pour des builds reproductibles

### Ajouts
- **Panneau Journal d'activité** (`/admin/logs`) — nouvelle section d'administration qui enregistre et présente les événements de sécurité et de modification de contenu :
  - Journalise les connexions (qui, adresse IP, succès ou échec et raison), les déconnexions, les inscriptions, les demandes/validations de réinitialisation de mot de passe, tout le cycle de vie des formulaires (création, modification, publication/dépublication, suppression, restauration, suppression définitive, duplication, création/restauration de version), et les actions de gestion des utilisateurs (création, modification avec suivi des changements de rôle, suppression)
  - Tableau filtrable et paginé (`/api/admin/logs`) — par action/catégorie, statut (succès/échec), plage de dates et recherche libre sur l'utilisateur, l'email, l'adresse IP et la cible
  - Export de la vue filtrée actuelle vers Excel (`/api/admin/logs/export`, plafonné à 50 000 lignes) — garanti identique à ce que l'admin a sous les yeux, grâce aux mêmes fonctions partagées `buildAuditLogWhere`/`parseLogFilters` que la liste
  - Durée de conservation configurable (en jours, 365 par défaut) avec un bouton de purge manuelle "Purger les entrées expirées" — même principe de revue avant purge que la carte de rétention RGPD, date de coupure toujours recalculée côté serveur
  - Alerte email optionnelle vers une adresse dédiée et configurable après un nombre configurable de tentatives de connexion échouées consécutives (désactivée par défaut ; seuil réglé aux côtés des paramètres anti-bruteforce existants dans `/admin/security`) — envoie une seule alerte par cycle d'échecs (le compteur revient à zéro sur connexion réussie ou nouvelle fenêtre de temps), pas un email par tentative au-delà du seuil

### Ajouts
- **Panneau de conformité RGPD** (`/admin/gdpr`) — nouvelle section d'administration pour la durée de conservation et les droits des personnes :
  - Durée de conservation maximale des réponses configurable (durée légale par défaut : 36 mois) ; un bouton "Purger les réponses expirées" affiche d'abord le nombre concerné (avec répartition par formulaire) avant toute suppression manuelle — pas de purge automatique par tâche planifiée
  - Recherche globale, tous formulaires confondus, des réponses appartenant à une personne (nom, email, ou tout texte présent dans les données soumises), avec une étape de revue — l'admin coche/décoche chaque résultat avant d'agir, de sorte que l'export et la suppression ne portent jamais que sur des identifiants explicitement vérifiés
  - Export des réponses sélectionnées au format Excel (portabilité — une feuille par formulaire, valeurs lisibles avec libellés de choix résolus et dates formatées) ou récapitulatif PDF (formulaire + date de soumission par réponse) à transmettre à la personne concernée ; le PDF peut être nominatif (`Concernant : <nom>`) en reprenant le terme de recherche utilisé pour identifier la personne
  - Suppression manuelle (droit à l'effacement) des réponses sélectionnées, avec confirmation
  - Mention RGPD optionnelle (lien + fenêtre modale) sur les blocs Écran d'accueil / Écran de fin — l'admin du formulaire rédige un texte personnalisé (durée de conservation, droits, contact DPO…) affiché à la demande aux répondants

### Corrections
- **Export PDF en échec en production (`500` sur `/api/admin/gdpr/export`)** — `pdfkit` charge ses métriques de polices (fichiers `.afm`) au runtime via des chemins relatifs à `__dirname` ; en mode `output: 'standalone'`, webpack embarquait le module dans les chunks serveur, si bien que `__dirname` ne pointait plus vers son vrai dossier et `fs.readFileSync` échouait avec `ENOENT`. Le module `pdfkit` est désormais déclaré comme dépendance externe via `experimental.serverComponentsExternalPackages` dans `next.config.js` (Next le trace alors intact dans `.next/standalone/node_modules`), et une copie explicite a été ajoutée dans le `Dockerfile`, sur le même principe que le contournement déjà en place pour `bcryptjs`

### Ajouts
- **Panneau d'administration Sécurité** (`/admin/security`) — protection anti-bruteforce et contrôle d'accès par adresse IP :
  - Protection anti-bruteforce configurable : activation/désactivation, nombre maximal de tentatives échouées, fenêtre de temps et durée de blocage
  - Listes blanche / noire d'adresses IP avec note optionnelle ; les IP en liste blanche contournent toujours le blocage
  - Liste en direct des IP actuellement bloquées avec le nombre de tentatives échouées et le temps de blocage restant
  - Les IP en liste noire sont rejetées directement au niveau du middleware Edge (`middleware.ts`) via un cache mémoire rafraîchi toutes les 60 secondes depuis l'endpoint interne `/api/internal/ip-lists` (le Edge Runtime ne peut pas utiliser Prisma/SQLite directement) ; "fail open" en cas d'échec réseau pour ne jamais bloquer tout le monde par accident

### Corrections
- **Docker — le volume SQLite recouvrait les fichiers Prisma embarqués** — les fichiers `docker-compose*.yml` montaient le volume `sqlite-data` directement sur `/app/prisma`, masquant `schema.prisma` et les migrations copiés dans l'image au moment du build ; la base de données réside désormais dans un sous-dossier dédié `/app/prisma/data` (`DATABASE_URL=file:/app/prisma/data/dev.db`)

### Ajouts
- **Personnalisation de la page de connexion** — nouvelle carte "Page de connexion" dans Admin → Personnalisation (`/admin/customization`) permettant de configurer :
  - L'affichage ou non du lien "Mot de passe oublié ?"
  - Le fond de la page : couleur unie, dégradé (8 directions, couleurs de départ/fin personnalisées) ou image — avec un flou réglable (0–40 px) créant un effet fondu derrière la carte de connexion (qui reste toujours nette)
  - Un raccourci pour "Autoriser les inscriptions" — reflète le même réglage global `registrationEnabled` que Admin → Paramètres généraux, toujours synchronisé
  - Un aperçu en direct identique pixel pour pixel à la vraie page de connexion (fonction partagée `getLoginBackgroundStyle()`)

### Corrections
- **Lien "S'inscrire" persistant sur la page de connexion** — `/api/settings/public` était une route sans fonction dynamique, donc Next.js mettait sa réponse en cache au moment du build en production ; désactiver "Autoriser les inscriptions" dans l'administration n'était jamais répercuté sur la page de connexion en ligne avant un nouveau build. Ajout de `export const dynamic = 'force-dynamic'` (même correctif que celui déjà utilisé sur la page du dashboard) pour que le réglage soit relu à chaque requête.

### Ajouts
- **Thème — couleur de fond des choix** (`choicesBgColor`) — nouvelle propriété de thème permettant de définir une couleur de fond indépendante pour les options non sélectionnées dans les blocs Choix multiple, Sélection image et Listes déroulantes ; appliquée au panneau de suggestions des listes déroulantes, aux items de choix dans le formulaire publié, dans l'aperçu central de l'éditeur et dans l'aperçu latéral

### Corrections
- **Navigation molette dans le formulaire public** — le scroll molette ne permettait pas de naviguer entre les questions ; un écouteur `wheel` a été ajouté (seuil 30 px, cooldown 600 ms) ; le scroll à l'intérieur d'un élément scrollable (liste déroulante ouverte) ne déclenche pas de navigation — détection via remontée du DOM jusqu'à `body`
- **Champs requis des groupes non validés par les boutons de navigation** — les boutons ↑/↓ et la molette pouvaient passer à la question suivante même si un champ requis à l'intérieur d'un bloc Groupe n'était pas rempli ; la validation des champs requis des blocs internes est maintenant vérifiée avant toute navigation
- **Thème non appliqué dans l'aperçu central** — les propriétés `buttonsBorderRadius`, `inputStyle` et `inputBorderRadius` n'étaient pas pris en compte par le preview central de l'éditeur (`CenterBlockPreview`) ; tous les boutons et champs texte reflètent désormais fidèlement le style du thème (arrondi, style souligné/bordure/rempli) dès la modification dans l'éditeur de thème, sans attendre la publication

### Modifications
- **Aperçu du builder — rendu fidèle** — le bouton Aperçu n'utilise plus une réimplémentation interne (`form-preview.tsx`) qui divergeait du vrai rendu ; il sauvegarde maintenant les modifications en attente, puis ouvre un iframe auth-protégé vers `/forms/[id]/preview` qui rend exactement le même composant `PublicFormClient` que le formulaire publié — l'aperçu est garanti identique à la production en toutes circonstances ; `form-preview.tsx` est conservé mais n'est plus utilisé

### Ajouts
- **Endpoint de prévisualisation** (`/forms/[id]/preview`) — route serveur auth-protégée qui rend n'importe quel formulaire (brouillon ou publié) avec le renderer public complet ; accessible aux propriétaires, collaborateurs (tout niveau de permission) et administrateurs ; utilisé comme cible iframe par le bouton Aperçu du builder

### Corrections
- **Personnalisation non appliquée** — le logo, le nom du site et le favicon enregistrés dans le panneau d'administration étaient ignorés par l'en-tête du dashboard (valeurs codées en dur "FB" / "FormBuilder") et le titre de l'onglet (métadonnées statiques) ; la page du dashboard récupère désormais `SystemSettings` côté serveur et passe `siteName` / `siteLogo` au composant client ; `layout.tsx` utilise `generateMetadata()` (async) pour injecter le titre et le favicon dynamiquement

### Ajouts
- **Logo dans les formulaires** — affichage du logo de la personnalisation dans le formulaire public ; position configurable (en haut / en bas) et alignement (à gauche / au centre / à droite) depuis les paramètres du formulaire ; fonctionne dans les trois layouts (standard, float, split)
- **Versionnage des formulaires** — historique hybride automatique/manuel pour chaque formulaire
  - Snapshot automatique toutes les 10 sauvegardes (badge Auto, bleu)
  - Bouton "Enregistrer la version actuelle" avec label optionnel (badge Manuel, vert)
  - Modal d'historique accessible depuis le menu du dashboard ("Historique des versions") et le header du builder (bouton "Versions")
  - Restauration en un clic — l'état courant est snapshoté automatiquement avant chaque restauration ("Avant restauration vN") pour ne jamais perdre de données
  - Suppression d'une version avec confirmation en deux clics (évite les suppressions accidentelles)
  - Barre de recherche (apparaît dès 4 versions) — filtre sur le label, le titre, le numéro et le type (auto/manuel) ; bouton × pour effacer ; compteur de résultats
  - Versions listées par ordre chronologique inverse avec numéro, label, badge de type, titre et date
- **Éditeur de logique visuel** — modal plein écran (style Tripetto) pour construire la logique conditionnelle visuellement ; cartes de blocs disposées en flux vertical, flèches SVG orthogonales reliant les blocs source et cible, coins arrondis, badges colorés sur les flèches affichant le résumé de la règle
  - Alternance gauche/droite des lanes par règle pour minimiser les chevauchements
  - Pools de lanes indépendants par côté avec algorithme d'assignation non chevauchant
  - Décalage de ±16 px par règle pour éviter les départs/arrivées au même Y depuis un même bloc
  - Clic sur une flèche ou le nom d'un bloc pour ouvrir directement l'éditeur de règle
  - Panneau de navigation des règles — liste toutes les règles du bloc sélectionné ; clic pour changer sans grand mouvement de souris
  - Listes déroulantes de blocs avec recherche en temps réel (filtre sur le label)
  - Bloc "Si" par défaut = bloc source ; bloc "Alors" par défaut = bloc immédiatement suivant
  - Numérotation des blocs dans les listes = position réelle dans le formulaire (index original, pas l'index de la liste filtrée)
  - Labels alignés à droite sur les lanes gauches, à gauche sur les lanes droites — écart visuel symétrique des deux côtés
  - L'éditeur de règle s'ouvre automatiquement à la création d'une nouvelle règle

### Corrections
- **`addLogicRule` — écrasement d'ID** — le store remplaçait l'ID de règle fourni par un nouveau `uuidv4()`, rendant la règle introuvable après sélection ; l'ID fourni est maintenant conservé
- **Éditeur visuel — numérotation incorrecte** — les listes déroulantes de conditions utilisaient l'index de la liste filtrée `selectable` au lieu de la position réelle du bloc dans le tableau complet `blocks`
- **Éditeur visuel — label gauche trop décalé** — les labels des lanes gauches étaient trop éloignés et visuellement incohérents par rapport aux labels droites ; corrigé par alignement à droite flush sur la ligne de lane et marge gauche élargie (`BL` 220 → 260)

---

## [1.5.0] — 2026-05-17

### Ajouts
- **Bloc "Oui / Non"** — question avec deux boutons Oui/Non ; masquage conditionnel des blocs suivants selon la réponse ; disponible dans les blocs simples, groupes et répéteurs
- **Éditeur de logique conditionnelle** — champ de recherche en temps réel (filtre insensible à la casse sur le label)
- **Panneau des blocs** — champ de recherche filtrant les blocs par nom ; remonte aussi les blocs internes des groupes et répéteurs ; bouton × pour effacer ; état vide "Aucun bloc trouvé" ; drag & drop suspendu pendant la recherche
- **Webhooks — glisser-déposer des mappings** (vue agrandie) — poignée `⠿` sur chaque ligne ; désactivée automatiquement quand un filtre de recherche est actif
- **Webhooks — recherche des mappings** (vue agrandie) — barre de recherche filtrant sur la clé JSON et le label du champ ; compteur de résultats ; bouton × pour vider ; réinitialisée à chaque ouverture
- **Liste déroulante — filtrage des choix** — masquer certains choix selon la réponse d'un bloc précédent (liste, choix multiple ou sélection image) ; panneaux dépliables par valeur source avec cases à cocher ; compteur "N masqué(s)" ; recherche intégrée pour les grandes listes ; fonctionne dans les blocs simples, groupes et répéteurs
- **Mapping webhook — recherche de bloc** — champ de recherche intégré dans le sélecteur de champ ; filtre les blocs disponibles en temps réel
- **Bloc Quantité** — liste d'articles avec quantités individuelles ; max et valeur par défaut configurables par ligne ; format de sortie sélectionnable ; disponible dans les blocs simples, groupes et répéteurs ; recherche dans l'éditeur de choix
- **Choix multiple — option "Autre"** — champ de saisie libre en complément des options prédéfinies ; correctement exporté dans les réponses et webhooks ; fonctionne dans les blocs simples, groupes et répéteurs
- **Masquer les choix déjà sélectionnés dans les répéteurs** — évite la sélection d'une même option sur plusieurs itérations
- **Panneaux redimensionnables** dans le builder — glisser la bordure entre les panneaux gauche/droit
- **Groupes et répéteurs pliables** dans la liste des blocs — bouton replier/déplier pour désencombrer le panneau

### Modifications
- Les webhooks exposent désormais les blocs internes des groupes et répéteurs dans le sélecteur de mapping
- Meilleur affichage des labels des blocs groupe et répéteur dans le panneau latéral

### Corrections
- **Transformation du texte dans les groupes** — l'auto-transformation (MAJUSCULES / Initiales) n'était pas appliquée aux blocs Texte Court à l'intérieur d'un groupe
- **InnerBlockInput — stale closure** — `onNext()` appelé avec une fermeture React périmée sur `answers` dans les blocs internes ; corrigé en fusionnant `currentValue` avant l'appel
- **InnerBlockInput — valeur non transmise à onNext** — la valeur sélectionnée n'était pas passée en second argument de `onNext()`, causant des incohérences de navigation
- **isInnerBlockVisible / getNextVisibleInnerIndex** — déplacées hors du composant React pour éviter les avertissements `react-hooks/exhaustive-deps`
- **TypeScript TS2554** — la prop `onNext` n'acceptait qu'un argument (`skipValidation`) ; correctement typée pour deux arguments
- **Éditeur de logique — affichage** — ajustements CSS pour améliorer la lisibilité des blocs et règles dans le panneau

---

## [1.4.1] — 2026-05-16

### Ajouts
- **Corbeille des formulaires** — soft delete : les formulaires supprimés vont en corbeille au lieu d'être effacés immédiatement (champ `deletedAt` sur le modèle `Form`)
- **Panneau Corbeille** (`/admin/trash`) — liste tous les formulaires supprimés avec propriétaire, date de suppression et nombre de réponses ; Restaurer (avec réassignation optionnelle) et Supprimer définitivement (avec confirmation)
- **Bloc Adresse** — autocomplétion en temps réel via l'API Adresse officielle (BAN, gratuit, sans clé) ; debounce 300ms ; navigation clavier (↑↓ Entrée Échap) ; saisie libre possible ; placeholder configurable ; disponible dans les blocs simples, groupes et répéteurs
- **Texte Court — transformation automatique** — option "Formatage de la réponse" : Aucun / MAJUSCULES / Première lettre, appliqué en temps réel pendant la frappe
- **Écran de remerciement — bouton Recommencer** — toggle dans les propriétés du bloc ; texte personnalisable (défaut : "Recommencer") ; réinitialise complètement le formulaire pour une nouvelle soumission ; aperçu en direct dans le builder
- **Webhooks — vue agrandie** — bouton "Agrandir" par webhook ouvre une modal plein écran (configuration + mapping côte à côte) ; blocs internes disponibles dans le sélecteur
- **Webhooks — valeur personnalisée** — nouveau type `_custom` avec éditeur de template ; supporte `{field:blockId}`, `{date:dd-MM-YYYY}`, `{time:HH-mm-ss}`, `{entry_id}`, `{form_id}` ; aperçu en temps réel

### Corrections
- **Droits admin — suppression de formulaire** — un administrateur ne pouvait pas supprimer un formulaire d'un autre utilisateur
- **Logique conditionnelle — saut décalé** — race condition sur les indices après mise à jour de `visibleBlocks` ; corrigé via une ref toujours synchronisée
- **Logique conditionnelle — masquage prématuré** — `not_equals` avec `undefined` cachait les blocs dès le chargement ; tous les opérateurs retournent maintenant `false` si la réponse est absente
- **Logique conditionnelle — masquage automatique du groupe** — si tous les blocs internes d'un groupe sont cachés, le groupe lui-même est maintenant masqué
- **Webhooks — TypeError sur blocs internes** — `blocks.find()` ne cherchait qu'au premier niveau ; ajout de `findBlockDeep()` récursif
- **Webhooks — labels et dates lisibles** — les webhooks envoyaient les valeurs brutes (slugs, ISO) au lieu des libellés et dates formatées
- **Bloc Adresse — race condition** — clic sur une suggestion appelait `onNext()` avec une fermeture périmée ; corrigé

---

## [1.4.0] — 2026-01-19

### Ajouts
- **Liste déroulante — autocomplétion permanente** — toutes les listes déroulantes utilisent maintenant un composant avec autocomplétion ; navigation clavier ; nouvelle option "Autoriser les réponses personnalisées"
- **Bloc Sélection Image** — choix illustrés par des images cliquables ; deux dispositions : côte à côte (2/3/4 colonnes, responsive) ou superposé ; taille d'image configurable, labels optionnels, sélection simple ou multiple ; upload intégré ou URL externe ; support complet dans groupes et répéteurs
- **Bloc Téléphone — validation avancée** — choix du format (Standard / International) ; nombre de chiffres configurable ; clavier numérique sur mobile ; validation en temps réel
- **Bloc Email — validation avancée** — validation stricte activée par défaut ; désactivable par bloc

### Corrections
- **Logique "Sauter vers" pour les groupes** — les règles sur les blocs internes d'un groupe n'étaient pas évaluées
- **Logique "Sauter vers"** — la logique s'appliquait à tous les blocs au lieu du seul bloc affiché
- **Variables (@1, @2, etc.) dans les groupes** — les variables de remplacement fonctionnent maintenant dans les groupes et leurs blocs internes
- **Liste déroulante — avancement automatique** — le formulaire ne passait plus à la question suivante pendant la frappe

---

## [1.3.0] — 2026-01-18

### Ajouts
- **Docker multi-architecture** — `docker-compose.yml` (universel, auto-détection), `docker-compose.amd64.yml`, `docker-compose.arm64.yml` ; healthchecks ajustés ; documentation dans DEPLOY-PORTAINER.md
- **Sélecteur de colonnes** sur la page des réponses — bouton engrenage, cases à cocher par question, "Tout afficher / Réinitialiser", Date toujours visible, 4 premières questions par défaut
- **Modal de partage** — bouton "Partager" dans le builder ; 4 modes : lien direct, shortcode, embed (iframe), QR code téléchargeable
- **Autocomplete pour le partage** — recherche les utilisateurs par nom ou email ; debounce 300ms
- **3 niveaux de permissions** — Lecture, Édition, Administrateur ; modification en direct via menu déroulant
- **Slug personnalisable** — modifiable dans les paramètres du formulaire
- **Formulaires publics à la racine** — accessibles à `/{slug}` ; anciennes URLs `/f/[slug]` redirigées automatiquement
- **Refonte du Dashboard** — gradient, 4 cartes de stats, glassmorphism, cartes redessinées, badges modernisés
- **Refonte de la page Réponses** — 3 cartes de stats, tableau avec gradient, dates sur deux lignes, pagination cliquable
- **Indicateur de statut webhook** par réponse — vert / rouge / orange / gris ; mis à jour après chaque envoi
- **Bloc Groupe dans les réponses** — champs internes affichés dans le modal et exportés en colonnes séparées
- **Optimisation mobile** du formulaire public
- **Barre de progression configurable** — position et taille
- **Gestion des polices** (`/admin/fonts`) — ajout/suppression de polices Google ; aperçu en direct ; 20 polices par défaut
- **Thèmes avancés** — fond uni, dégradé (2 couleurs + 8 directions + opacité), image de fond (+ opacité) ; live preview
- **SMTP — Nom de l'expéditeur** — nouveau champ pour personnaliser le nom affiché dans les emails
- **Bloc Heure** — saisie d'une heure ou plage horaire ; labels personnalisables ; design moderne
- **Renvoi de webhook par réponse** depuis la page des réponses
- **Intégration Nextcloud** dans le panneau d'administration
- **Bibliothèque de modèles** dans le panneau d'administration

### Corrections
- **Cache du Dashboard** — les nouveaux formulaires apparaissent immédiatement (`force-dynamic`)
- **Rendu du bloc Téléphone** dans le formulaire public
- **Rendu du bloc Liste déroulante** dans le formulaire public
- **Upload d'images en Docker** — 404 résolu
- **Initialisation de la colonne `webhookStatus`** — ajoutée automatiquement si manquante

---

## [1.0.0] — 2024-xx-xx

### Ajouts
- Version initiale
- Authentification (inscription, connexion, déconnexion, mot de passe oublié/réinitialisé)
- Éditeur de formulaires par glisser-déposer
- Blocs de base : texte court, texte long, email, téléphone, nombre, choix multiple, menu déroulant, date, site web, écran d'accueil, écran de remerciement
- Logique conditionnelle (afficher/masquer/sauter/rendre obligatoire) avec éditeur visuel
- Webhooks de base (POST/GET/PUT/PATCH, JSON/FORM)
- Personnalisation de thème de base (couleurs, polices, styles boutons/champs)
- Import/export des formulaires en JSON
- Visualisation des réponses avec export XLSX
- Suivi des réponses partielles
- Gestion des utilisateurs (panneau d'administration)
- Réinitialisation du mot de passe par email (Nodemailer)
- Base de données SQLite via Prisma ORM
- Déploiement Docker (build multi-stage)
- Compte administrateur créé automatiquement au premier démarrage

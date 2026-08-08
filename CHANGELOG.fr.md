# Journal des modifications

Toutes les évolutions notables de FormBuilder Standalone sont documentées ici.

> **English version**: [CHANGELOG.md](CHANGELOG.md)

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [Non publié]

### Ajouts
- **Rapports périodiques en PDF, envoyés par e-mail** — un bouton « Rapports » sur la barre de la page des réponses, à côté de « Exporter CSV », ouvre une modale à trois onglets qui produit une synthèse lisible des réponses et l'envoie automatiquement :
  - **Période** — fenêtre glissante (N derniers jours), mois en cours, mois précédent, depuis le dernier rapport (aucune réponse comptée deux fois), plage de dates fixe, ou depuis la création. Une **date de clôture** facultative plafonne définitivement la borne haute : passée cette date, tous les rapports décrivent le même corpus figé au lieu de s'étendre indéfiniment, avec option d'**envoi d'un rapport final le soir de la clôture** (une seule fois). Cette date ne ferme pas le formulaire aux nouvelles réponses — elle ne concerne que les rapports.
  - **Contenu** — sept sections activables une à une : indicateurs clés (total, moyenne par jour, évolution en % face à la période équivalente précédente, journée la plus active, taux de remplissage moyen), évolution des réponses en histogramme (granularité jour / semaine / mois choisie selon l'étendue de la période), **répartition des choix en pourcentage** avec barres pour les listes, choix multiples, sélections d'image, Oui/Non, mentions légales et quantités cumulées, statistiques numériques (min, moyenne, médiane, max, cumul), réponses libres (valeurs récurrentes puis derniers verbatims), taux de remplissage par question, et tableau des dernières réponses.
  - **Envoi** — planification quotidienne, hebdomadaire (jour de la semaine au choix) ou mensuelle (jour du mois, plafonné au 28 pour que l'envoi ait lieu aussi en février), heure au quart d'heure, plusieurs destinataires, objet et corps HTML acceptant des jetons (`{form_title}`, `{period}`, `{response_count}`, `{generated_at}`…).
  - Un **bandeau d'aperçu chiffré en direct** en haut de la modale (réponses sur la période, période analysée, remplissage moyen, prochain envoi) recalculé à chaque réglage par la **même fonction que le PDF**, plus « Télécharger le PDF » pour contrôler le résultat exact avant de programmer quoi que ce soit, et « Envoyer maintenant » pour un envoi de contrôle.
  - Les questions à choix sont **résolues en libellés à l'affichage** : une réponse ancienne stockée en slug (`technique`) et une réponse récente stockée en libellé (`Technique`) sont comptées comme une seule et même option. Un libellé contenant une virgule (« Écran, second ») est reconstitué au lieu d'être coupé en deux options inexistantes. Les champs d'un répéteur sont agrégés sur toutes leurs itérations.
  - Le déclenchement repose sur une **minuterie en processus** (vérification toutes les 5 minutes, `REPORT_SCHEDULER_INTERVAL_MINUTES`, désactivable par `REPORT_SCHEDULER=0`) : aucun cron externe à configurer. Un conteneur arrêté une semaine envoie **un** rapport au redémarrage, pas sept. Pour les déploiements qui préfèrent piloter l'envoi eux-mêmes, `POST /api/internal/reports/run` déclenche le même passage (secret partagé, comme `/api/internal/ip-lists`).
- **Génération d'un document Word à partir des réponses, envoyé par e-mail** — un formulaire peut porter un modèle `.docx` dont les jetons sont remplacés par les valeurs d'une réponse, le résultat étant envoyé en pièce jointe :
  - Deux modales distinctes sur la barre de la page des réponses, aux côtés de « Exporter CSV » / « Tout supprimer » — **Modèle de document** (import du `.docx`, tableau des champs et jetons, réglages de sortie) et **E-mail d'envoi** (objet, corps, destinataires)
  - Tableau visuel de tous les champs disponibles : libellé, type, jeton copiable, **réponses possibles** pour les blocs à choix, et présence effective du jeton dans le modèle importé ; les jetons présents dans le document mais inconnus du formulaire sont signalés, puisqu'ils seront rendus vides
  - Les blocs répétables deviennent des jetons de boucle (`{#materiels}` … `{/materiels}`) ; les blocs internes d'un groupe sont exposés comme de simples jetons de premier niveau ; quatre jetons de métadonnées sont toujours disponibles (date de la réponse, date du jour, identifiant de la réponse, titre du formulaire)
  - Les jetons sont enregistrés sous forme d'association `jeton → blockId` dès l'import du modèle, de sorte que **renommer une question dans le builder ne casse jamais un `.docx` déjà rédigé** ; ils sont dédupliqués globalement pour qu'un champ de répéteur ne puisse jamais masquer silencieusement un champ de premier niveau
  - Les destinataires peuvent être des adresses fixes, la valeur d'un ou plusieurs blocs e-mail du formulaire, ou les deux ; l'objet, le corps et le nom du fichier généré acceptent tous les mêmes jetons
  - L'envoi se déclenche automatiquement à la soumission (optionnel) et reste rejouable manuellement ; un indicateur par réponse reprend celui des webhooks, à côté d'un bouton de téléchargement du document rempli (voir l'entrée sur les circuits plus bas pour le détail par circuit)
  - Utilise `docxtemplater` (MIT) plutôt que Carbone : depuis la v3.5.5, Carbone est distribué sous « Carbone Community License », dont les restrictions d'usage (usage interne uniquement, pas d'exposition de la fonctionnalité à des tiers même via un wrapper, pas de Document-Generator-as-a-Service) sont incompatibles avec la licence AGPLv3 de ce projet
- **Panneau d'administration Documents** (`/admin/documents`) — déclaration d'un convertisseur PDF externe (conteneur Gotenberg) avec test de connexion ; l'option de sortie PDF reste masquée dans les formulaires tant qu'un test n'a pas abouti, modifier l'adresse invalide la vérification, et le serveur revérifie la disponibilité à chaque enregistrement pour qu'un réglage `pdf` obsolète ne puisse plus s'appliquer après retrait du convertisseur
- **Suppression de compte — formulaires préservés dans la corbeille** — la suppression d'un compte utilisateur ne détruit plus définitivement ses formulaires ; tous les formulaires actifs sont d'abord placés en corbeille avant la suppression du compte ; `Form.userId` est ensuite mis à `null` par `onDelete: SetNull` ; les formulaires orphelins s'affichent dans la corbeille avec un badge amber "Compte supprimé" et nécessitent une réassignation obligatoire de propriétaire avant de pouvoir être restaurés (la route de restauration renvoie 400 sans `userId`)

### Ajouts
- **Reprise automatique d'une migration bloquée au démarrage du conteneur** — une migration en échec laisse une ligne bloquante dans `_prisma_migrations`, *à l'intérieur du volume de la base* : corriger le SQL fautif et reconstruire l'image ne débloque donc jamais une instance existante, le conteneur continue de redémarrer en boucle sur `P3009` jusqu'à ce qu'on lance `migrate resolve` à la main — peu commode sur un déploiement Portainer. `docker-entrypoint.sh` identifie désormais la migration bloquante (nouveau `scripts/failed-migrations.js`), la marque comme annulée pour que Prisma la rejoue, et retente **une seule fois** ; un second échec arrête le conteneur avec un message explicite plutôt que de boucler indéfiniment. `MIGRATION_AUTO_REPAIR=0` désactive ce comportement. Vérifié de bout en bout en reproduisant la panne réelle — base peuplée, ancien SQL positionnel, boucle `P3009` — puis en exécutant la reprise et en contrôlant que formulaires, réponses et valeurs de colonnes étaient tous intacts.

### Ajouts
- **Envoi conditionnel par circuits** — la liste unique de destinataires laisse place à une liste de circuits, chacun avec ses propres conditions, destinataires, objet et corps, de sorte que seul le service concerné est prévenu : la cantine n'est informée que si une restauration est demandée, le service technique que si du matériel est nécessaire. Les conditions réutilisent les opérateurs de l'éditeur de logique du formulaire (`est égal à`, `contient`, `est vide`…) avec un mode toutes/au moins une, et sont **repliées par défaut** dans chaque carte de circuit, ces réglages étant posés une fois puis rarement rouverts. Un circuit sans condition part systématiquement. Chaque réponse conserve un statut par circuit — déclenché et accepté, déclenché en échec, ou simplement non concerné (affiché en gris, un circuit écarté étant un résultat volontaire et non une erreur) — visible sur la ligne, détaillé dans la fiche de la réponse, avec relance en un clic.
- **Jetons de cases à cocher pour les modèles Word** — chaque option d'un bloc à choix, Oui/Non ou mention légale dispose d'un jeton `{case_…}` qui rend ☒ si l'option est retenue et ☐ sinon (ou `þ`/`¨` en Wingdings, au choix par modèle). L'état vide est un vrai caractère de case : le même modèle imprimé vierge reste donc remplissable à la main, sans rien modifier au document. Les jetons sont listés avec un bouton de copie à côté du champ auquel ils appartiennent, et restent stables si une option est renommée. Les cases à cocher *natives* de Word ne sont pas pilotables ainsi — ce sont des structures XML et non du texte — et doivent être remplacées par un simple caractère.
- **Suivi de l'acceptation SMTP** — le statut par circuit enregistre les adresses acceptées et refusées par le serveur d'envoi, et l'interface parle d'« accepté par le serveur » plutôt que de « délivré » : détecter un rejet plus loin dans la chaîne supposerait de traiter les retours.

### Modifications
- **Image Docker de base passée de `node:18-alpine` à `node:24-alpine`** — Node 18 est en fin de vie depuis avril 2025 et ne reçoit plus de correctifs de sécurité ; Node 20 l'est depuis avril 2026, il n'était donc pas une cible viable non plus. Node 24 est en LTS active jusqu'en octobre 2026 et maintenue jusqu'en avril 2028, et correspond à la version utilisée en développement — ce qui supprime la divergence local/production à l'origine du bug `File is not defined` ci-dessous. Innocuité vérifiée pour ce projet : aucun module natif dans l'arbre de dépendances (aucun `binding.gyp`), toutes les contraintes `engines` satisfaites (la plus stricte étant Next.js à `>=18.17.0`), aucune utilisation d'API retirée entre Node 20 et 24, et aucun `binaryTargets` figé dans `prisma/schema.prisma` — le moteur Prisma est détecté par `prisma generate` dans l'étape builder, qui partage l'image de base du runner, l'ensemble reste donc cohérent. Un `.nvmrc` fixe désormais la même version majeure en développement.

### Corrections
- **Import de modèle en erreur `500` en production (`POST /api/forms/[id]/document/template`)** — la route validait le fichier reçu avec `file instanceof File`, or **`File` n'est devenu un global Node qu'en Node 20** alors que l'image Docker tourne sur `node:18-alpine`. Le seul fait de référencer l'identifiant levait donc `ReferenceError: File is not defined` à chaque import. Le problème est passé au travers des tests locaux, la machine de développement tournant sous Node 24 — même divergence local/production que le bug de migration ci-dessous. La vérification porte désormais sur la forme de l'objet (présence de `arrayBuffer()` et `size`), ce qui fonctionne quelle que soit la version de Node.
- **Erreurs `500` opaques sur les routes document** — aucun des nouveaux gestionnaires n'avait le `try/catch` + `console.error` que toutes les autres routes du projet utilisent : la moindre erreur inattendue se traduisait par un 500 sans corps ni trace dans les journaux du conteneur. Ils journalisent tous la cause et renvoient un message exploitable ; un échec d'écriture du modèle indique en outre explicitement que le stockage privé n'est peut-être pas monté ou pas accessible en écriture.
- **Migration `20260609000000_form_userid_nullable` en échec sur toute base construite par `migrate deploy`** — la reconstruction de la table SQLite copiait les lignes avec `INSERT INTO "Form_new" SELECT * FROM "Form"`, qui associe les colonnes **par position**. Or l'ordre physique des colonnes de `Form` diffère selon l'origine de la base : avec `migrate deploy`, `deletedAt` et `saveCount` ont été ajoutés par des `ALTER TABLE` ultérieurs et se trouvent donc *après* `createdAt`/`updatedAt`, tandis que `db push` recrée la table dans l'ordre du schéma. Sur une lignée `migrate deploy`, la copie positionnelle décalait `deletedAt` — `NULL` pour tout formulaire non supprimé — dans la colonne `createdAt` déclarée `NOT NULL`, échouant sur `NOT NULL constraint failed: Form_new.createdAt` et bloquant toutes les migrations suivantes avec `P3009`. L'échec ne se produit que sur une base **contenant déjà des formulaires** : sur une base vide, la copie ne porte sur aucune ligne et passe sans erreur, ce qui explique que les déploiements neufs n'aient rien vu. Les colonnes sont désormais listées explicitement, ce qui reste correct pour les deux lignées. Le garde `DROP TABLE IF EXISTS "Form_new"` ajouté au passage s'est révélé indispensable et non précautionneux : la reproduction de la panne montre que Prisma n'annule **pas** la transaction dans ce cas, la table `Form_new` à moitié construite survit à l'échec et ferait échouer la reprise sur « table déjà existante ». Les créations d'index utilisent `IF NOT EXISTS` pour la même raison.
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

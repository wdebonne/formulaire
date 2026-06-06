# Journal des modifications

Toutes les évolutions notables de FormBuilder Standalone sont documentées ici.

> **English version**: [CHANGELOG.md](CHANGELOG.md)

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

---

## [Non publié]

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

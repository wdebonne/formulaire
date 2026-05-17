# Changelog

## 2026-05-17

### Ajouts
- **Champ de recherche dans la liste des blocs** :
  - Champ de recherche avec icône loupe en haut du panneau de liste des blocs
  - Filtre les blocs en temps réel par leur nom (insensible à la casse)
  - Pour les groupes et répéteurs, remonte également si un de leurs blocs internes correspond
  - Bouton × pour effacer la recherche en un clic
  - État vide "Aucun bloc trouvé" affiché si aucun résultat
  - Le glisser-déposer est suspendu pendant la recherche pour éviter les conflits
- **Filtrage des choix dans le bloc Liste déroulante** :
  - Nouvelle section "Filtrage des choix" (panneau violet) dans l'éditeur de chaque liste déroulante
  - Sélection d'un **bloc source unique** (liste déroulante, choix multiple ou sélection image situé avant le bloc) dont la réponse pilote le masquage
  - Pour chaque valeur possible du bloc source, un panneau dépliable liste les choix de la liste déroulante avec des **cases à cocher** (coché = masqué à l'utilisateur final)
  - Compteur "N masqué(s)" affiché sur le panneau replié pour avoir un aperçu sans l'ouvrir
  - **Champ de recherche** dans chaque panneau dépliable : filtre les choix en temps réel, insensible à la casse — indispensable pour les listes de 100 choix ou plus
  - Zone de liste avec hauteur maximale et défilement vertical pour ne pas surcharger l'interface
  - Le filtrage s'applique dans tous les contextes d'affichage : bloc principal, bloc dans un groupe et bloc dans un répéteur
  - Les données de configuration sont stockées dans deux nouveaux attributs : `choiceFilterSourceBlockId` et `choiceFilters`
- **Webhooks — Sélecteur de bloc avec recherche** :
  - Le sélecteur de champ dans l'éditeur de mapping dispose désormais d'un champ de recherche intégré
  - Filtre les blocs disponibles en temps réel par leur label
  - Les blocs internes des groupes et répéteurs sont listés et filtrables

### Améliorations
- **Liste des blocs — Étiquettes des groupes et répéteurs** : Meilleur affichage des labels des blocs de type groupe et répétable dans le panneau latéral
- **Webhooks — Options de mapping** : Les blocs internes des groupes et répéteurs sont désormais inclus dans la liste des options disponibles pour le mapping

---

## 2026-05-16 (suite — nouvelles fonctionnalités)

### Ajouts
- **Nouveau bloc "Quantité"** :
  - Permet de définir des articles/options avec une quantité saisissable pour chacun
  - Configuration des lignes dans l'éditeur : label, quantité max, valeur par défaut
  - Format de sortie configurable (résumé texte, JSON, etc.)
  - Prise en charge complète dans les blocs simples, groupes et répéteurs
  - Filtre de recherche intégré dans l'éditeur de choix pour les grandes listes
  - Auto-initialisation des quantités à zéro pour les blocs internes
- **Option "Autre" pour les blocs Choix multiple** :
  - Nouvelle case "Permettre une réponse libre (Autre)" dans l'éditeur
  - Affiche un champ de saisie libre en plus des options prédéfinies
  - La valeur saisie est correctement exportée et affichée dans les réponses
  - Fonctionne dans les blocs simples, groupes et répéteurs
- **Masquer les choix déjà sélectionnés dans les répéteurs** :
  - Nouvelle option sur les blocs de choix dans un répéteur
  - Empêche de sélectionner deux fois la même option sur des itérations différentes
  - Compatible avec les clés plates des répéteurs
- **Redimensionnement des panneaux dans l'éditeur** :
  - Les panneaux gauche (liste des blocs) et droit (propriétés) sont redimensionnables par glisser-déposer
  - Améliore le confort de travail sur les formulaires complexes
- **Réduction des groupes et répéteurs dans la liste des blocs** :
  - Bouton de pliage/dépliage sur chaque groupe et répéteur dans le panneau latéral
  - Les blocs internes sont masqués quand le groupe est réduit

### Améliorations
- **Gestion de la réponse "Autre"** : Formatage et affichage cohérents dans les réponses, l'export et les webhooks pour toutes les variantes de la réponse libre
- **Bouton OK** : Comportement unifié sur les blocs Choix multiple et Liste déroulante avec valeur personnalisée
- **RepeaterBlock** : Remontage propre des blocs internes pour éviter les états périmés entre itérations
- **InnerBlockInput** : Meilleure gestion des callbacks et des mises à jour d'état pour éviter les écrasements involontaires

---

## 2026-05-16 (soir)

### Ajouts
- **Corbeille des formulaires** :
  - La suppression d'un formulaire est désormais un **soft delete** : le formulaire disparaît du tableau de bord de l'utilisateur mais n'est pas réellement effacé
  - Nouveau champ `deletedAt` sur le modèle `Form` en base de données
  - Nouvelle section **Corbeille** dans le panneau d'administration (`/admin/trash`) :
    - Liste de tous les formulaires supprimés avec propriétaire d'origine, date de suppression et nombre de réponses
    - Bouton **Restaurer** : remet le formulaire en ligne, avec possibilité de le réassigner à un autre utilisateur via un sélecteur
    - Bouton **Supprimer définitivement** : suppression réelle avec confirmation et avertissement sur les réponses associées
  - Les formulaires en corbeille n'apparaissent plus dans le dashboard ni dans les listes API (ni pour l'utilisateur, ni pour les admins dans le dashboard)

### Corrections
- **Droits admin — suppression de formulaire** : Un administrateur système ne pouvait pas supprimer un formulaire appartenant à un autre utilisateur. La vérification utilisait un `findFirst({ userId })` direct au lieu de `checkFormAccess()` qui gère le rôle admin
- **Import — formats et nom de fichier d'exportation** : Amélioration de la gestion des formats d'importation et correction du nom de fichier généré lors de l'export

---

## 2026-05-16

### Ajouts
- **Nouveau bloc Adresse avec autocomplétion** :
  - Champ de saisie d'adresse avec suggestions en temps réel via l'[API Adresse officielle](https://api-adresse.data.gouv.fr) (Base Adresse Nationale — gratuit, sans clé)
  - Debounce 300ms pour limiter les appels réseau
  - Navigation clavier dans les suggestions (↑↓ Entrée Échap)
  - Sélection d'une suggestion → remplit l'adresse complète dans le champ
  - Saisie libre toujours possible si l'adresse n'est pas trouvée par l'API
  - Placeholder configurable dans l'éditeur
  - Disponible dans les blocs simples, groupes et répéteurs
- **Transformation automatique du texte (bloc Texte Court)** :
  - Nouvelle option "Formatage de la réponse" dans l'éditeur : Aucun / MAJUSCULES / Première lettre
  - Appliqué en temps réel pendant la frappe dans le formulaire public
  - Utile pour standardiser la saisie (nom de famille en majuscules, etc.)
- **Bouton "Recommencer" sur l'écran de remerciement** :
  - Toggle activable dans les propriétés du bloc écran de fin
  - Texte du bouton personnalisable (défaut : "Recommencer")
  - Réinitialise complètement le formulaire (réponses, index, état des répéteurs) pour une nouvelle soumission
  - Aperçu en temps réel dans l'éditeur
- **Webhooks — Vue agrandie** :
  - Bouton "Agrandir" dans l'en-tête de chaque webhook
  - Modal plein écran avec 2 colonnes : configuration à gauche, mapping à droite
  - Les blocs internes des groupes et répéteurs sont disponibles dans le sélecteur de champs
- **Webhooks — Valeur personnalisée dans le mapping** :
  - Nouveau type de valeur `_custom` avec un éditeur de template
  - Insertion de champs via `{field:blockId}`, dates `{date:dd-MM-YYYY}`, heures `{time:HH-mm-ss}` et identifiants `{entry_id}`, `{form_id}`
  - Aperçu en temps réel de la valeur résolue

### Corrections
- **Logique conditionnelle — Saut (jump) décalé** : Le saut vers un bloc cible utilisait l'index calculé au moment du clic, mais le `setTimeout(300ms)` se déclenchait après que `setAnswers` avait mis à jour `visibleBlocks` (indices décalés si un bloc était caché). Corrigé via une `ref` toujours synchronisée avec les blocs visibles
- **Logique conditionnelle — Masquage prématuré** : L'opérateur `not_equals` avec une réponse `undefined` évaluait `undefined !== 'X' = true`, cachant les blocs dès le chargement avant toute interaction. Tous les opérateurs (sauf `is_empty` / `is_not_empty`) retournent désormais `false` si la réponse est absente
- **Logique conditionnelle — Groupe masqué automatiquement** : Si tous les blocs internes d'un groupe sont cachés par la logique, le groupe lui-même est maintenant automatiquement masqué (évite l'affichage d'une page vide)
- **Webhooks — TypeError sur blocs internes** : Le mapping webhook vers un bloc interne d'un groupe (ex : champ dans un groupe "Départ") retournait `undefined` car `blocks.find()` ne cherchait qu'au premier niveau. Ajout d'un `findBlockDeep()` qui cherche récursivement dans les `innerBlocks`
- **Webhooks — Labels et dates formatés** : Les webhooks envoyaient les valeurs brutes (`peugeot-expert-2-(fn-492-fa)`, `2026-05-16`) au lieu des labels lisibles (`PEUGEOT EXPERT 2`, `16/05/2026`). Corrigé pour tous les contextes : mapping explicite, groupes, répéteurs et templates personnalisés
- **Bloc Adresse — Valeur saisie ignorée lors de la sélection** : Condition de course résolue — quand l'utilisateur cliquait sur une suggestion, `onNext()` était appelé avec une fermeture React périmée sur `answers` (encore le texte tapé). La sélection met maintenant à jour la valeur sans auto-avancer ; l'utilisateur confirme avec OK ou Entrée

---

## 2026-01-19

### Corrections
- **Logique conditionnelle "Sauter vers" pour les groupes** : Les règles de logique définies sur les blocs internes d'un groupe (4A, 4B, etc.) sont maintenant correctement évaluées et appliquées
- **Logique conditionnelle "Sauter vers"** : La logique de saut fonctionne maintenant correctement - elle s'applique uniquement au bloc actuellement affiché au lieu de toutes les règles de tous les blocs
- **Variables (@1, @2, etc.) dans les groupes** : Les variables de remplacement fonctionnent maintenant correctement dans les titres et descriptions des blocs groupe et de leurs questions internes
- **Liste déroulante avec autocomplétion** : Le formulaire ne passe plus automatiquement à la question suivante pendant la saisie. Le passage se fait uniquement lors d'une sélection explicite (clic sur une option ou touche Entrée)

### Ajouts
- **Autocomplétion pour toutes les listes déroulantes** :
  - Le champ de liste déroulante utilise maintenant **toujours** un composant avec autocomplétion
  - L'utilisateur peut taper pour filtrer les options disponibles
  - Navigation au clavier (flèches haut/bas, Entrée, Échap)
  - Nouvelle option "Autoriser les réponses personnalisées" dans l'éditeur :
    - **Désactivée (par défaut)** : L'utilisateur doit obligatoirement choisir une option de la liste
    - **Activée** : L'utilisateur peut saisir une réponse qui n'est pas dans la liste
  - Message informatif différent selon le mode :
    - Mode fermé : "Aucune option correspondante. Veuillez sélectionner une option de la liste."
    - Mode ouvert : "Aucune option trouvée. Votre réponse sera enregistrée."
  - Fonctionne dans tous les contextes : blocs simples, groupes et répéteurs
- **Nouveau bloc Sélection Image** :
  - Permet de créer des choix avec des images cliquables
  - Deux modes de disposition :
    - **Côte à côte** : Grille avec 2, 3 ou 4 colonnes (responsive sur mobile)
    - **Superposé** : Images empilées verticalement avec labels à côté
  - Options de personnalisation :
    - Taille des images : petite, moyenne ou grande
    - Afficher/masquer les labels sous les images
    - Sélection simple ou multiple
  - Upload d'images intégré ou URL externe
  - Design responsive adapté PC, tablette et mobile
  - Support complet dans les groupes et blocs répétables
- **Validation avancée du bloc Téléphone** :
  - Choix du format : Standard (06 12 34 56 78) ou International (+33 6 12 34 56 78)
  - Nombre de chiffres attendu configurable (par défaut 10 ou 11 selon le format)
  - Seuls les chiffres et caractères autorisés (+, espaces, tirets, points) sont acceptés
  - Clavier numérique automatique sur mobile
  - Validation en temps réel lors de la soumission
- **Validation avancée du bloc Email** :
  - Validation stricte de l'adresse email (activée par défaut)
  - Support des formats complexes : `test@test.fr`, `didier.jean-marie@neuf.com`
  - Option pour désactiver la validation dans les paramètres du bloc
- **Validation dans tous les contextes** :
  - Blocs simples
  - Blocs dans les groupes
  - Blocs dans les répéteurs (repeaters)

---

## 2026-01-18 (nuit - update 2)

### Ajouts
- **Support multi-architecture Docker** :
  - `docker-compose.yml` : Configuration universelle avec auto-détection
  - `docker-compose.amd64.yml` : Configuration optimisée pour Intel/AMD (x86_64)
  - `docker-compose.arm64.yml` : Configuration optimisée pour ARM (Raspberry Pi, Apple Silicon)
  - Healthcheck ajustés selon l'architecture
  - Documentation complète dans DEPLOY-PORTAINER.md

### Corrections
- **Cache du Dashboard** : Les nouveaux formulaires apparaissent immédiatement sans rechargement manuel
  - Ajout de `dynamic = 'force-dynamic'` pour forcer le rendu côté serveur

---

## 2026-01-18 (nuit)

### Ajouts
- **Sélecteur de colonnes** sur la page des réponses :
  - Bouton "Colonnes" avec icône d'engrenage
  - Menu déroulant permettant de choisir les colonnes à afficher
  - Cases à cocher pour chaque question du formulaire
  - Bouton "Tout afficher / Réinitialiser"
  - La colonne Date est toujours visible
  - Par défaut, les 4 premières colonnes sont affichées
- **Autocomplete pour le partage** :
  - Remplacement du champ email par un champ de recherche avec autocomplétion
  - Recherche parmi tous les utilisateurs non-administrateurs
  - Affichage du nom et de l'email dans les suggestions
  - Debounce de 300ms pour optimiser les requêtes
- **Accès aux formulaires partagés** :
  - Les utilisateurs avec permission "Édition" ou "Admin" peuvent accéder au builder
  - Les utilisateurs avec permission "Lecture", "Édition" ou "Admin" peuvent voir les réponses
- **Refonte visuelle du Dashboard** :
  - Fond avec dégradé subtil
  - 4 cartes de statistiques en haut (Total, Publiés, Brouillons, Réponses)
  - Header avec effet glassmorphism
  - Cartes de formulaires redessinées avec barre de couleur indicatrice
  - Badges de statut modernisés avec indicateurs ronds
  - Boutons de filtre intégrés dans un conteneur stylisé
  - Animations et effets de survol améliorés
- **Refonte visuelle de la page Réponses** :
  - 3 cartes de statistiques (Total, Dernière réponse, Questions)
  - Tableau avec en-tête dégradé et lignes alternées
  - Dates affichées sur deux lignes (jour + heure)
  - Pagination avec numéros de page cliquables
  - Modales avec animations et effets blur
  - Design cohérent avec le Dashboard

### Améliorations
- Meilleure gestion des permissions dans les routes API
- Interface utilisateur plus moderne et cohérente

---

## 2026-01-18 (soir)

### Ajouts
- **Gestion avancée des droits de partage** :
  - 3 niveaux de permissions : Lecture, Édition, Administrateur
  - Les administrateurs de formulaire peuvent gérer les partages
  - Modification des permissions en direct via menu déroulant
  - Descriptions des niveaux de droits dans l'interface
- **Chargement dynamique des polices** sur les formulaires publics :
  - Les polices Google Fonts sont maintenant chargées automatiquement
  - Correction de l'affichage des polices personnalisées
- **Amélioration de la duplication** :
  - Le formulaire dupliqué apparaît immédiatement dans la liste sans rafraîchissement

### Corrections
- Correction du script d'initialisation pour ajouter automatiquement la colonne `webhookStatus` si manquante

---

## 2026-01-18 (après-midi)

### Ajouts
- **Indicateur visuel de statut webhook** dans la liste des réponses :
  - Icône verte si tous les webhooks ont réussi
  - Icône rouge si tous ont échoué
  - Icône orange si résultat partiel
  - Icône grise si pas encore envoyé
  - Le statut se met à jour après chaque envoi/renvoi
- **Support complet des blocs Groupe** dans l'affichage des réponses :
  - Les champs internes d'un groupe sont maintenant affichés dans le modal de détail
  - Export CSV avec colonnes séparées pour chaque champ du groupe
- **Optimisation mobile** du formulaire public :
  - Interface tactile améliorée
  - Tailles de police et boutons adaptées
  - Padding et espacements responsives
- **Barre de progression configurable** :
  - Position : haut, bas, gauche ou droite
  - Taille : petite, moyenne ou grande
  - Fonctionne sur le formulaire public

### Corrections
- Correction du rendu du bloc **téléphone** dans le formulaire public
- Correction du rendu du bloc **dropdown** (menu déroulant) - affiche maintenant un vrai select
- Correction de l'upload d'images en mode Docker standalone (404 résolu)
- Bouton OK ajouté au bloc téléphone

---

## 2026-01-18 (matin)

### Ajouts
- **Gestion des polices d'écriture** (Administration) :
  - Nouvelle page d'administration `/admin/fonts` pour gérer les polices
  - Ajout/suppression de polices Google Fonts
  - Aperçu en direct de chaque police avec prévisualisation du rendu
  - Initialisation automatique avec 20 polices par défaut
  - Suggestions de polices populaires lors de la recherche
  - Les polices ajoutées sont automatiquement disponibles dans le sélecteur de thème du form builder
- **Thèmes avancés** :
  - Type de fond : couleur unie, dégradé ou image
  - Dégradé : choix des 2 couleurs, 8 directions possibles, opacité ajustable (0-100%)
  - Image de fond : upload d'image, opacité ajustable (0-100%)
  - **Live preview** : les modifications du thème s'affichent en temps réel dans l'aperçu central de l'éditeur
- **Configuration SMTP** : Ajout du champ "Nom de l'expéditeur" permettant de personnaliser le nom affiché dans les emails (ex: "Mairie de Pavilly" au lieu de juste l'adresse email)
- Bouton "Partager" dans l'éditeur visuel, affiché à droite de "Dépublier" lorsque le formulaire est publié
- Modal de partage avec 4 options :
  - Lien direct
  - Shortcode personnalisable
  - Code Embed (iframe)
  - QR Code généré dynamiquement (téléchargeable)
- Création du composant `ShareDialog` et intégration dans le builder
- Installation de la librairie `qrcode` pour QR code fiable
- Possibilité de modifier le slug (URL) du formulaire dans les paramètres, avant la section Marque
- Bloc "Heure" (type `time`) :
  - Saisie d'une heure au format 24h ou d'une plage horaire (début/fin)
  - Labels personnalisables
  - Aperçu moderne dans le builder et le formulaire public
  - Design avec icône horloge, transitions, responsive
  - Compatible logique conditionnelle et export

### Modifications
- Mise à jour du README.md et DEPLOY-PORTAINER.md pour documenter la nouvelle fonctionnalité de partage et la modification du slug

### Corrections
- Initialisation correcte du dépôt Git
- .gitignore adapté à Next.js, Node, Prisma, Tailwind

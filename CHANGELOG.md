# Changelog

## 2026-01-19

### Corrections
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

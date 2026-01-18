# Changelog

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

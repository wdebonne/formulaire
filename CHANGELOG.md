# Changelog

## 2026-01-18

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

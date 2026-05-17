# FormBuilder Standalone

Un créateur de formulaires autonome avec éditeur visuel, logique conditionnelle, webhooks et personnalisation avancée des thèmes.

## 🆕 Nouveautés (Mai 2026)

### 🔍 Champ de recherche dans la liste des blocs (NOUVEAU)
- Filtrez instantanément vos blocs par nom directement dans le panneau latéral de l'éditeur
- Recherche insensible à la casse, remonte également les blocs internes des groupes et répéteurs
- Bouton × pour effacer la recherche, état "Aucun bloc trouvé" si aucun résultat
- Indispensable pour les formulaires avec de nombreuses questions

### 🔢 Nouveau bloc "Quantité" (NOUVEAU)
- Bloc dédié à la saisie de quantités sur une liste d'articles ou d'options
- Quantité max et valeur par défaut configurables par ligne
- Format de sortie paramétrable, compatible groupes et répéteurs

### ✏️ Option "Autre" pour les Choix multiples (NOUVEAU)
- Activez un champ de saisie libre en plus des options prédéfinies
- La réponse libre est correctement exportée (CSV, webhooks, affichage des réponses)
- Disponible dans les blocs simples, groupes et répéteurs

### 🔽 Filtrage des choix dans la Liste déroulante (NOUVEAU)
- Masquez certains choix selon la réponse d'un **bloc précédent** (liste déroulante, choix multiple ou sélection image)
- Configuration par valeur source : pour chaque option du bloc de référence, cochez les choix à masquer
- **Champ de recherche intégré** dans le panneau de configuration — indispensable pour les listes de 100 choix ou plus
- Fonctionne dans les blocs simples, les groupes et les répéteurs

### 🗑️ Corbeille des formulaires (NOUVEAU)
- La suppression d'un formulaire est désormais un **soft delete** : le formulaire disparaît du tableau de bord sans être définitivement effacé
- Les administrateurs accèdent à la corbeille depuis le panneau d'administration (`/admin/trash`)
- **Restaurer** un formulaire avec possibilité de le réassigner à un autre utilisateur
- **Supprimer définitivement** avec confirmation et avertissement sur les réponses
- Les droits admin permettent désormais de supprimer les formulaires de n'importe quel utilisateur

### Nouveau bloc Adresse
- Autocomplétion en temps réel via l'API Adresse officielle (Base Adresse Nationale)
- Saisie libre possible si l'adresse n'est pas trouvée
- Compatible groupes et répéteurs

### Éditeur amélioré
- **Panneaux redimensionnables** : faites glisser la bordure des panneaux gauche et droit pour adapter l'espace de travail
- **Groupes et répéteurs pliables** dans la liste des blocs pour désencombrer la vue
- **Webhooks** : sélecteur de bloc avec recherche intégrée dans l'éditeur de mapping
- **Masquer les choix déjà sélectionnés** dans les répéteurs (évite les doublons entre itérations)

### Webhooks améliorés
- **Vue agrandie** : modal plein écran avec configuration et mapping côte à côte
- **Valeur personnalisée** : templates avec champs `{field:id}`, dates, heures et identifiants
- **Labels lisibles** : les webhooks envoient désormais les libellés des choix et les dates formatées (plus de valeurs slug ou ISO brutes)
- **Blocs internes** : les champs dans les groupes et répéteurs sont maintenant accessibles dans le mapping

### Logique conditionnelle
- Correction du saut décalé (race condition sur les indices après mise à jour des blocs visibles)
- Correction du masquage prématuré au chargement (`not_equals` avec champ vide)
- Masquage automatique d'un groupe si tous ses blocs internes sont cachés

### Autres ajouts
- **Texte Court** : transformation automatique en majuscules ou initiales pendant la frappe
- **Écran de remerciement** : bouton "Recommencer" pour soumettre plusieurs fois de suite

Consultez le fichier [CHANGELOG.md](CHANGELOG.md) pour le détail complet des évolutions.

## ✨ Fonctionnalités

- 🔐 **Authentification** - Inscription, connexion, mot de passe oublié
- 📝 **Éditeur visuel** - Glisser-déposer pour construire vos formulaires
- 🎯 **Logique conditionnelle** - Afficher/masquer des questions selon les réponses
- 🔗 **Webhooks** - Envoyer les données à des services externes avec indicateur de statut
- 📊 **Réponses** - Visualiser et exporter les réponses en CSV (incluant groupes et repeaters)
- 🎨 **Thèmes avancés** - Personnaliser l'apparence avec fonds unis, dégradés ou images
- 📤 **Import/Export** - Sauvegarder et partager vos formulaires en JSON
- 📱 **Mobile optimisé** - Interface responsive et tactile pour formulaires publics
- 📊 **Barre de progression** - Position (haut/bas/gauche/droite) et taille configurables

## 🎨 Personnalisation des thèmes (NOUVEAU)

- **Type de fond au choix** :
  - **Couleur unie** : choisir une couleur de fond simple
  - **Dégradé** : 2 couleurs + direction (8 directions disponibles) + opacité ajustable
  - **Image** : upload d'image de fond + opacité ajustable
- **Live preview** : visualisez les modifications du thème en temps réel dans l'éditeur
- Plus de 20 polices disponibles
- Choix de la forme des boutons et des champs (arrondi, carré, pilule, etc.)
- Styles d'inputs : souligné, encadré, rempli
- Suppression des thèmes personnalisés (les thèmes par défaut sont protégés)

## 📅 Bloc Date Avancée (NOUVEAU)

- Bloc "Date Avancée" avec calendrier visuel intégré (remplace l'input natif)
- Sélection d'une date ou d'une **plage de dates** (date de début + date de fin)
- Affichage des dates désactivées (min/max, variables, etc.)
- Navigation mois/année, week-ends en rouge, aujourd'hui surligné
- Labels personnalisables pour la plage de dates
- Aperçu fidèle dans le builder (live view)

**Exemples d'usages :**
- Limiter la saisie à une période (ex : réservation, congés)
- Empêcher la sélection de dates passées ou trop lointaines
- Synchroniser la date min/max avec une autre question du formulaire

Voir le bloc "Date Avancée" dans l'éditeur pour toutes les options.

## 🕒 Bloc Heure (NOUVEAU)

- Bloc "Heure" permettant de saisir une heure au format 24h ou une **plage horaire** (heure de début + heure de fin)
- Labels personnalisables pour chaque champ
- Aperçu moderne et responsive dans le builder et le formulaire public
- Design avec icône horloge, effets visuels, et transitions
- Compatible avec la logique conditionnelle et l'export des réponses

**Exemples d'usages :**
- Prise de rendez-vous (heure unique ou créneau)
- Saisie d'horaires d'ouverture/fermeture
- Plage horaire pour réservation de salle, matériel, etc.

Voir le bloc "Heure" dans l'éditeur pour toutes les options.

## � Bloc Groupe (NOUVEAU)

- Regroupe plusieurs questions sous un même ensemble
- Les réponses des blocs internes sont affichées dans le détail et exportées en CSV
- Utile pour organiser des questions liées (ex: informations de contact)

## 🔗 Indicateur de statut Webhook (NOUVEAU)

- L'icône webhook dans la liste des réponses affiche maintenant un indicateur visuel :
  - 🟢 **Vert** : Tous les webhooks ont réussi
  - 🔴 **Rouge** : Tous les webhooks ont échoué
  - 🟠 **Orange** : Certains webhooks ont réussi, d'autres ont échoué
  - ⚪ **Gris** : Pas encore envoyé
- Le statut se met à jour automatiquement après chaque envoi/renvoi

## 👥 Gestion des droits et partage (NOUVEAU)

### Niveaux de permissions

| Permission | Description |
|------------|-------------|
| **Lecture** | Peut voir les réponses du formulaire |
| **Édition** | Peut modifier le formulaire et voir les réponses |
| **Administrateur** | Peut tout faire, y compris gérer les partages |

### Fonctionnalités

- **Partage avec utilisateurs** : Partagez vos formulaires avec d'autres utilisateurs de la plateforme
- **Autocomplete** : Recherchez facilement les utilisateurs par nom ou email
- **Modification des droits** : Changez le niveau de permission d'un utilisateur à tout moment
- **Niveau Administrateur** : Les utilisateurs avec ce droit peuvent eux-mêmes partager le formulaire
- **Notification par email** : Les utilisateurs reçoivent un email lors du partage

### Options de partage

- **Lien direct** : URL publique du formulaire
- **Shortcode** : Code personnalisable pour intégration
- **Embed** : Code iframe pour sites externes
- **QR Code** : Code QR téléchargeable

## 🗑️ Corbeille des formulaires (NOUVEAU)

Lorsqu'un utilisateur supprime un formulaire, celui-ci est placé dans la **corbeille** plutôt que d'être effacé immédiatement.

### Pour les utilisateurs
- Le formulaire disparaît du tableau de bord
- Un message informe que le formulaire peut être restauré par un administrateur

### Pour les administrateurs
La section **Corbeille** dans le panneau d'administration (`/admin/trash`) permet de :

| Action | Description |
|--------|-------------|
| **Restaurer** | Remet le formulaire en ligne pour son propriétaire d'origine ou un autre utilisateur au choix |
| **Supprimer définitivement** | Efface le formulaire et toutes ses réponses de façon irréversible |

> Les formulaires en corbeille n'apparaissent pas dans le dashboard des utilisateurs ni dans les listes admin du tableau de bord.

## 📊 Sélecteur de colonnes (NOUVEAU)

Sur la page des réponses, un bouton **Colonnes** permet de :
- Choisir quelles colonnes de questions afficher dans le tableau
- Afficher toutes les colonnes ou réinitialiser à la vue par défaut
- La colonne Date est toujours visible
- Par défaut, les 4 premières questions sont affichées

## 🚀 Installation

### Prérequis

- Node.js 18+
- npm ou yarn

### Installation

1. Clonez le repository et installez les dépendances :

```bash
cd formbuilder-standalone
npm install
```

2. Copiez le fichier d'environnement :

```bash
cp .env.example .env
```

3. Modifiez les variables dans `.env` selon votre configuration

4. Initialisez la base de données :

```bash
npm run db:push
npm run db:seed
```

5. Lancez le serveur de développement :

```bash
npm run dev
```


6. Ouvrez http://localhost:3000

## 🐳 Déploiement Docker/Portainer

Un guide complet est disponible dans le fichier `DEPLOY-PORTAINER.md` pour déployer l'application sur Portainer avec Docker Compose.

## 📂 Fichiers utiles

- `.gitignore` : fichiers/dossiers exclus du versionnement Git
- `DEPLOY-PORTAINER.md` : guide de déploiement sur Portainer

## 📦 Types de blocs disponibles

- **Écran d'accueil** - Introduction au formulaire
- **Texte court** - Champ de saisie simple (avec transformation optionnelle : majuscules, initiales)
- **Texte long** - Zone de texte multi-lignes
- **Email** - Champ email avec validation stricte configurable (format exemple@domaine.fr)
- **Téléphone** - Champ téléphone avec validation (format standard ou international, nombre de chiffres configurable)
- **Adresse** - Champ adresse avec autocomplétion (API Adresse / BAN, données officielles françaises)
- **Nombre** - Champ numérique
- **Choix multiple** - Sélection unique ou multiple (avec option "Autre" pour réponse libre)
- **Sélection Image** - Choix illustrés par des images cliquables
- **Menu déroulant** - Liste de choix avec autocomplétion, saisie libre optionnelle et filtrage dynamique des choix selon un bloc précédent
- **Quantité** - Liste d'articles avec saisie de quantités individuelles
- **Date** - Sélecteur de date
- **Date avancée** - Calendrier visuel avec plage de dates et contraintes configurables
- **Heure** - Sélecteur d'heure ou plage horaire
- **Téléchargement** - Upload de fichiers
- **Signature** - Zone de signature tactile/souris
- **Curseur** - Valeur numérique avec slider
- **Site web** - URL avec validation
- **Mention légale** - Case à cocher obligatoire
- **Énoncé** - Texte informatif sans saisie
- **Groupe** - Regroupement de plusieurs questions sur une même page
- **Bloc répétable** - Répétition dynamique d'un ensemble de questions
- **Écran de remerciement** - Page de fin personnalisée (avec bouton "Recommencer" optionnel)

## 🔧 Configuration

### Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL de la base de données SQLite |
| `JWT_SECRET` | Secret pour les tokens JWT |
| `SMTP_HOST` | Serveur SMTP pour les emails |
| `SMTP_PORT` | Port SMTP |
| `SMTP_USER` | Utilisateur SMTP |
| `SMTP_PASS` | Mot de passe SMTP |
| `SMTP_FROM` | Adresse email d'expédition |
| `SMTP_FROM_NAME` | Nom de l'expéditeur (affiché dans les emails) |
| `APP_URL` | URL de base de l'application |

## 📁 Structure du projet

```
formbuilder-standalone/
├── prisma/
│   ├── schema.prisma    # Schéma de base de données
│   └── seed.ts          # Données initiales (thèmes)
├── src/
│   ├── app/
│   │   ├── api/         # Routes API
│   │   ├── builder/     # Éditeur de formulaires
│   │   ├── dashboard/   # Tableau de bord
│   │   ├── [slug]/      # Formulaires publics (accès direct via /mon-formulaire)
│   │   ├── forms/       # Gestion des réponses
│   │   ├── login/       # Authentification
│   │   └── ...
│   ├── components/
│   │   ├── builder/     # Composants de l'éditeur
│   │   └── ui/          # Composants UI réutilisables
│   ├── hooks/           # Hooks React personnalisés
│   ├── lib/             # Utilitaires (Prisma, auth, etc.)
│   ├── stores/          # État global (Zustand)
│   └── types/           # Types TypeScript
└── ...
```

## 🔒 Sécurité

- Mots de passe hashés avec bcrypt
- Tokens JWT avec expiration
- Protection CSRF sur les formulaires
- Validation côté serveur

## 📄 Licence

MIT

## 🙏 Crédits

Inspiré par [QuillForms](https://quillforms.com)

# 🚀 Accès public des formulaires

Depuis janvier 2026, les liens publics des formulaires sont accessibles directement à la racine du site :

- Exemple : `https://www.monsite.fr/test2` (au lieu de `https://www.monsite.fr/f/test2`)
- Les anciennes URLs `/f/[slug]` sont automatiquement redirigées vers la nouvelle structure.
- Le lien de partage et l'URL affichée dans l'administration ont été mis à jour.

## 👤 Compte administrateur par défaut

Après le premier déploiement, un compte administrateur est créé automatiquement :

| Champ | Valeur |
|-------|--------|
| **Email** | `admin@formbuilder.local` |
| **Mot de passe** | `admin123` |

⚠️ **Important** : Changez ce mot de passe immédiatement après la première connexion !

### Créer un nouveau compte

Vous pouvez également créer un nouveau compte via la page d'inscription : `/register`

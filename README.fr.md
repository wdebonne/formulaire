<div align="center">

# FormBuilder Standalone

**Un créateur de formulaires auto-hébergé — éditeur visuel, logique conditionnelle, documents, rapports, outils RGPD.**

Construisez vos formulaires par glisser-déposer, publiez-les à votre propre adresse, collectez les
réponses et transformez-les en documents Word, rapports PDF ou requêtes webhook — le tout sur votre
serveur, sans aucun service tiers dans la boucle.

[![Next.js 14](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-AMD64%20%2B%20ARM64-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Node 24](https://img.shields.io/badge/Node-24%20LTS-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Licence : AGPL v3](https://img.shields.io/badge/Licence-AGPL%20v3-blue.svg)](LICENSE)

**Français** · [English](README.md)

</div>

---

## Sommaire

- [En un coup d'œil](#en-un-coup-dœil)
- [Fonctionnalités](#fonctionnalités)
  - [Construction de formulaires](#-construction-de-formulaires)
  - [Partage & contrôle d'accès](#-partage--contrôle-daccès)
  - [Réponses](#-réponses)
  - [Sorties & intégrations](#-sorties--intégrations)
  - [Administration](#-administration)
  - [Accessibilité](#-accessibilité)
- [Types de blocs](#types-de-blocs)
- [Stack technique](#stack-technique)
- [Démarrage rapide](#démarrage-rapide-développement-local)
- [Déploiement Docker](#déploiement-docker)
- [Variables d'environnement](#variables-denvironnement)
- [Structure du projet](#structure-du-projet)
- [Scripts disponibles](#scripts-disponibles)
- [Tests & intégration continue](#tests--intégration-continue)
- [Sécurité](#sécurité)
- [Contribution, journal & licence](#contribution)

---

## En un coup d'œil

| | |
|---|---|
| 🧱 **24 types de blocs** | Du texte court à la signature, en passant par les blocs répétables, les quantités et la sélection d'images |
| 🔀 **Logique visuelle** | Afficher / masquer / sauter / rendre obligatoire, dans un éditeur de flux plein écran avec flèches SVG |
| 🎨 **Thèmes & branding** | Couleurs, Google Fonts, dégradés, images de fond, placement du logo |
| 🔐 **Contrôle d'accès** | Fenêtre de disponibilité, mot de passe, quota, une réponse par appareil, connexion requise |
| 📄 **Documents Word** | Modèles `.docx` remplis avec les réponses et envoyés au bon service |
| ✉️ **E-mails sur réponse** | Accusé de réception au répondant, notification à l'équipe, circuits conditionnels — avec ou sans pièce jointe |
| 📊 **Rapports PDF** | Synthèses statistiques planifiées et envoyées par e-mail, avec graphiques et répartitions |
| 📈 **Statistiques à l'écran** | Les mêmes chiffres consultables directement, sans générer de PDF, sur la période de votre choix |
| 🔁 **Webhooks fiables** | Reprise automatique des envois en échec, six tentatives échelonnées sur 24 h |
| 🛡️ **Conformité** | Conservation et effacement RGPD, journal d'activité, anti-bruteforce, listes blanche/noire d'IP |
| ♿ **Accessibilité** | Formulaire public utilisable au clavier et au lecteur d'écran — rôles ARIA, focus suivi, erreurs annoncées |
| 🐳 **Auto-hébergé** | Une seule image Docker, SQLite, multi-architecture (AMD64 + ARM64) |

---

## Fonctionnalités

### 🏗 Construction de formulaires

- **Éditeur par glisser-déposer** — réorganisation visuelle des blocs, panneaux redimensionnables, groupes et blocs répétables repliables, recherche dans la liste des blocs.
- **24 types de blocs** — voir la [liste complète](#types-de-blocs) ci-dessous.
- **Logique conditionnelle visuelle** — afficher / masquer / sauter vers / rendre obligatoire selon les réponses précédentes. Un éditeur texte avec recherche de blocs, plus un éditeur de flux visuel plein écran (style Tripetto) avec flèches SVG orthogonales, routage en lanes, badges de règles et éditeur intégré.
- **Aperçu fidèle et temps réel** — le panneau central réagit instantanément à chaque modification (libellé, choix, type, thème) via Zustand. Le bouton **Aperçu** sauvegarde puis affiche le formulaire dans un iframe plein écran avec *exactement le même renderer que la page publiée* — aucune différence visuelle n'est possible.
- **Historique des versions** — snapshot automatique toutes les 10 sauvegardes, plus des versions manuelles avec libellé optionnel. Restauration ou suppression depuis le builder ou le tableau de bord, recherche dans les versions, et l'état courant est toujours sauvegardé avant une restauration : rien n'est jamais perdu silencieusement.
- **Thèmes** — couleurs, Google Fonts, fonds (uni, dégradé sur 8 directions, image avec opacité), styles de boutons et de champs, couleur de fond des choix. L'aperçu du builder reflète le thème en temps réel.
- **Paramètres** — barre de progression (position, taille), numérotation des questions, animations, branding, slug personnalisé, affichage du logo du site (position + alignement), reprise de saisie.

<details>
<summary><b>En savoir plus sur l'éditeur de logique visuelle</b></summary>

- Cartes de blocs disposées en flux vertical, reliées par des flèches SVG orthogonales arrondies portant un badge coloré qui résume la règle.
- Alternance gauche/droite des lanes, avec des pools indépendants et sans chevauchement par côté, et un décalage de ±16 px pour que deux règles partant du même bloc ne partagent jamais le même point de départ.
- Un clic sur une flèche *ou* sur un nom de bloc ouvre l'éditeur de règle ; une barre latérale liste toutes les règles du bloc sélectionné pour passer de l'une à l'autre sans grands déplacements de souris.
- Listes de blocs avec recherche, valeurs par défaut sensées (le bloc *Si* est le bloc source, le bloc *Alors* est le suivant), et ouverture automatique de l'éditeur après création d'une règle.

</details>

### 🔗 Partage & contrôle d'accès

- Formulaires publics servis à **`/{slug}`**, directement à la racine du site (les anciennes URL `/f/{slug}` redirigent).
- **Modal de partage** — lien direct, shortcode personnalisable, code d'intégration `<iframe>` et véritable studio de QR code.
- **3 niveaux de permissions** — Lecture, Édition, Administrateur — avec autocomplétion des utilisateurs lors du partage.
- **Options d'accès** (menu de la carte du formulaire → *Options*) — dates de mise en ligne et de clôture, protection par mot de passe, nombre maximum de réponses, une seule réponse par appareil, restriction aux utilisateurs connectés et retrait des moteurs de recherche. Chaque règle est appliquée **côté serveur au rendu de la page comme à l'envoi d'une réponse**, avec un message personnalisable par situation. Le tableau de bord affiche un badge *Programmé* / *Clôturé* quand un formulaire publié n'accepte pas réellement de réponses.
- **Anti-spam** (même modale, section *Anti-spam*) — trois mesures cumulées, sans captcha ni service externe : un **champ leurre** invisible pour les répondants (rempli, la réponse est ignorée silencieusement), un **délai minimum de remplissage** attesté par un horodatage signé par le serveur (donc impossible à antidater, et un script qui appelle directement l'adresse d'envoi sans charger la page est refusé) et une **limitation de débit par adresse IP et par formulaire**. Actif par défaut sur tous les formulaires ; chaque mesure se règle ou se désactive.
- **Reprise d'un formulaire interrompu** — la saisie en cours est conservée dans le navigateur du répondant au fil de la frappe. S'il revient après avoir fermé l'onglet, perdu le réseau ou vu sa batterie lâcher, une proposition de **reprise** lui rend ses réponses et la question où il s'était arrêté — plutôt que de lui faire tout retaper. Sur un formulaire long, avec blocs répétables et déclarations sur plusieurs itérations, c'est la différence entre une réponse et un abandon. La mention *Brouillon enregistré* le lui dit pendant qu'il répond, sans quoi fermer l'onglet reste un risque à ses yeux. Désactivable par formulaire dans les *Paramètres*.
  - **Rien ne quitte l'appareil** — le brouillon vit dans le navigateur du répondant, pas sur le serveur : aucune réponse à moitié remplie n'est créée en base, donc rien de plus à conserver ni à purger au titre du RGPD. Il est effacé dès l'envoi de la réponse, comme lorsque le répondant choisit de recommencer, et expire de lui-même au bout de 7 jours.
  - **La signature n'est pas conservée** — c'est un acte, pas une saisie, et la refaire après une interruption est le comportement honnête ; la proposition de reprise le dit quand le formulaire en comporte une. Un **fichier déjà déposé, lui, est retrouvé** : la réponse n'en porte que la référence et le fichier est déjà sur le serveur, la reprise évite donc de le redéposer.

<details>
<summary><b>Studio de QR code</b></summary>

Chaque module du QR code est dessiné à la main sur un canvas plutôt que délégué à un générateur générique, ce qui permet :

- **Couleurs** — remplissage uni ou dégradé (linéaire avec angle libre, ou radial), plus un fond personnalisé.
- **Formes** — quatre styles de modules (carré, arrondi, points, classy) et trois styles d'yeux.
- **Logo central** — importé depuis la machine ou repris du logo du site, carré ou rond, jusqu'à 35 % du code.
- **Export** — PNG en 512, 1024 ou 2048 px ; l'aperçu à l'écran est rendu en pleine résolution et simplement affiché en plus petit, donc ce que vous voyez est exactement ce que vous téléchargez.

La lisibilité a été vérifiée en décodant les PNG générés avec zbar **et** OpenCV : les styles de modules n'affectent jamais le décodage, la présence d'un logo force automatiquement le niveau de correction **H**, et le sélecteur de style d'yeux avertit que les motifs de détection non carrés sont refusés par certains lecteurs.

</details>

<details>
<summary><b>Comment fonctionne la protection par mot de passe</b></summary>

Le mot de passe est stocké sous forme de **condensat bcrypt et ne quitte jamais le serveur** — la modale d'options apprend uniquement s'il en existe un. Le cookie de déverrouillage est un HMAC dérivé de ce condensat : **changer le mot de passe révoque immédiatement tous les accès déjà accordés**, sans aucune liste de sessions à maintenir. Les essais sont limités par IP et par formulaire, délibérément séparés de l'anti-bruteforce des comptes pour qu'une faute de frappe d'un répondant ne puisse jamais le bloquer sur tout le site. Un formulaire protégé n'envoie même pas ses questions dans le HTML de l'écran de déverrouillage.

*Limite connue :* le cookie est en `SameSite=Lax`, un formulaire protégé par mot de passe ne peut donc pas être déverrouillé depuis un iframe **cross-site**. Protection par mot de passe et intégration cross-site sont mutuellement exclusives ; le lien direct fonctionne normalement.

</details>

### 📊 Réponses

- Tableau des réponses avec **sélecteur de colonnes** (choix des questions affichées), pagination et modal de détail.
- **Correction d'une réponse enregistrée** — le bouton *Modifier* du modal de détail rouvre les réponses dans de vrais champs éditables (cases à cocher, dates, listes, champs de groupes et de blocs répétables) et enregistre la correction exactement comme si le répondant l'avait saisie. La modification est journalisée avec la **liste des champs modifiés, jamais leurs valeurs**.
- **Statistiques à l'écran** (`/forms/{id}/stats`) — répartition des choix, notes, taux de remplissage par question, évolution dans le temps et verbatims récents, sur la période de votre choix. Ce sont **exactement les chiffres du rapport PDF**, calculés par la même fonction : consulter le taux de réponse d'une question ne demande plus de générer un document.
- **Export Excel et CSV, avec filtrage par période** — la modale *Exporter* propose un classeur `.xlsx` (colonnes dimensionnées sur leur contenu) ou un CSV (UTF-8 avec BOM, s'ouvre directement dans Excel), et restreint l'export à une période — tout, N derniers jours, mois en cours ou précédent, plage de dates — au lieu de tout exporter ou rien. Les deux formats contiennent le même tableau : une ligne par réponse, une colonne par question, champs internes des groupes et itérations des blocs répétables dépliés en colonnes distinctes. La modale annonce le nombre de lignes et de colonnes avant le téléchargement.
- **Pièces jointes et signatures** — un fichier déposé par le répondant se télécharge depuis le détail de la réponse, une signature s'y affiche ; l'un et l'autre figurent dans les exports et dans les documents générés. Supprimer une réponse supprime ses fichiers.
- **Indicateur de statut webhook** par réponse (vert / orange / rouge / gris) avec relance en un clic.
- **Statut du document par circuit d'envoi** — accepté par le serveur / en échec / non concerné / jamais envoyé — avec date et destinataires, relance en un clic et téléchargement direct du document rempli.

### 📤 Sorties & intégrations

- **Webhooks** — POST/GET/PUT/PATCH vers des URL externes, mapping personnalisé des champs avec réorganisation par glisser-déposer et recherche, valeurs calculées par gabarit (`{field:blockId}`, `{date:dd-MM-YYYY}`, `{entry_id}`…), et libellés lisibles plutôt que des slugs bruts. **Signature HMAC-SHA256 optionnelle** (en-tête `X-Webhook-Signature`, convention GitHub/Stripe) : renseignez un secret partagé et le destinataire peut vérifier que l'appel vient bien de ce formulaire, et non de quiconque a vu l'URL passer.
- **Catalogue de matériel externe** — un bloc de choix multiple ou de liste déroulante peut tirer ses options d'une application de gestion plutôt que d'une liste saisie à la main, en n'affichant que ce qui reste disponible à la date répondue plus haut dans le formulaire, filtré par service, nature et catégorie. Une liste saisie vieillit : un matériel vendu, dix tables achetées, et le formulaire propose encore l'ancien parc.
- **Génération de documents Word** — associez un modèle `.docx` dont les jetons sont remplacés par les réponses, puis envoyez le document rempli en pièce jointe. Tableau visuel des champs disponibles (jeton copiable, réponses possibles, présence effective du jeton dans le modèle), jetons de boucle pour les blocs répétables, jetons de case à cocher `{case_…}` rendant ☒/☐ pour qu'un modèle imprimé vierge reste remplissable à la main, et avertissement sur les jetons inconnus. **Les jetons restent stables après renommage d'une question ou d'une option.**
- **Envoi conditionnel par circuits** — un circuit par service, avec ses propres conditions, destinataires, objet et corps, pour que seules les personnes concernées reçoivent le mail. Les conditions réutilisent les opérateurs de la logique du formulaire et sont repliées par défaut.
- **Accusé de réception et notification d'équipe** — la pièce jointe est facultative : un circuit sans document envoie un e-mail simple, **sans qu'aucun modèle Word soit nécessaire**. Le destinataire peut être l'adresse saisie par le répondant lui-même (n'importe quel bloc *E-mail* du formulaire), ce qui donne l'accusé de réception ; une adresse fixe donne la notification à l'équipe à chaque nouvelle réponse. Objet et corps acceptent les mêmes jetons `{…}` que les modèles, résolus même en l'absence de modèle.
- **Rapports PDF périodiques** — la modale *Rapports* transforme les réponses en PDF formaté et l'envoie selon une planification.
- **Sortie PDF optionnelle** — par le serveur bureautique de votre **NextCloud** (Euro-Office, ONLYOFFICE, Nextcloud Office : rien de plus à installer) ou par un conteneur [Gotenberg](https://gotenberg.dev/) dédié, au choix dans le panneau d'administration. Si la conversion échoue au moment d'un envoi, le `.docx` rempli part à la place du PDF plutôt que de ne rien envoyer.
- **Import / export JSON** des formulaires, et duplication.

<details>
<summary><b>En savoir plus sur les rapports PDF périodiques</b></summary>

- **Période** — fenêtre glissante (N derniers jours), mois en cours, mois précédent, depuis le dernier rapport (aucune réponse comptée deux fois), plage de dates fixe, ou depuis la création. Une **date de clôture** optionnelle fige définitivement le corpus, avec la possibilité d'envoyer un dernier rapport ce soir-là. Cette date n'empêche *pas* le formulaire de recevoir de nouvelles réponses.
- **Contenu** — sept sections activables indépendamment : indicateurs clés (total, moyenne journalière, évolution par rapport à la période précédente équivalente, jour le plus actif, taux de remplissage), histogramme des réponses, répartition des choix en pourcentages avec barres, statistiques numériques présentées comme des **notes sur leur échelle déclarée** avec distribution par valeur, réponses libres, taux de remplissage par question, et tableau des dernières réponses.
- **Mise en page** — trois densités (*Compact*, *Normal*, *Aéré*) agissant sur la hauteur des lignes, les cartes, l'histogramme et les blancs entre blocs, plus une option pour commencer chaque section sur une nouvelle page. Seuls les blancs changent, jamais la taille du texte ; *Normal* reproduit exactement la mise en page d'origine.
- **Réponses libres** — soit les N derniers verbatims distincts, soit **toutes les réponses reçues** (doublons compris, 1 000 maximum par question). Dans les deux cas, un verbatim long est replié sur plusieurs lignes plutôt que tronqué.
- **Envoi** — planification quotidienne, hebdomadaire ou mensuelle au quart d'heure près, destinataires multiples, objet et corps HTML acceptant des jetons (`{form_title}`, `{period}`, `{response_count}`…).
- Une **barre de chiffres en direct** en haut de la modale est calculée par *la même fonction que le PDF* : ce qu'elle annonce est littéralement ce que contiendra le PDF. « Télécharger le PDF » et « Envoyer maintenant » permettent de vérifier avant de planifier quoi que ce soit.
- Le déclenchement repose sur une **minuterie interne** — aucun cron externe à configurer. Un conteneur arrêté une semaine envoie **un** rapport au redémarrage, pas sept. Les déploiements qui préfèrent piloter eux-mêmes peuvent appeler `POST /api/internal/reports/run`.

</details>

### 🛠 Administration

| Panneau | Rôle |
|---------|------|
| **Utilisateurs** | Créer, modifier et supprimer des comptes ; supprimer un compte déplace ses formulaires en corbeille au lieu de les détruire |
| **RGPD** (`/admin/gdpr`) | Durée de conservation configurable (36 mois par défaut) avec purge manuelle **ou automatique quotidienne** ; recherche des réponses d'une personne tous formulaires confondus, avec **revue avant action** (export Excel de portabilité ou PDF nominatif) et suppression au titre du droit à l'effacement ; mention RGPD optionnelle sur les écrans d'accueil et de fin |
| **Sécurité** (`/admin/security`) | Protection anti-bruteforce (tentatives max, fenêtre de temps, durée de blocage), listes blanche/noire d'IP, vue en direct des adresses bloquées, alerte e-mail en cas d'échecs répétés |
| **Journal d'activité** (`/admin/logs`) | Historique consultable, filtrable et paginé des connexions, du cycle de vie des formulaires et de la gestion des utilisateurs ; export Excel correspondant exactement aux filtres actifs ; conservation configurable avec purge manuelle **ou automatique quotidienne** |
| **Corbeille** (`/admin/trash`) | Formulaires supprimés avec restauration et suppression définitive ; les formulaires orphelins (propriétaire supprimé) portent un badge ambre et exigent une réassignation de propriétaire avant restauration |
| **Personnalisation** | Nom du site, logo et favicon appliqués globalement ; fond de la page de connexion (uni, dégradé ou image floutée) et visibilité des liens, avec aperçu strictement identique au rendu réel |
| **Documents** (`/admin/documents`) | Choisir le moteur de conversion PDF — le serveur bureautique du NextCloud configuré, ou un conteneur Gotenberg — avec un **test de connexion** et un **test de conversion** qui convertit un document témoin, nomme le chemin qui a répondu et rend le PDF produit ; la sortie PDF ne devient sélectionnable qu'après un test réussi |
| **Catalogue** (`/admin/catalog`) | Raccorder l'application de gestion du matériel (adresse et jeton), tester la connexion et visualiser ce qu'elle répond, filtré par service, nature, catégorie et période. Le jeton reste sur le serveur : l'écran sait seulement qu'il existe |
| **Polices** | Ajouter et retirer des Google Fonts, disponibles dans l'éditeur de thèmes |
| **SMTP** | Configuration du serveur de mail avec envoi de test |
| **Base de données** | Sauvegarde et restauration |
| **Modèles & Nextcloud** | Bibliothèque de modèles et intégration Nextcloud |

### ♿ Accessibilité

Le formulaire public — la partie que remplissent les répondants — est conçu pour être utilisable **au clavier seul et avec un lecteur d'écran**, en visant le RGAA 4.1 (WCAG 2.1 AA).

- **Contrôles de choix correctement exposés** — choix unique, sélection d'images et Oui/Non forment un `radiogroup` de boutons radio, choix multiple un groupe de cases à cocher ; chaque option annonce son état, et le groupe reprend l'intitulé de la question ainsi que son caractère obligatoire.
- **Parcours clavier complet** — un groupe de choix compte une seule tabulation et se parcourt aux flèches ; Entrée et Espace cochent. Les jours du calendrier du bloc *Date avancée* sont des boutons à part entière, avec la date complète pour nom.
- **Focus déplacé à chaque changement de question**, sans jamais le prendre à un champ de saisie déjà actif ; l'écran de remerciement est annoncé de la même façon.
- **Erreurs de validation annoncées** (`role="alert"`) et rattachées au champ concerné.
- **Intitulés rattachés aux champs** — `<label for>` pour les contrôles natifs, `aria-labelledby` pour les ensembles de boutons, dans les questions simples comme dans les groupes et les blocs répétables.
- **Zoom non entravé** et fenêtres modales gérées comme des `dialog` (focus pris, fermeture par Échap).

**Limite connue** : le bloc *Signature* exige un dispositif de pointage (souris, doigt ou stylet). C'est la nature du procédé, pas un défaut de balisage — à éviter sur un formulaire devant être rempli au seul clavier. Le cadre annonce l'état de la signature et la façon de la donner.

> Si vous déployez cette application pour une collectivité ou un organisme public français, la publication d'une **déclaration d'accessibilité** reste de votre ressort : elle dépend d'un audit de votre instance, thème et contenus compris.

---

## Types de blocs

| Bloc | Description |
|------|-------------|
| Écran d'accueil | Page d'introduction du formulaire (mention RGPD optionnelle) |
| Texte court | Champ mono-ligne (transformation optionnelle : MAJUSCULES, Initiales) |
| Texte long | Zone de texte multi-lignes |
| Email | Champ email avec validation stricte configurable |
| Téléphone | Champ téléphone (format standard ou international, nombre de chiffres configurable) |
| Adresse | Autocomplétion via l'API Adresse officielle (BAN) — adresse complète, ou **commune seule** avec département et région affichés dans les suggestions |
| Nombre | Champ numérique |
| Choix multiple | Sélection unique ou multiple (avec option « Autre » pour réponse libre) ; options tirées du catalogue de matériel en option |
| Sélection image | Choix illustrés par des images cliquables (grille ou empilés) |
| Menu déroulant | Liste avec autocomplétion, saisie libre optionnelle, filtrage dynamique selon un autre bloc ; options tirées du catalogue de matériel en option |
| Quantité | Liste d'articles avec saisie de quantités individuelles |
| Date | Sélecteur de date natif |
| Date avancée | Calendrier visuel avec plage de dates et contraintes min/max configurables |
| Heure | Sélecteur d'heure ou plage horaire |
| Téléchargement | Dépôt d'un fichier par le répondant — formats et taille limités par bloc, stockage hors du dossier public, téléchargement réservé aux personnes ayant accès au formulaire |
| Signature | Zone de signature à la souris ou au doigt, enregistrée en image PNG dans la réponse (hauteur et couleur du tracé réglables) |
| Curseur | Valeur numérique avec slider |
| Site web | URL avec validation |
| Mention légale | Case à cocher de consentement obligatoire |
| Énoncé | Texte informatif (sans saisie) |
| Oui / Non | Question avec deux boutons Oui/Non |
| Groupe | Plusieurs questions sur la même page |
| Bloc répétable | Répétition dynamique d'un ensemble de questions |
| Écran de remerciement | Page de fin personnalisée (bouton « Recommencer » optionnel, mention RGPD optionnelle) |

---

## Stack technique

| Couche | Technologie |
|--------|------------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| Langage | TypeScript |
| Base de données | SQLite via [Prisma ORM](https://www.prisma.io/) |
| Auth | JWT (cookies HTTP-only) + bcrypt |
| UI | [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) |
| Glisser-déposer | [@dnd-kit](https://dndkit.com/) |
| État global | [Zustand](https://zustand-demo.pmnd.rs/) |
| Email | [Nodemailer](https://nodemailer.com/) |
| Modèles Word | [docxtemplater](https://docxtemplater.com/) + [PizZip](https://github.com/open-xml-templating/pizzip) (MIT) |
| Génération PDF | [PDFKit](https://pdfkit.org/) |
| Conversion PDF | Serveur bureautique NextCloud (Euro-Office / ONLYOFFICE / Nextcloud Office) ou conteneur [Gotenberg](https://gotenberg.dev/) — optionnel |
| Tableurs | [SheetJS](https://sheetjs.com/) (`xlsx`) |
| Animations | [Framer Motion](https://www.framer.com/motion/) |
| Déploiement | Docker (multi-stage, multi-arch AMD64 + ARM64) |

> **Pourquoi docxtemplater et pas Carbone ?** Carbone est passé sous *Carbone Community License* en v3.5.5,
> dont les restrictions d'usage sont incompatibles avec la licence AGPLv3 de ce projet. `docxtemplater` (MIT) est utilisé à la place.

---

## Démarrage rapide (développement local)

### Prérequis

- **Node.js 24** — la version utilisée par l'image Docker (`.nvmrc`). Tout ce qui est ≥ 18.17 compile, mais ne reflète plus la production.
- npm ou yarn

### Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env
#    Éditez .env — JWT_SECRET est obligatoire (openssl rand -base64 32)

# 3. Initialiser la base de données
npm run db:push
npm run db:seed

# 4. Lancer le serveur de développement
npm run dev
```

Ouvrez **[http://localhost:3000](http://localhost:3000)**.

### Identifiants par défaut

| Champ | Valeur |
|-------|--------|
| Email | `admin@formbuilder.local` |
| Mot de passe | `admin123` |

> [!WARNING]
> **Changez ce mot de passe immédiatement après la première connexion.** Vous pouvez aussi créer un compte via `/register`.

---

## Déploiement Docker

```bash
docker compose up -d
```

L'application est accessible sur le port **`3110`** par défaut (`http://localhost:3110`).

| Fichier | Cible |
|---------|-------|
| `docker-compose.yml` | Universel — détecte automatiquement l'architecture |
| `docker-compose.amd64.yml` | Forcer AMD64 (Intel / AMD) |
| `docker-compose.arm64.yml` | Forcer ARM64 (Raspberry Pi, Apple Silicon) |

Trois volumes nommés conservent vos données hors de l'image : `sqlite-data` (base de données),
`uploads-data` (images et fichiers importés) et `templates-data` (modèles `.docx` privés).

Les migrations sont rejouées automatiquement au démarrage, avec une **réparation automatique bornée**
d'une migration restée bloquante dans `_prisma_migrations` (désactivable avec `MIGRATION_AUTO_REPAIR=0`).

Pour le déploiement sur Portainer et en production, consultez **[DEPLOY-PORTAINER.md](DEPLOY-PORTAINER.md)**.

---

## Variables d'environnement

### Essentielles

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | Chemin vers le fichier SQLite | `file:./dev.db` |
| `JWT_SECRET` | Secret des tokens JWT et de l'authentification des routes internes — **32 caractères minimum** | *(requis en prod)* |
| `APP_URL` | URL publique du déploiement ; une valeur en `https://` rend le cookie d'authentification `Secure` | `http://localhost:3110` |
| `NEXT_PUBLIC_APP_URL` | URL publique utilisée pour construire les liens dans les e-mails | `http://localhost:3000` |

### E-mail (SMTP)

| Variable | Description | Défaut |
|----------|-------------|--------|
| `SMTP_HOST` | Serveur SMTP | — |
| `SMTP_PORT` | Port SMTP | `587` |
| `SMTP_USER` | Utilisateur SMTP | — |
| `SMTP_PASS` | Mot de passe SMTP | — |
| `SMTP_FROM` | Adresse e-mail d'expéditeur | `noreply@formbuilder.local` |
| `SMTP_FROM_NAME` | Nom affiché de l'expéditeur | `FormBuilder` |

### Optionnelles

| Variable | Description | Défaut |
|----------|-------------|--------|
| `TRUSTED_PROXY_IPS` | IP des reverse proxies de confiance, séparées par des virgules. Quand elle est définie, `X-Forwarded-For` n'est pris en compte que pour les connexions venant de ces adresses — à laisser vide si l'application est exposée directement | *(vide)* |
| `DOCUMENT_STORAGE_DIR` | Dossier privé contenant les modèles `.docx` importés | `<projet>/storage/templates` |
| `RESPONSE_UPLOAD_DIR` | Dossier privé contenant les pièces jointes déposées par les répondants | `<projet>/storage/response-files` |
| `SCHEDULER` | Minuterie interne (rapports périodiques **et** purges de conservation) ; `0` la désactive — pilotez alors `/api/internal/reports/run` et `/api/internal/retention/run` depuis votre propre cron. `REPORT_SCHEDULER`, le nom historique, reste accepté | `1` |
| `SCHEDULER_INTERVAL_MINUTES` | Fréquence de vérification des échéances, 1 à 60. `REPORT_SCHEDULER_INTERVAL_MINUTES` reste accepté | `5` |
| `MIGRATION_AUTO_REPAIR` | Réparation automatique, en une seule tentative, d'une migration bloquée au démarrage du conteneur ; `0` pour s'en passer | `1` |
| `CATALOG_API_URL` | Adresse de l'application de gestion du matériel. **Secours uniquement** : le raccordement se règle dans Administration → Catalogue, qui prend le dessus | *(vide)* |
| `CATALOG_API_TOKEN` | Jeton d'API en lecture seule du catalogue, même remarque | *(vide)* |

---

## Structure du projet

```
formbuilder-standalone/
├── prisma/
│   ├── schema.prisma        # Schéma de la base de données
│   ├── migrations/          # Rejouées par migrate deploy dans Docker
│   └── seed.ts              # Données initiales (thèmes, compte admin)
├── scripts/                 # Utilitaires de démarrage (init BDD, réparation migrations)
├── src/
│   ├── app/
│   │   ├── [slug]/          # Formulaire public (/{slug}) + écran de contrôle d'accès
│   │   ├── admin/           # Panneaux d'administration (utilisateurs, sécurité, journal, RGPD, corbeille…)
│   │   ├── builder/[id]/    # Éditeur de formulaires
│   │   ├── dashboard/       # Liste des formulaires
│   │   ├── forms/[id]/
│   │   │   ├── preview/     # Prévisualisation auth-protégée (brouillon ou publié)
│   │   │   └── responses/   # Visualisation des réponses
│   │   └── api/             # Points d'accès REST
│   ├── components/
│   │   ├── builder/         # Interface du builder (blocs, logique, thème, webhooks, QR…)
│   │   ├── forms/           # Modales Options, Rapports, Modèle de document et E-mail
│   │   └── ui/              # Composants UI génériques (Button, Dialog, Input…)
│   ├── lib/                 # Auth, Prisma, e-mail, docx, PDF, sécurité, RGPD, journal d'activité, accessibilité
│   ├── hooks/               # Hooks React personnalisés
│   ├── stores/              # État global Zustand
│   └── types/               # Définitions TypeScript
├── storage/
│   └── templates/           # Modèles .docx privés — jamais servis en statique
├── docker-compose.yml       # Docker Compose universel (détection auto de l'architecture)
├── docker-compose.amd64.yml # Spécifique AMD64
├── docker-compose.arm64.yml # Spécifique ARM64 (Raspberry Pi, Apple Silicon)
└── Dockerfile               # Build multi-stage
```

---

## Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarrer le serveur de développement |
| `npm run build` | Compiler pour la production |
| `npm start` | Démarrer le serveur de production |
| `npm test` | Lancer la suite de tests (Vitest) |
| `npm run test:watch` | Relancer les tests à chaque modification |
| `npm run typecheck` | Vérifier les types sans compiler |
| `npm run lint` | Lancer ESLint |
| `npm run db:push` | Appliquer le schéma Prisma à la base |
| `npm run db:studio` | Ouvrir Prisma Studio |
| `npm run db:generate` | Regénérer le client Prisma |
| `npm run db:seed` | Initialiser la base avec les données par défaut |

> [!NOTE]
> Le développement local utilise `db:push`, tandis que Docker rejoue `prisma/migrations/` avec `migrate deploy`.
> **Tout changement de schéma nécessite un fichier de migration**, sans quoi il n'atteindra jamais la production.

---

## Tests & intégration continue

La séparation « module pur / module serveur » suivie dans tout le projet rend la logique métier
directement testable : `report-stats.ts`, `catalog.ts`, `form-options.ts`, `condition-eval.ts`,
`response-format.ts` et `document-fields.ts` n'importent ni Prisma, ni `next/headers`, ni nodemailer.

```bash
npm test          # la suite complète, en moins d'une seconde
npm run typecheck # tsc --noEmit, tests compris
```

Ce que la suite garantit : les libellés de choix résolus à l'affichage sans jamais réécrire ce qui
est stocké, une option jamais comptée deux fois selon sa forme de stockage, les pièces jointes et
signatures recopiées intactes, les protections anti-spam actives par défaut, la date de clôture qui
plafonne toute période de rapport, et les jetons d'un modèle Word qui survivent au renommage d'une
question.

L'intégration continue (`.github/workflows/ci.yml`) vérifie les types, lance les tests et compile
l'application à chaque poussée. Un second job **rejoue les migrations sur une base peuplée** : une
migration qui reconstruit une table passe sur une base vide et échoue sur une base contenant des
données — c'est ainsi qu'une migration est partie cassée et a bloqué les instances existantes.

> [!NOTE]
> Les routes API, les composants React et les modules serveur ne sont pas couverts par des tests
> automatisés : le `next build` de la CI les garde compilables, rien de plus.

---

## Sécurité

- Mots de passe hashés avec **bcrypt** ; tokens JWT avec expiration dans des **cookies HTTP-only**.
- Validation côté serveur et vérification des autorisations sur toutes les routes API protégées.
- **Anti-bruteforce** sur la connexion avec seuils configurables, et listes blanche/noire d'IP appliquées au plus tôt dans le middleware (en mode « fail open » sur incident transitoire, pour qu'un problème réseau ne verrouille jamais tout le monde dehors).
- **Journal d'activité** des connexions, du cycle de vie des formulaires et de la gestion des utilisateurs, avec alertes e-mail en cas d'échecs de connexion répétés — exactement une alerte par cycle d'échecs, et non une par tentative.
- **Prise en compte des reverse proxies** — `X-Forwarded-For` n'est accepté que depuis les adresses listées dans `TRUSTED_PROXY_IPS`, afin qu'un client ne puisse pas usurper son IP pour échapper à une liste noire.
- **Modèles Word stockés hors de `public/`** et accessibles uniquement via des routes authentifiées ; les documents remplis sont régénérés à la demande plutôt qu'écrits sur disque, aucun fichier contenant des données personnelles ne s'accumule.
- **Mots de passe d'accès aux formulaires** stockés sous forme de condensats bcrypt et jamais renvoyés au navigateur ; le cookie de déverrouillage dérive du condensat, si bien que changer le mot de passe révoque tous les accès déjà accordés.
- **RGPD par conception** — les exports et suppressions au titre des droits des personnes n'agissent que sur les entrées explicitement revues par l'administrateur. Les purges de conservation, manuelles ou automatiques, recalculent toujours leur date de coupure côté serveur et laissent une entrée au journal ; la suppression automatique reste un interrupteur à activer, jamais un comportement imposé par une mise à jour. Aucune valeur personnelle ne fuit dans le journal d'activité.

Consultez [SECURITY_AUDIT.md](SECURITY_AUDIT.md) pour l'audit détaillé.

---

## Contribution

Consultez [CONTRIBUTING.fr.md](CONTRIBUTING.fr.md) pour les règles de contribution.

## Journal des modifications

Consultez [CHANGELOG.fr.md](CHANGELOG.fr.md) pour l'historique des versions.

## Licence

[GNU Affero General Public License v3.0](LICENSE)

---

<div align="center">

*Inspiré par [QuillForms](https://quillforms.com)*

</div>

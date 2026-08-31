// Block type definitions
export type BlockType =
  | 'short-text'
  | 'long-text'
  | 'number'
  | 'email'
  | 'phone'
  | 'address'
  | 'date'
  | 'advanced-date'
  | 'time'
  | 'dropdown'
  | 'multiple-choice'
  | 'image-selection'
  | 'slider'
  | 'legal'
  | 'statement'
  | 'file'
  | 'signature'
  | 'website'
  | 'welcome-screen'
  | 'thankyou-screen'
  | 'group'
  | 'repeater'
  | 'quantity'
  | 'yes-no'

export interface BlockChoice {
  id: string
  label: string
  value: string
  imageUrl?: string // URL de l'image pour image-selection
}

export interface BlockAttributes {
  label?: string
  hideLabel?: boolean // Masquer le titre de la question
  description?: string
  placeholder?: string
  required?: boolean
  defaultValue?: string | number
  min?: number
  max?: number
  step?: number
  choices?: BlockChoice[]
  allowMultiple?: boolean
  multiple?: boolean // For multiple choice
  format?: string
  buttonText?: string
  showDescription?: boolean
  checkboxLabel?: string // For legal block
  attachment?: {
    type: 'image' | 'video'
    url: string
  }
  customHTML?: string
  // Attributs pour le welcome-screen et thankyou-screen
  showAttachment?: boolean
  attachmentType?: 'image' | 'video'
  attachmentUrl?: string
  attachmentLayout?: 'stack' | 'float-right' | 'float-left' | 'split-right' | 'split-left'
  focalPoint?: { x: number; y: number }
  // Attributs pour le bloc Repeater
  initialQuestion?: string // Question initiale demandant si l'utilisateur veut commencer (ex: "Avez-vous du matériel à déclarer ?")
  initialYesLabel?: string // Label pour "Oui" sur la question initiale
  initialNoLabel?: string // Label pour "Non" sur la question initiale
  repeatQuestion?: string // Question demandant si l'utilisateur veut répéter (ex: "Avez-vous besoin d'autre matériel ?")
  repeatDescription?: string // Description pour la question de répétition (supporte les variables @1, @2a, etc.)
  repeatYesLabel?: string // Label pour "Oui"
  repeatNoLabel?: string // Label pour "Non"
  maxRepetitions?: number // Nombre maximum de répétitions autorisées
  // Attributs pour le bloc Date Avancée
  minDateType?: 'none' | 'specific' | 'today' | 'block' // Type de date minimum
  minDate?: string // Date minimum spécifique (format YYYY-MM-DD)
  minDateBlockId?: string // ID du bloc date à utiliser comme minimum
  minDateOffset?: number // Décalage en jours par rapport à la date source
  maxDateType?: 'none' | 'specific' | 'today' | 'block' // Type de date maximum
  maxDate?: string // Date maximum spécifique (format YYYY-MM-DD)
  maxDateBlockId?: string // ID du bloc date à utiliser comme maximum
  maxDateOffset?: number // Décalage en jours par rapport à la date source
  isDateRange?: boolean // Activer la sélection d'une plage de dates (début et fin)
  startDateLabel?: string // Label pour la date de début
  endDateLabel?: string // Label pour la date de fin
  // Attributs pour le bloc Heure
  isTimeRange?: boolean // Activer la sélection d'une plage horaire (début et fin)
  startTimeLabel?: string // Label pour l'heure de début
  endTimeLabel?: string // Label pour l'heure de fin
  // Attributs pour le bloc Téléphone
  phoneDigitsCount?: number // Nombre de chiffres attendu (par défaut 10)
  phoneFormat?: 'standard' | 'international' // Format: standard (0612...) ou international (+33...)
  // Attributs pour le bloc Email
  validateEmail?: boolean // Activer la validation stricte de l'email (par défaut true)
  // Attributs pour le bloc Sélection Image
  imageLayout?: 'side-by-side' | 'stacked' // Disposition des images: côte à côte ou superposées
  imageColumns?: 2 | 3 | 4 // Nombre de colonnes pour l'affichage côte à côte
  showImageLabels?: boolean // Afficher les labels sous les images
  imageSize?: 'small' | 'medium' | 'large' // Taille des images
  // Attributs pour le bloc Choix Multiple
  allowOtherOption?: boolean // Afficher une option "Autre" avec saisie libre
  // Attributs pour le bloc Repeater
  excludePreviousChoices?: boolean // Masquer les choix déjà sélectionnés dans les répétitions précédentes
  // Attributs pour le bloc Dropdown (Liste déroulante)
  allowCustomValue?: boolean // Autoriser les réponses personnalisées (saisie libre)
  customValuePlaceholder?: string // Placeholder pour la saisie personnalisée
  choiceFilterSourceBlockId?: string // Bloc source dont la valeur détermine quels choix masquer
  choiceFilters?: { sourceValue: string; hiddenChoiceIds: string[] }[] // Par valeur source → IDs de choix à masquer
  // Attributs pour l'écran de remerciement (thankyou-screen)
  showRestartButton?: boolean // Afficher un bouton "Recommencer" pour relancer le formulaire
  restartButtonText?: string // Texte du bouton de recommencement
  // Mention RGPD (welcome-screen et thankyou-screen)
  showGdprNotice?: boolean // Afficher un lien vers une mention RGPD
  gdprNoticeLinkText?: string // Texte du lien (ex: "Politique de confidentialité")
  gdprNoticeText?: string // Contenu affiché dans la fenêtre (durée de conservation, droits, contact…)
  // Attributs pour le bloc Texte Court
  textTransform?: 'none' | 'uppercase' | 'capitalize' // Formatage automatique de la réponse
  // Attributs pour le bloc Adresse
  addressScope?: 'full' | 'city' // 'city' restreint l'autocomplétion aux communes (API BAN type=municipality)
  // Attributs pour le bloc Quantité
  quantitySourceBlockId?: string // ID du bloc source (dropdown, multiple-choice, image-selection)
  quantityItems?: { choiceId: string; choiceLabel: string; choiceValue: string; min?: number; max?: number }[] // Configuration par choix
  quantityOutputFormat?: 'object' | 'value' // Format du JSON envoyé : objet {choix: qté} ou valeur simple
  quantityMaxFromCatalog?: boolean // Plafonner chaque quantité au disponible remonté par le catalogue
  // Attributs pour la source externe (catalogue de matériel)
  choicesSource?: 'static' | 'catalog' // 'catalog' : les options viennent de l'application de gestion
  catalogDateBlockId?: string // Bloc date dont la réponse détermine la période interrogée
  catalogEndDateBlockId?: string // Bloc date de fin, si la période tient sur deux blocs
  catalogService?: string // Slug, identifiant ou nom du service : ne proposer que son périmètre
  catalogKind?: 'all' | 'prestation' | 'materiel' // Nature des articles proposés
  catalogCategoryId?: number // Ne garder qu'une catégorie (vide = tout le périmètre)
  catalogHideUnavailable?: boolean // Masquer les articles dont il ne reste rien (défaut : true)
  catalogShowRemaining?: boolean // Afficher le disponible après le libellé (défaut : true)
  // Remplis à l'affichage du formulaire public, jamais enregistrés : état de la requête au catalogue.
  catalogState?: 'no-date' | 'loading' | 'ready' | 'error'
  catalogMessage?: string
  // Attributs pour le bloc Oui/Non
  yesLabel?: string // Label du bouton "Oui"
  noLabel?: string // Label du bouton "Non"
  // Attributs pour le bloc Curseur
  sliderStyle?: 'slider' | 'stars' // Affichage: barre de curseur (défaut) ou notation par icônes
  starIcon?: 'star' | 'heart' | 'thumb' // Icône utilisée en mode notation
  starColor?: string // Couleur des icônes (vide = jaune par défaut)
  starSize?: 'sm' | 'md' | 'lg' // Taille des icônes
  // Masquage conditionnel (blocs internes d'un répéteur)
  visibilitySourceBlockId?: string // ID du bloc frère source dont la réponse détermine la visibilité
  visibilityValues?: string[] // Valeurs du bloc source qui affichent ce bloc (vide = toujours visible)
  // Média attaché au bloc (image ou fichier Excel)
  blockMedia?: {
    type: 'image' | 'excel'
    url: string
    name: string
    imagePosition?: 'top' | 'bottom' | 'left' | 'right'
    excelAllowExpand?: boolean
    excelAllowDownload?: boolean
  }
}

export interface FormBlock {
  id: string
  type: BlockType
  attributes: BlockAttributes
  innerBlocks?: FormBlock[] // Pour les blocs de groupe
}

// Logic types
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty'

export interface LogicCondition {
  blockId: string
  operator: ConditionOperator
  value: string | number
}

export interface LogicRule {
  id: string
  enabled?: boolean
  conditions: LogicCondition[]
  conditionMatch: 'all' | 'any'
  action: 'jump' | 'hide' | 'show' | 'require'
  targetBlockId?: string
}

export interface BlockLogic {
  blockId: string
  rules: LogicRule[]
}

// Webhook types
export interface WebhookHeader {
  key: string
  value: string
}

export interface WebhookFieldMapping {
  key: string
  blockId: string | 'entry_date' | 'entry_id' | '_custom'
  customTemplate?: string // Used when blockId === '_custom'
  flatRepeater?: boolean // Développe un répéteur en clés plates : {clé}_{champ}_{N}
}

export interface Webhook {
  id: string
  name: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  headers: WebhookHeader[]
  bodyFormat: 'JSON' | 'FORM'
  fieldMappings: WebhookFieldMapping[]
  enabled: boolean
  triggerOn: 'submission' | 'partial' | 'save'
  // Secret partagé avec le destinataire : renseigné, chaque envoi porte l'en-tête
  // X-Webhook-Signature. Laissé vide, le webhook part non signé, comme avant.
  secret?: string
}

// ── Modèles de document (.docx) ─────────────────────────────────────────────
// Champs "méta" utilisables comme jetons sans correspondre à un bloc du formulaire.
export type DocumentMetaField =
  | 'entry_id'
  | 'entry_date'
  | 'today'
  | 'form_title'

// Association persistante jeton ↔ bloc. Le jeton est figé à la création : renommer
// le libellé d'une question ne casse donc jamais un .docx déjà rédigé.
//
// `choiceValue` transforme le jeton en case à cocher : il rend ☒ si cette option précise est
// retenue dans la réponse, ☐ sinon. Le document reste donc imprimable et remplissable à la main,
// la case vide étant un vrai caractère de case.
export interface DocumentFieldMapping {
  tag: string
  blockId: string | DocumentMetaField
  choiceValue?: string
}

export type DocumentCheckboxStyle = 'unicode' | 'wingdings'

export type DocumentOutputFormat = 'docx' | 'pdf'

export interface DocumentTemplateSettings {
  fileName?: string // nom d'origine, affiché dans l'interface
  storedName?: string // uuid.docx dans le stockage privé
  uploadedAt?: string
  size?: number
  mappings: DocumentFieldMapping[]
  outputFormat?: DocumentOutputFormat // 'pdf' n'est proposé que si un convertisseur est vérifié
  outputName?: string // gabarit du nom de fichier, ex: "Ordre de mission - {nom_agent}"
  checkboxStyle?: DocumentCheckboxStyle // jeu de caractères des cases : Unicode (défaut) ou Wingdings
}

/**
 * Un circuit d'envoi : « si telles conditions sont remplies, alors ces destinataires reçoivent
 * le document ». Sans condition, le circuit part systématiquement.
 *
 * Permet d'adresser chaque service séparément — la cantine seulement si une restauration est
 * demandée, le service technique seulement si du matériel est nécessaire, etc.
 */
export interface DocumentEmailRoute {
  id: string
  name: string
  enabled: boolean
  conditions: LogicCondition[]
  conditionMatch: 'all' | 'any'
  recipients: string[] // adresses fixes
  recipientBlockIds: string[] // blocs de type email dont la valeur sert de destinataire
  subject: string
  body: string // HTML ; accepte les mêmes jetons {tag} que le modèle
  attachDocument: boolean // un circuit peut notifier sans joindre le document
}

export interface DocumentEmailSettings {
  enabled: boolean
  sendOnSubmission: boolean
  routes: DocumentEmailRoute[]
  // Champs de l'ancienne configuration à circuit unique, conservés le temps de la migration
  // effectuée par parseFormDocumentSettings(). Ne plus lire directement.
  recipients?: string[]
  recipientBlockIds?: string[]
  subject?: string
  body?: string
}

export interface FormDocumentSettings {
  template: DocumentTemplateSettings
  email: DocumentEmailSettings
}

// Convertisseur PDF externe (SystemSettings.documentSettings)
export interface SystemDocumentSettings {
  pdfConverterUrl?: string
  pdfConverterVerified?: boolean // passe à false dès que l'URL change
  pdfConverterVerifiedAt?: string
  pdfConverterVersion?: string
}

// Résultat d'un circuit pour une réponse donnée.
// `matched: false` signifie que les conditions n'étaient pas remplies — le circuit a donc été
// écarté volontairement, ce n'est pas un échec.
export interface DocumentRouteStatus {
  routeId: string
  routeName: string
  matched: boolean
  success?: boolean
  recipients?: string[]
  accepted?: string[] // adresses acceptées par le serveur SMTP
  rejected?: string[] // adresses refusées par le serveur SMTP
  error?: string
}

// Statut du dernier envoi, stocké dans Response.documentStatus
export interface DocumentSendStatus {
  success: boolean // vrai si tous les circuits déclenchés ont abouti
  lastSent: string
  fileName?: string
  routes?: DocumentRouteStatus[]
  // Ancienne forme à circuit unique, encore présente sur les réponses antérieures
  recipients?: string[]
  error?: string
}

// ── Rapports périodiques (Form.reportSettings) ─────────────────────────────
//
// Un rapport agrège les réponses d'une période et les met en forme dans un PDF envoyé
// par e-mail. Contrairement aux circuits d'envoi de documents (une réponse = un envoi),
// il s'agit d'une synthèse : nombre de réponses, répartition des choix, verbatims…

export type ReportPeriodMode =
  | 'all' // depuis la création du formulaire
  | 'last_days' // N derniers jours
  | 'current_month'
  | 'previous_month'
  | 'since_last_report' // depuis le dernier envoi réussi
  | 'custom' // plage fixe

export interface ReportPeriod {
  mode: ReportPeriodMode
  days?: number // mode last_days
  from?: string // YYYY-MM-DD, mode custom
  to?: string // YYYY-MM-DD, mode custom
}

export type ReportFrequency = 'daily' | 'weekly' | 'monthly'

export interface ReportSchedule {
  enabled: boolean
  frequency: ReportFrequency
  dayOfWeek: number // 0 = dimanche … 6 = samedi (frequency: weekly)
  dayOfMonth: number // 1 … 28 (frequency: monthly) — 28 pour exister tous les mois
  hour: number // 0 … 23, heure du serveur
  minute: number // 0 … 59
  lastRunAt?: string // ISO — empêche de renvoyer deux fois la même échéance
}

export interface ReportSections {
  summary: boolean // indicateurs clés
  timeline: boolean // évolution du nombre de réponses
  choiceBreakdown: boolean // répartition des questions à choix, en %
  numericStats: boolean // min / moyenne / médiane / max
  textAnswers: boolean // réponses libres : fréquences et extraits
  completion: boolean // taux de remplissage par question
  responseTable: boolean // tableau des dernières réponses
}

// Densité de mise en page du PDF. N'agit que sur les blancs, jamais sur le corps du texte :
// les décalages du rendu (cartes d'indicateurs, tableaux) sont calculés autour de tailles de
// police fixes.
export type ReportDensity = 'compact' | 'normal' | 'airy'

export interface ReportSendStatus {
  success: boolean
  sentAt: string
  trigger: 'manual' | 'schedule' | 'closing'
  recipients?: string[]
  accepted?: string[] // adresses acceptées par le serveur SMTP
  rejected?: string[] // adresses refusées par le serveur SMTP
  responseCount?: number
  periodLabel?: string
  error?: string
}

export interface FormReportSettings {
  sections: ReportSections
  period: ReportPeriod
  closingDate?: string // YYYY-MM-DD — borne haute de toutes les périodes
  sendFinalReportOnClosing: boolean
  finalReportSentAt?: string // ISO — le rapport de clôture ne part qu'une fois
  schedule: ReportSchedule
  recipients: string[]
  subject: string
  body: string // HTML, jetons {form_title} {period} {response_count} {generated_at}
  fileNamePattern: string
  includeEmptyChoices: boolean // afficher aussi les options jamais choisies
  textSampleSize: number // nombre de verbatims repris par question libre
  showAllTextAnswers: boolean // reprendre toutes les réponses libres au lieu d'un échantillon
  tableRowLimit: number // lignes du tableau des dernières réponses
  density: ReportDensity // espacement du PDF
  sectionPageBreak: boolean // chaque section commence sur une nouvelle page
  lastStatus?: ReportSendStatus
}

// ── Options d'accès au formulaire (Form.accessSettings) ────────────────────
//
// Conditions d'ouverture du formulaire public : fenêtre de publication, mot de passe,
// quota de réponses, restrictions de participation. Toutes sont appliquées côté serveur
// (rendu de /[slug] et route de soumission) : un contournement côté client est sans effet.

export type FormGateState =
  | 'open'
  | 'not_open'
  | 'closed'
  | 'limit_reached'
  | 'already_submitted'
  | 'login_required'
  | 'password_required'

export interface FormAccessSettings {
  // Fenêtre de publication — chaînes ISO locales (YYYY-MM-DDTHH:mm), heure du serveur
  opensAt?: string | null
  closesAt?: string | null
  notYetOpenMessage?: string
  closedMessage?: string

  // Mot de passe d'accès. Seul le condensat est stocké ; il n'est jamais transmis au client.
  passwordEnabled?: boolean
  passwordHash?: string | null
  passwordMessage?: string

  // Quota de réponses
  maxResponsesEnabled?: boolean
  maxResponses?: number | null
  limitReachedMessage?: string

  // Restrictions de participation
  onePerDevice?: boolean
  alreadySubmittedMessage?: string
  requireLogin?: boolean
  loginRequiredMessage?: string

  // Confidentialité
  noIndex?: boolean
}

// Version transmise au navigateur : sans condensat de mot de passe.
export type PublicFormAccessSettings = Omit<FormAccessSettings, 'passwordHash'> & {
  passwordSet?: boolean
}

// Theme types
export type BackgroundType = 'solid' | 'gradient' | 'image'
export type GradientDirection = 'to-right' | 'to-left' | 'to-bottom' | 'to-top' | 'to-bottom-right' | 'to-bottom-left' | 'to-top-right' | 'to-top-left'

// Paramètres RGPD (SystemSettings.gdprSettings)
export interface GdprSettings {
  retentionEnabled?: boolean
  retentionMonths?: number // durée légale par défaut : 36 mois
}

// Personnalisation de la page de connexion (SystemSettings.loginPageSettings)
export interface LoginPageSettings {
  showForgotPassword?: boolean
  backgroundType?: BackgroundType
  backgroundColor?: string
  gradientStartColor?: string
  gradientEndColor?: string
  gradientDirection?: GradientDirection
  backgroundImage?: string
  backgroundBlur?: number // 0-40, en px — effet de fondu sur l'image de fond
}

export interface ThemeProperties {
  font?: string
  fontSize?: { lg: string; sm: string }
  backgroundType?: BackgroundType
  backgroundColor?: string
  gradientStartColor?: string
  gradientEndColor?: string
  gradientDirection?: GradientDirection
  gradientOpacity?: number // 0 à 100
  backgroundImage?: string
  backgroundImageOpacity?: number // 0 à 100
  questionsColor?: string
  answersColor?: string
  buttonsBgColor?: string
  buttonsFontColor?: string
  buttonsBorderRadius?: 'none' | 'small' | 'medium' | 'large' | 'full'
  inputBorderRadius?: 'none' | 'small' | 'medium' | 'large'
  inputStyle?: 'underline' | 'outlined' | 'filled'
  logo?: { url: string; width?: number }
  progressBarColor?: string
  errorColor?: string
  choicesBgColor?: string
}

export interface Theme {
  id: string
  name: string
  properties: ThemeProperties
  isDefault: boolean
}

// Form types
export interface FormSettings {
  showProgressBar?: boolean
  progressBarPosition?: 'top' | 'bottom' | 'left' | 'right'
  progressBarSize?: 'small' | 'medium' | 'large'
  showQuestionNumbers?: boolean
  showQuestionCounter?: boolean
  lettersOnAnswers?: boolean
  animationDirection?: 'vertical' | 'horizontal'
  disableSwipeByWheel?: boolean
  autoSubmitLastQuestion?: boolean
  showBranding?: boolean
  brandingText?: string
  logo?: string // URL du logo
  showLogo?: boolean
  logoPosition?: 'top' | 'bottom'
  logoAlignment?: 'left' | 'center' | 'right'
}

export interface Form {
  id: string
  title: string
  slug: string
  description?: string
  status: 'draft' | 'published'
  blocks: FormBlock[]
  logic: BlockLogic[]
  settings: FormSettings
  webhooks: Webhook[]
  themeId?: string
  theme?: Theme
  createdAt: Date
  updatedAt: Date
}

export interface FormVersion {
  id: string
  formId: string
  number: number
  label?: string | null
  isAuto: boolean
  title: string
  blocks: FormBlock[]
  logic: BlockLogic[]
  settings: FormSettings
  webhooks: Webhook[]
  themeId?: string | null
  createdBy: string
  createdAt: Date
}

// Response types
export interface ResponseAnswer {
  blockId: string
  blockType: BlockType
  value: any
}

export interface FormResponse {
  id: string
  formId: string
  answers: ResponseAnswer[]
  status: 'completed' | 'partial'
  metadata: {
    ip?: string
    userAgent?: string
    submittedAt: Date
  }
  createdAt: Date
}

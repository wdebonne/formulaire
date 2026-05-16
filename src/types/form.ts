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
  // Attributs pour l'écran de remerciement (thankyou-screen)
  showRestartButton?: boolean // Afficher un bouton "Recommencer" pour relancer le formulaire
  restartButtonText?: string // Texte du bouton de recommencement
  // Attributs pour le bloc Texte Court
  textTransform?: 'none' | 'uppercase' | 'capitalize' // Formatage automatique de la réponse
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
}

// Theme types
export type BackgroundType = 'solid' | 'gradient' | 'image'
export type GradientDirection = 'to-right' | 'to-left' | 'to-bottom' | 'to-top' | 'to-bottom-right' | 'to-bottom-left' | 'to-top-right' | 'to-top-left'

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

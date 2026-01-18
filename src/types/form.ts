// Block type definitions
export type BlockType =
  | 'short-text'
  | 'long-text'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'dropdown'
  | 'multiple-choice'
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
}

export interface BlockAttributes {
  label?: string
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
  // Attributs pour le bloc Repeater
  initialQuestion?: string // Question initiale demandant si l'utilisateur veut commencer (ex: "Avez-vous du matériel à déclarer ?")
  initialYesLabel?: string // Label pour "Oui" sur la question initiale
  initialNoLabel?: string // Label pour "Non" sur la question initiale
  repeatQuestion?: string // Question demandant si l'utilisateur veut répéter (ex: "Avez-vous besoin d'autre matériel ?")
  repeatYesLabel?: string // Label pour "Oui"
  repeatNoLabel?: string // Label pour "Non"
  maxRepetitions?: number // Nombre maximum de répétitions autorisées
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
  blockId: string | 'entry_date' | 'entry_id'
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
export interface ThemeProperties {
  font?: string
  fontSize?: { lg: string; sm: string }
  backgroundColor?: string
  backgroundImage?: string
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

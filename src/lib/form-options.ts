// Options d'accès d'un formulaire — partie pure, sans Prisma ni crypto.
//
// Même découpage que audit-actions.ts / audit-log.ts : ce fichier est importable depuis un
// composant 'use client' (la modale d'options), tandis que l'application des règles — comptage
// des réponses, cookies signés, bcrypt — vit dans form-gate.ts, côté serveur uniquement.

import type {
  FormAccessSettings,
  FormGateState,
  PublicFormAccessSettings,
} from '@/types/form'

export const DEFAULT_ACCESS_MESSAGES: Record<Exclude<FormGateState, 'open'>, string> = {
  not_open: "Ce formulaire n'est pas encore ouvert.",
  closed: 'Ce formulaire est clôturé et n’accepte plus de réponses.',
  limit_reached: 'Ce formulaire a atteint le nombre maximum de réponses.',
  already_submitted: 'Vous avez déjà répondu à ce formulaire.',
  login_required: 'Ce formulaire est réservé aux utilisateurs connectés.',
  password_required: 'Ce formulaire est protégé. Saisissez le mot de passe pour y accéder.',
}

export const DEFAULT_ACCESS_SETTINGS: FormAccessSettings = {
  opensAt: null,
  closesAt: null,
  notYetOpenMessage: '',
  closedMessage: '',
  passwordEnabled: false,
  passwordHash: null,
  passwordMessage: '',
  maxResponsesEnabled: false,
  maxResponses: null,
  limitReachedMessage: '',
  onePerDevice: false,
  alreadySubmittedMessage: '',
  requireLogin: false,
  loginRequiredMessage: '',
  noIndex: false,
}

export function parseFormAccessSettings(raw: string | null | undefined): FormAccessSettings {
  if (!raw) return { ...DEFAULT_ACCESS_SETTINGS }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_ACCESS_SETTINGS }
    return { ...DEFAULT_ACCESS_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_ACCESS_SETTINGS }
  }
}

// Retire le condensat avant tout envoi vers le navigateur.
export function toPublicAccessSettings(settings: FormAccessSettings): PublicFormAccessSettings {
  const { passwordHash, ...rest } = settings
  return { ...rest, passwordSet: Boolean(passwordHash) }
}

export function accessMessage(
  settings: FormAccessSettings,
  state: Exclude<FormGateState, 'open'>
): string {
  const custom = {
    not_open: settings.notYetOpenMessage,
    closed: settings.closedMessage,
    limit_reached: settings.limitReachedMessage,
    already_submitted: settings.alreadySubmittedMessage,
    login_required: settings.loginRequiredMessage,
    password_required: settings.passwordMessage,
  }[state]

  return custom?.trim() || DEFAULT_ACCESS_MESSAGES[state]
}

// Les dates sont saisies en <input type="datetime-local"> et stockées telles quelles
// ("2026-09-01T08:30"), donc sans fuseau : elles sont interprétées dans le fuseau du serveur,
// qui est aussi celui affiché dans la modale. Une date invalide est ignorée plutôt que de
// bloquer le formulaire.
export function parseLocalDateTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatAccessDate(value: string | null | undefined): string {
  const date = parseLocalDateTime(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date)
}

// Résumé affiché sur la carte du formulaire et dans la modale.
export function accessSummary(settings: FormAccessSettings): string[] {
  const parts: string[] = []
  if (settings.opensAt) parts.push(`Ouvre le ${formatAccessDate(settings.opensAt)}`)
  if (settings.closesAt) parts.push(`Clôture le ${formatAccessDate(settings.closesAt)}`)
  if (settings.passwordEnabled && settings.passwordHash) parts.push('Mot de passe')
  if (settings.maxResponsesEnabled && settings.maxResponses) {
    parts.push(`${settings.maxResponses} réponse(s) max.`)
  }
  if (settings.onePerDevice) parts.push('Une réponse par appareil')
  if (settings.requireLogin) parts.push('Connexion requise')
  if (settings.noIndex) parts.push('Non indexé')
  return parts
}

export function hasAnyRestriction(settings: FormAccessSettings): boolean {
  return accessSummary(settings).length > 0
}

// État d'un formulaire publié indépendamment du visiteur — utilisé pour signaler sur le tableau
// de bord qu'un formulaire « Publié » n'accepte en réalité plus (ou pas encore) de réponses.
// Les restrictions liées au visiteur (mot de passe, connexion, appareil) n'entrent pas en compte.
export function scheduleState(
  settings: FormAccessSettings,
  responsesCount: number
): 'open' | 'scheduled' | 'closed' {
  const now = Date.now()

  const opensAt = parseLocalDateTime(settings.opensAt)
  if (opensAt && now < opensAt.getTime()) return 'scheduled'

  const closesAt = parseLocalDateTime(settings.closesAt)
  if (closesAt && now >= closesAt.getTime()) return 'closed'

  if (
    settings.maxResponsesEnabled &&
    settings.maxResponses &&
    responsesCount >= settings.maxResponses
  ) {
    return 'closed'
  }

  return 'open'
}

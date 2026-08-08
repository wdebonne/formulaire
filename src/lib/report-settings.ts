// Réglages des rapports périodiques : valeurs par défaut, lecture tolérante du JSON stocké
// dans Form.reportSettings, et calcul des échéances de planification.
//
// Volontairement pur (aucun import Prisma) : la modale « Rapports » l'importe côté client pour
// afficher la prochaine échéance en direct, les routes API et le planificateur côté serveur.

import type {
  FormReportSettings,
  ReportFrequency,
  ReportPeriod,
  ReportPeriodMode,
  ReportSchedule,
  ReportSections,
  ReportSendStatus,
} from '@/types/form'

export const DEFAULT_REPORT_SUBJECT = 'Rapport — {form_title} ({period})'

export const DEFAULT_REPORT_BODY =
  '<p>Bonjour,</p>\n' +
  '<p>Veuillez trouver ci-joint le rapport du formulaire « {form_title} » pour la période ' +
  '{period}.</p>\n' +
  '<p><strong>{response_count}</strong> réponse(s) sur cette période.</p>\n' +
  '<p>Cordialement,</p>'

export const DEFAULT_REPORT_SECTIONS: ReportSections = {
  summary: true,
  timeline: true,
  choiceBreakdown: true,
  numericStats: true,
  textAnswers: true,
  completion: true,
  responseTable: false,
}

export const DEFAULT_REPORT_SCHEDULE: ReportSchedule = {
  enabled: false,
  frequency: 'weekly',
  dayOfWeek: 1, // lundi
  dayOfMonth: 1,
  hour: 8,
  minute: 0,
}

export const DEFAULT_REPORT_SETTINGS: FormReportSettings = {
  sections: { ...DEFAULT_REPORT_SECTIONS },
  period: { mode: 'last_days', days: 7 },
  sendFinalReportOnClosing: false,
  schedule: { ...DEFAULT_REPORT_SCHEDULE },
  recipients: [],
  subject: DEFAULT_REPORT_SUBJECT,
  body: DEFAULT_REPORT_BODY,
  fileNamePattern: 'Rapport - {form_title}',
  includeEmptyChoices: true,
  textSampleSize: 5,
  tableRowLimit: 20,
}

const PERIOD_MODES: ReportPeriodMode[] = [
  'all',
  'last_days',
  'current_month',
  'previous_month',
  'since_last_report',
  'custom',
]

const FREQUENCIES: ReportFrequency[] = ['daily', 'weekly', 'monthly']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.trunc(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function isoDate(value: unknown): string | undefined {
  const raw = String(value ?? '').trim()
  return DATE_RE.test(raw) ? raw : undefined
}

export function sanitizeReportRecipients(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const unique = new Set<string>()
  for (const raw of input.slice(0, 100)) {
    const address = String(raw).trim()
    if (EMAIL_RE.test(address)) unique.add(address)
  }
  return Array.from(unique)
}

function parsePeriod(raw: any): ReportPeriod {
  const mode: ReportPeriodMode = PERIOD_MODES.includes(raw?.mode)
    ? raw.mode
    : DEFAULT_REPORT_SETTINGS.period.mode

  return {
    mode,
    days: clampInt(raw?.days, 1, 3650, 7),
    ...(isoDate(raw?.from) && { from: isoDate(raw?.from) }),
    ...(isoDate(raw?.to) && { to: isoDate(raw?.to) }),
  }
}

function parseSchedule(raw: any): ReportSchedule {
  const lastRunAt = String(raw?.lastRunAt ?? '').trim()
  return {
    enabled: bool(raw?.enabled, false),
    frequency: FREQUENCIES.includes(raw?.frequency) ? raw.frequency : 'weekly',
    dayOfWeek: clampInt(raw?.dayOfWeek, 0, 6, 1),
    // Plafonné à 28 : un rapport mensuel doit exister aussi en février.
    dayOfMonth: clampInt(raw?.dayOfMonth, 1, 28, 1),
    hour: clampInt(raw?.hour, 0, 23, 8),
    minute: clampInt(raw?.minute, 0, 59, 0),
    ...(lastRunAt && !Number.isNaN(Date.parse(lastRunAt)) && { lastRunAt }),
  }
}

function parseStatus(raw: any): ReportSendStatus | undefined {
  if (!raw || typeof raw !== 'object' || typeof raw.success !== 'boolean') return undefined
  return {
    success: raw.success,
    sentAt: String(raw.sentAt ?? ''),
    trigger: ['manual', 'schedule', 'closing'].includes(raw.trigger) ? raw.trigger : 'manual',
    ...(Array.isArray(raw.recipients) && { recipients: raw.recipients.map(String) }),
    ...(Array.isArray(raw.accepted) && { accepted: raw.accepted.map(String) }),
    ...(Array.isArray(raw.rejected) && { rejected: raw.rejected.map(String) }),
    ...(raw.responseCount !== undefined && { responseCount: Number(raw.responseCount) || 0 }),
    ...(raw.periodLabel && { periodLabel: String(raw.periodLabel) }),
    ...(raw.error && { error: String(raw.error) }),
  }
}

/**
 * Lecture tolérante de Form.reportSettings : un formulaire créé avant cette fonctionnalité
 * porte `{}`, et tout champ manquant retombe sur la valeur par défaut.
 */
export function parseFormReportSettings(raw: string | null | undefined): FormReportSettings {
  let parsed: any = {}
  try {
    parsed = raw ? JSON.parse(raw) : {}
  } catch {
    parsed = {}
  }
  if (!parsed || typeof parsed !== 'object') parsed = {}

  const sections = parsed.sections ?? {}

  return {
    sections: {
      summary: bool(sections.summary, DEFAULT_REPORT_SECTIONS.summary),
      timeline: bool(sections.timeline, DEFAULT_REPORT_SECTIONS.timeline),
      choiceBreakdown: bool(sections.choiceBreakdown, DEFAULT_REPORT_SECTIONS.choiceBreakdown),
      numericStats: bool(sections.numericStats, DEFAULT_REPORT_SECTIONS.numericStats),
      textAnswers: bool(sections.textAnswers, DEFAULT_REPORT_SECTIONS.textAnswers),
      completion: bool(sections.completion, DEFAULT_REPORT_SECTIONS.completion),
      responseTable: bool(sections.responseTable, DEFAULT_REPORT_SECTIONS.responseTable),
    },
    period: parsePeriod(parsed.period),
    ...(isoDate(parsed.closingDate) && { closingDate: isoDate(parsed.closingDate) }),
    sendFinalReportOnClosing: bool(parsed.sendFinalReportOnClosing, false),
    ...(parsed.finalReportSentAt && { finalReportSentAt: String(parsed.finalReportSentAt) }),
    schedule: parseSchedule(parsed.schedule),
    recipients: sanitizeReportRecipients(parsed.recipients),
    subject: String(parsed.subject ?? DEFAULT_REPORT_SUBJECT).slice(0, 300),
    body: String(parsed.body ?? DEFAULT_REPORT_BODY).slice(0, 20000),
    fileNamePattern: String(parsed.fileNamePattern ?? DEFAULT_REPORT_SETTINGS.fileNamePattern).slice(0, 200),
    includeEmptyChoices: bool(parsed.includeEmptyChoices, true),
    textSampleSize: clampInt(parsed.textSampleSize, 0, 50, 5),
    tableRowLimit: clampInt(parsed.tableRowLimit, 1, 200, 20),
    ...(parseStatus(parsed.lastStatus) && { lastStatus: parseStatus(parsed.lastStatus) }),
  }
}

// ── Planification ──────────────────────────────────────────────────────────
//
// Les heures sont interprétées dans le fuseau du serveur (TZ du conteneur). Un rapport
// hebdomadaire réglé sur « lundi 8 h » part donc à 8 h locales du serveur.

function shiftPeriod(date: Date, frequency: ReportFrequency, direction: 1 | -1): void {
  if (frequency === 'daily') date.setDate(date.getDate() + direction)
  else if (frequency === 'weekly') date.setDate(date.getDate() + 7 * direction)
  else date.setMonth(date.getMonth() + direction)
}

/** Prochaine échéance strictement postérieure à `from`. */
export function nextOccurrence(schedule: ReportSchedule, from: Date): Date {
  const candidate = new Date(from)
  candidate.setHours(schedule.hour, schedule.minute, 0, 0)

  if (schedule.frequency === 'weekly') {
    candidate.setDate(candidate.getDate() + ((schedule.dayOfWeek - candidate.getDay() + 7) % 7))
  } else if (schedule.frequency === 'monthly') {
    candidate.setDate(schedule.dayOfMonth)
  }

  if (candidate.getTime() <= from.getTime()) shiftPeriod(candidate, schedule.frequency, 1)
  return candidate
}

/** Dernière échéance passée (au plus tard `from`). */
export function previousOccurrence(schedule: ReportSchedule, from: Date): Date {
  const previous = nextOccurrence(schedule, from)
  shiftPeriod(previous, schedule.frequency, -1)
  return previous
}

/**
 * Une échéance est due lorsqu'elle est passée et postérieure au dernier envoi.
 *
 * `lastRunAt` absent renvoie faux : le planificateur l'horodate alors sans envoyer, ce qui
 * évite qu'activer la planification un lundi à 9 h ne déclenche aussitôt le rapport de 8 h.
 */
export function isScheduleDue(schedule: ReportSchedule, now: Date): boolean {
  if (!schedule.enabled || !schedule.lastRunAt) return false
  const last = Date.parse(schedule.lastRunAt)
  if (Number.isNaN(last)) return false
  return previousOccurrence(schedule, now).getTime() > last
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

export function describeSchedule(schedule: ReportSchedule): string {
  const time = `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`
  if (schedule.frequency === 'daily') return `Tous les jours à ${time}`
  if (schedule.frequency === 'weekly') return `Chaque ${WEEKDAYS[schedule.dayOfWeek]} à ${time}`
  return `Le ${schedule.dayOfMonth} de chaque mois à ${time}`
}

/** Remplace les jetons de l'objet et du corps de l'e-mail de rapport. */
export function applyReportTokens(template: string, tokens: Record<string, string>): string {
  return String(template ?? '').replace(/\{([a-z0-9_]+)\}/gi, (match, key: string) => {
    const value = tokens[key.toLowerCase()]
    return value === undefined ? match : value
  })
}

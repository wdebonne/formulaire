// Calcul des statistiques d'un rapport à partir des blocs du formulaire et des réponses.
//
// Volontairement pur (aucun import Prisma, pdfkit ni nodemailer) : la modale « Rapports »
// l'utilise côté client pour afficher un aperçu chiffré en direct, et le rendu PDF côté serveur
// travaille sur exactement la même structure — ce que l'utilisateur voit à l'écran est donc
// bien ce que contiendra le PDF envoyé.
//
// Response.data mélange deux formes selon l'ancienneté de la réponse : les valeurs brutes
// (slugs) pour les réponses antérieures à resolveDataLabels(), les libellés déjà résolus et
// joints par « , » depuis. Comme dans condition-eval.ts, les deux sont normalisées avant
// comptage, sans quoi une même option serait comptée deux fois.

import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { FormReportSettings } from '@/types/form'

export interface ReportResponseInput {
  id: string
  data: Record<string, any>
  createdAt: Date | string
}

export interface ReportBlockInput {
  id: string
  type: string
  attributes: Record<string, any>
  innerBlocks?: ReportBlockInput[]
}

export interface ReportRange {
  from: Date | null
  to: Date
  label: string
}

export interface ReportOptionStat {
  label: string
  count: number
  percent: number // part des réponses ayant répondu à la question
}

export interface ReportChoiceStat {
  blockId: string
  label: string
  parentLabel?: string
  type: string
  multi: boolean
  unit?: string // « quantité » pour les blocs de type quantity
  answered: number
  options: ReportOptionStat[]
}

export interface ReportNumericStat {
  blockId: string
  label: string
  parentLabel?: string
  count: number
  min: number
  max: number
  average: number
  median: number
  sum: number
  // Bornes déclarées sur la question (curseur, nombre borné) : ce sont elles qui donnent son
  // sens à la moyenne — « 4,2 / 5 » se lit d'un coup d'œil, « 4,2 » non.
  scaleMin?: number
  scaleMax?: number
  // Répartition par valeur, uniquement pour une échelle courte de valeurs entières (note de
  // 1 à 5, de 0 à 10…) ; au-delà la liste serait plus longue que lisible. Les valeurs sans
  // réponse sont conservées : sur une note, « personne n'a mis 1 » est une information.
  distribution?: { value: number; count: number; percent: number }[]
}

export interface ReportFreeformStat {
  blockId: string
  label: string
  parentLabel?: string
  answered: number
  total: number // valeurs saisies, répétitions de répéteur comprises — peut dépasser `answered`
  top: { value: string; count: number }[] // uniquement les valeurs qui se répètent
  samples: string[]
}

export interface ReportCompletionStat {
  blockId: string
  label: string
  parentLabel?: string
  required: boolean
  answered: number
  rate: number
}

export interface ReportStats {
  range: { from: string | null; to: string; label: string }
  totals: {
    inPeriod: number
    allTime: number
    previousPeriod: number | null
    deltaPercent: number | null
    perDay: number
    activeDays: number
    spanDays: number
    bestDay: { label: string; count: number } | null
    firstAt: string | null
    lastAt: string | null
    averageFillRate: number
    questionCount: number
  }
  timeline: { label: string; count: number }[]
  timelineGranularity: 'day' | 'week' | 'month'
  choices: ReportChoiceStat[]
  numerics: ReportNumericStat[]
  freeform: ReportFreeformStat[]
  completion: ReportCompletionStat[]
  tableHeaders: string[]
  tableRows: string[][]
}

const CHOICE_TYPES = ['dropdown', 'multiple-choice', 'image-selection']
const NUMERIC_TYPES = ['number', 'slider']
const FREEFORM_TYPES = [
  'short-text',
  'long-text',
  'email',
  'phone',
  'website',
  'address',
  'date',
  'advanced-date',
  'time',
]
const NON_QUESTION_TYPES = ['welcome-screen', 'thankyou-screen', 'statement']

// Garde-fou du mode « toutes les réponses libres » : au-delà, le PDF pèserait des centaines de
// pages pour une seule question. Le rapport indique alors combien de valeurs sont affichées sur
// le total, plutôt que de laisser croire qu'il est exhaustif.
const MAX_ALL_SAMPLES = 1000

// ── Période ────────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function parseDateOnly(value: string | undefined, end: boolean): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return end ? endOfDay(parsed) : startOfDay(parsed)
}

function formatDay(date: Date): string {
  return format(date, 'dd/MM/yyyy', { locale: fr })
}

/**
 * Traduit les réglages de période en bornes concrètes.
 *
 * La date de clôture, si elle est renseignée, plafonne toujours la borne haute : passée cette
 * date, tous les rapports décrivent le même corpus figé plutôt que de s'étendre indéfiniment.
 */
export function resolveReportRange(
  settings: Pick<FormReportSettings, 'period' | 'closingDate'>,
  context: { now?: Date; lastReportAt?: string | null; formCreatedAt?: Date | string | null } = {}
): ReportRange {
  const now = context.now ?? new Date()
  const period = settings.period
  const closing = parseDateOnly(settings.closingDate, true)

  let from: Date | null = null
  let to: Date = now

  switch (period.mode) {
    case 'last_days': {
      const days = period.days && period.days > 0 ? period.days : 7
      from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      break
    }
    case 'current_month': {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      break
    }
    case 'previous_month': {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
      to = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
      to.setMilliseconds(-1)
      break
    }
    case 'since_last_report': {
      const last = context.lastReportAt ? new Date(context.lastReportAt) : null
      from = last && !Number.isNaN(last.getTime()) ? last : null
      if (!from && context.formCreatedAt) {
        const created = new Date(context.formCreatedAt)
        from = Number.isNaN(created.getTime()) ? null : created
      }
      break
    }
    case 'custom': {
      from = parseDateOnly(period.from, false)
      const customTo = parseDateOnly(period.to, true)
      if (customTo) to = customTo
      break
    }
    case 'all':
    default:
      from = null
  }

  if (closing && closing.getTime() < to.getTime()) to = closing
  if (from && from.getTime() > to.getTime()) from = to

  const label = from
    ? `du ${formatDay(from)} au ${formatDay(to)}`
    : `jusqu'au ${formatDay(to)}`

  return { from, to, label }
}

// ── Extraction des questions ───────────────────────────────────────────────

interface QuestionField {
  blockId: string
  block: ReportBlockInput
  label: string
  parentLabel?: string
  repeaterId?: string
}

export function collectQuestionFields(blocks: ReportBlockInput[]): QuestionField[] {
  const fields: QuestionField[] = []

  for (const block of blocks || []) {
    if (NON_QUESTION_TYPES.includes(block.type)) continue

    if (block.type === 'group' || block.type === 'repeater') {
      const parentLabel = block.attributes?.label || block.id
      for (const inner of block.innerBlocks || []) {
        if (NON_QUESTION_TYPES.includes(inner.type)) continue
        fields.push({
          blockId: inner.id,
          block: inner,
          label: inner.attributes?.label || inner.id,
          parentLabel,
          ...(block.type === 'repeater' && { repeaterId: block.id }),
        })
      }
      continue
    }

    fields.push({
      blockId: block.id,
      block,
      label: block.attributes?.label || block.id,
    })
  }

  return fields
}

// Un champ de répéteur est stocké sous {repeaterId}_{n}_{innerId} : toutes les itérations sont
// agrégées, un même matériel demandé trois fois comptant bien pour trois.
const MAX_REPETITIONS = 100

function collectValues(field: QuestionField, data: Record<string, any>): any[] {
  if (!field.repeaterId) {
    const value = data[field.blockId]
    return value === undefined ? [] : [value]
  }

  const values: any[] = []
  for (let n = 1; n <= MAX_REPETITIONS; n++) {
    const value = data[`${field.repeaterId}_${n}_${field.blockId}`]
    if (value !== undefined) values.push(value)
  }
  return values
}

function isFilled(value: any): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

// ── Normalisation des choix ────────────────────────────────────────────────

function optionLabels(block: ReportBlockInput): { label: string; keys: string[] }[] {
  if (block.type === 'yes-no') {
    return [
      { label: block.attributes?.yesLabel || 'Oui', keys: ['yes', 'oui', 'true', '1'] },
      { label: block.attributes?.noLabel || 'Non', keys: ['no', 'non', 'false', '0'] },
    ].map((o) => ({
      label: o.label,
      keys: Array.from(new Set([...o.keys, o.label.toLowerCase()])),
    }))
  }

  if (block.type === 'legal') {
    return [
      { label: 'Accepté', keys: ['true', 'oui', 'yes', '1', 'accepté'] },
      { label: 'Non accepté', keys: ['false', 'non', 'no', '0'] },
    ]
  }

  const choices: any[] = block.attributes?.choices || []
  return choices.map((choice) => ({
    label: String(choice.label ?? choice.value ?? ''),
    keys: [choice.value, choice.id, choice.label]
      .filter((v) => v !== undefined && v !== null && v !== '')
      .map((v) => String(v).trim().toLowerCase()),
  }))
}

/**
 * Découpe une valeur enregistrée en jetons comparables.
 *
 * Une réponse à choix multiples peut arriver sous trois formes : tableau de slugs (réponses
 * anciennes), chaîne « A, B » produite par resolveDataLabels, ou valeur unique.
 *
 * Le découpage sur la virgule est ambigu dès qu'un libellé en contient (« Écran, second ») :
 * les fragments consécutifs sont donc recollés tant qu'ils reconstituent une option connue,
 * en privilégiant la correspondance la plus longue. Sans cela, une seule option cochée serait
 * comptée comme deux options inexistantes.
 */
function tokenize(value: any, options: { label: string; keys: string[] }[]): string[] {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) return value.flatMap((v) => tokenize(v, options))
  if (typeof value === 'object') return Object.keys(value).map((k) => k.replace(/^__other__:/, ''))

  const raw = String(value).trim()
  if (!raw) return []

  const isKnown = (candidate: string) => options.some((o) => o.keys.includes(candidate.toLowerCase()))
  if (isKnown(raw) || !raw.includes(',')) return [raw]

  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean)
  const tokens: string[] = []
  let index = 0

  while (index < parts.length) {
    let matched = false
    for (let end = parts.length; end > index; end--) {
      const candidate = parts.slice(index, end).join(', ')
      if (isKnown(candidate)) {
        tokens.push(candidate)
        index = end
        matched = true
        break
      }
    }
    if (!matched) {
      tokens.push(parts[index])
      index++
    }
  }

  return tokens
}

function matchOption(token: string, options: { label: string; keys: string[] }[]): string {
  const clean = token.replace(/^__other__:/, '').trim()
  const low = clean.toLowerCase()
  const found = options.find((o) => o.keys.includes(low))
  if (found) return found.label
  return token.startsWith('__other__:') ? `Autre : ${clean}` : clean
}

// Rendu lisible d'une valeur pour le tableau des réponses : les questions à choix repassent
// par les options du bloc, sinon une réponse ancienne afficherait son slug (« technique ») et
// un Oui/Non son code interne (« yes »).
function displayValue(block: ReportBlockInput, value: any): string {
  const type = block.type
  if (CHOICE_TYPES.includes(type) || type === 'yes-no' || type === 'legal') {
    const options = optionLabels(block)
    const tokens = tokenize(value, options)
    if (tokens.length > 0) return tokens.map((token) => matchOption(token, options)).join(', ')
  }
  return toText(value)
}

function toText(value: any): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(', ')
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => `${k.replace(/^__other__:/, '')} : ${toText(v)}`)
      .join(', ')
  }
  return String(value).replace(/^__other__:/, '')
}

// ── Calcul principal ───────────────────────────────────────────────────────

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

// Au-delà d'une douzaine de valeurs, une répartition ligne à ligne n'apporte plus rien : une
// note va de 1 à 5 ou de 0 à 10, un montant libre n'a pas d'échelle du tout.
const MAX_SCALE_SPAN = 10

/**
 * Détermine si une question numérique se lit comme une note sur une échelle.
 *
 * `declared` distingue les bornes posées sur la question (curseur de 1 à 5) des bornes
 * simplement observées dans les réponses : seules les premières justifient d'afficher
 * « 4,2 / 5 », sans quoi une question de montant afficherait « 1 250 / 1 800 » selon le plus
 * gros montant reçu, ce qui ne veut rien dire.
 */
function resolveScale(
  block: ReportBlockInput,
  sorted: number[]
): {
  declared: boolean
  low: number
  high: number
  distribution?: { value: number; count: number; percent: number }[]
} {
  const attrMin = Number(block.attributes?.min)
  const attrMax = Number(block.attributes?.max)
  const declared = Number.isFinite(attrMin) && Number.isFinite(attrMax) && attrMax > attrMin

  const observedMin = sorted[0]
  const observedMax = sorted[sorted.length - 1]
  // Une réponse enregistrée avant un resserrement des bornes peut sortir de l'échelle : elle
  // élargit la répartition plutôt que d'en disparaître, sinon les pourcentages ne feraient
  // plus 100 %.
  const low = declared ? Math.min(attrMin, observedMin) : observedMin
  const high = declared ? Math.max(attrMax, observedMax) : observedMax

  const span = high - low
  const chartable =
    Number.isInteger(low) &&
    Number.isInteger(high) &&
    span >= 1 &&
    span <= MAX_SCALE_SPAN &&
    sorted.every((n) => Number.isInteger(n))

  if (!chartable) return { declared, low, high }

  const counts = new Map<number, number>()
  for (let value = low; value <= high; value++) counts.set(value, 0)
  for (const n of sorted) counts.set(n, (counts.get(n) ?? 0) + 1)

  return {
    declared,
    low,
    high,
    distribution: Array.from(counts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([value, count]) => ({ value, count, percent: round((count / sorted.length) * 100) })),
  }
}

function inRange(date: Date, range: ReportRange): boolean {
  if (range.from && date.getTime() < range.from.getTime()) return false
  return date.getTime() <= range.to.getTime()
}

function bucketKey(date: Date, granularity: 'day' | 'week' | 'month'): string {
  if (granularity === 'month') return format(date, 'MM/yyyy', { locale: fr })
  if (granularity === 'week') {
    const monday = new Date(date)
    // getDay() : 0 = dimanche — ramené au lundi de la semaine courante
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    return `sem. ${format(monday, 'dd/MM', { locale: fr })}`
  }
  return format(date, 'dd/MM', { locale: fr })
}

export function computeReportStats(
  blocks: ReportBlockInput[],
  responses: ReportResponseInput[],
  settings: FormReportSettings,
  range: ReportRange
): ReportStats {
  const dated = responses
    .map((r) => ({ ...r, at: new Date(r.createdAt) }))
    .filter((r) => !Number.isNaN(r.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime())

  const selected = dated.filter((r) => inRange(r.at, range))

  // Période équivalente précédente, pour la variation en pourcentage
  let previousPeriod: number | null = null
  if (range.from) {
    const span = range.to.getTime() - range.from.getTime()
    const previousFrom = new Date(range.from.getTime() - span)
    previousPeriod = dated.filter(
      (r) => r.at.getTime() >= previousFrom.getTime() && r.at.getTime() < range.from!.getTime()
    ).length
  }

  const fields = collectQuestionFields(blocks)

  // ── Chronologie ──────────────────────────────────────────────────────────
  const spanStart = range.from ?? (selected[0]?.at ?? range.to)
  const spanDays = Math.max(
    1,
    Math.ceil((range.to.getTime() - spanStart.getTime()) / (24 * 60 * 60 * 1000))
  )
  const granularity: 'day' | 'week' | 'month' =
    spanDays <= 62 ? 'day' : spanDays <= 400 ? 'week' : 'month'

  const buckets = new Map<string, number>()
  const dayCounts = new Map<string, number>()
  for (const r of selected) {
    const key = bucketKey(r.at, granularity)
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
    const dayKey = format(r.at, 'dd/MM/yyyy', { locale: fr })
    dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1)
  }

  let bestDay: { label: string; count: number } | null = null
  for (const [label, count] of Array.from(dayCounts.entries())) {
    if (!bestDay || count > bestDay.count) bestDay = { label, count }
  }

  // ── Par question ─────────────────────────────────────────────────────────
  const choices: ReportChoiceStat[] = []
  const numerics: ReportNumericStat[] = []
  const freeform: ReportFreeformStat[] = []
  const completion: ReportCompletionStat[] = []
  let fillRateSum = 0

  for (const field of fields) {
    const type = field.block.type
    const perResponse = selected.map((r) => collectValues(field, r.data))
    const answeredResponses = perResponse.filter((values) => values.some(isFilled)).length
    const flatValues = perResponse.flat().filter(isFilled)

    completion.push({
      blockId: field.blockId,
      label: field.label,
      ...(field.parentLabel && { parentLabel: field.parentLabel }),
      required: Boolean(field.block.attributes?.required),
      answered: answeredResponses,
      rate: selected.length > 0 ? round((answeredResponses / selected.length) * 100) : 0,
    })
    fillRateSum += selected.length > 0 ? answeredResponses / selected.length : 0

    if (type === 'file' || type === 'signature') continue

    if (CHOICE_TYPES.includes(type) || type === 'yes-no' || type === 'legal') {
      const options = optionLabels(field.block)
      const counts = new Map<string, number>()
      if (settings.includeEmptyChoices) {
        for (const option of options) counts.set(option.label, 0)
      }

      for (const value of flatValues) {
        for (const token of tokenize(value, options)) {
          const label = matchOption(token, options)
          counts.set(label, (counts.get(label) ?? 0) + 1)
        }
      }

      const entries = Array.from(counts.entries())
        .map(([label, count]) => ({
          label,
          count,
          percent: answeredResponses > 0 ? round((count / answeredResponses) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

      if (entries.length > 0) {
        choices.push({
          blockId: field.blockId,
          label: field.label,
          ...(field.parentLabel && { parentLabel: field.parentLabel }),
          type,
          multi: type === 'multiple-choice' && field.block.attributes?.multiple !== false,
          answered: answeredResponses,
          options: entries,
        })
      }
      continue
    }

    if (type === 'quantity') {
      // Les quantités se lisent comme une répartition, mais cumulée : on additionne les
      // quantités demandées par option au lieu de compter les réponses.
      const totals = new Map<string, number>()
      for (const value of flatValues) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          for (const [key, qty] of Object.entries(value)) {
            const label = String(key).replace(/^__other__:/, '')
            const amount = Number(qty)
            if (Number.isFinite(amount)) totals.set(label, (totals.get(label) ?? 0) + amount)
          }
        }
      }
      const entries = Array.from(totals.entries())
        .map(([label, count]) => ({ label, count, percent: 0 }))
        .sort((a, b) => b.count - a.count)
      const sum = entries.reduce((acc, e) => acc + e.count, 0)
      for (const entry of entries) entry.percent = sum > 0 ? round((entry.count / sum) * 100) : 0

      if (entries.length > 0) {
        choices.push({
          blockId: field.blockId,
          label: field.label,
          ...(field.parentLabel && { parentLabel: field.parentLabel }),
          type,
          multi: true,
          unit: 'quantité cumulée',
          answered: answeredResponses,
          options: entries,
        })
      }
      continue
    }

    if (NUMERIC_TYPES.includes(type)) {
      const numbers = flatValues
        .map((v) => Number(String(v).replace(',', '.')))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b)

      if (numbers.length > 0) {
        const sum = numbers.reduce((acc, n) => acc + n, 0)
        const scale = resolveScale(field.block, numbers)
        numerics.push({
          blockId: field.blockId,
          label: field.label,
          ...(field.parentLabel && { parentLabel: field.parentLabel }),
          count: numbers.length,
          min: numbers[0],
          max: numbers[numbers.length - 1],
          average: round(sum / numbers.length, 2),
          median: round(median(numbers), 2),
          sum: round(sum, 2),
          ...(scale.declared && { scaleMin: scale.low, scaleMax: scale.high }),
          ...(scale.distribution && { distribution: scale.distribution }),
        })
      }
      continue
    }

    if (FREEFORM_TYPES.includes(type)) {
      const texts = flatValues.map(toText).filter((t) => t.trim() !== '')
      const counts = new Map<string, number>()
      for (const text of texts) counts.set(text, (counts.get(text) ?? 0) + 1)

      // Seules les valeurs qui se répètent apportent une information : sur du texte libre,
      // un classement de valeurs uniques n'est qu'une liste dans un ordre arbitraire.
      const top = Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // De la plus récente à la plus ancienne : sur un verbatim, c'est le dernier reçu qui
      // intéresse en premier.
      const ordered = texts.slice().reverse()
      // En mode « toutes les réponses », les doublons sont conservés : deux répondants ayant
      // écrit la même chose sont deux réponses, alors qu'un échantillon cherche à montrer des
      // formulations différentes.
      const samples = settings.showAllTextAnswers
        ? ordered.slice(0, MAX_ALL_SAMPLES)
        : settings.textSampleSize > 0
          ? Array.from(new Set(ordered)).slice(0, settings.textSampleSize)
          : []

      if (texts.length > 0) {
        freeform.push({
          blockId: field.blockId,
          label: field.label,
          ...(field.parentLabel && { parentLabel: field.parentLabel }),
          answered: answeredResponses,
          total: texts.length,
          top,
          samples,
        })
      }
    }
  }

  // ── Tableau des dernières réponses ───────────────────────────────────────
  const tableFields = fields.filter((f) => !f.repeaterId).slice(0, 5)
  const tableHeaders = ['Date', ...tableFields.map((f) => f.label)]
  const tableRows = selected
    .slice()
    .reverse()
    .slice(0, settings.tableRowLimit)
    .map((r) => [
      format(r.at, 'dd/MM/yyyy HH:mm', { locale: fr }),
      ...tableFields.map((f) => displayValue(f.block, collectValues(f, r.data)[0])),
    ])

  const deltaPercent =
    previousPeriod !== null && previousPeriod > 0
      ? round(((selected.length - previousPeriod) / previousPeriod) * 100)
      : previousPeriod === 0 && selected.length > 0
        ? 100
        : null

  return {
    range: {
      from: range.from ? range.from.toISOString() : null,
      to: range.to.toISOString(),
      label: range.label,
    },
    totals: {
      inPeriod: selected.length,
      allTime: dated.length,
      previousPeriod,
      deltaPercent,
      perDay: round(selected.length / spanDays, 2),
      activeDays: dayCounts.size,
      spanDays,
      bestDay,
      firstAt: selected[0]?.at.toISOString() ?? null,
      lastAt: selected[selected.length - 1]?.at.toISOString() ?? null,
      averageFillRate: fields.length > 0 ? round((fillRateSum / fields.length) * 100) : 0,
      questionCount: fields.length,
    },
    timeline: Array.from(buckets.entries()).map(([label, count]) => ({ label, count })),
    timelineGranularity: granularity,
    choices,
    numerics,
    freeform,
    completion,
    tableHeaders,
    tableRows,
  }
}

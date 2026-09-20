// Périodes choisies à la main : celles de l'export des réponses et de la page de statistiques,
// par opposition à la période d'un rapport planifié.
//
// Les modes sont ceux des rapports — resolveReportRange() les traduit en bornes concrètes —
// plutôt qu'une arithmétique de dates parallèle. `since_last_report` en est exclu : il n'a de
// sens qu'adossé à un envoi précédent, notion qu'une consultation manuelle n'a pas.
//
// Volontairement pur (aucun import Prisma) : le sélecteur de période l'importe côté client
// pour ses libellés, la route d'export côté serveur pour valider ce qu'elle reçoit.

import type { ReportPeriod, ReportPeriodMode } from '@/types/form'

export const MANUAL_PERIOD_OPTIONS: { value: ReportPeriodMode; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'last_days', label: 'N derniers jours' },
  { value: 'current_month', label: 'Mois en cours' },
  { value: 'previous_month', label: 'Mois précédent' },
  { value: 'custom', label: 'Plage de dates' },
]

const MANUAL_PERIOD_MODES = MANUAL_PERIOD_OPTIONS.map((option) => option.value)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DAYS = 3650

export const DEFAULT_MANUAL_PERIOD: ReportPeriod = { mode: 'all', days: 7 }

export function parseManualPeriod(raw: any): ReportPeriod {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MANUAL_PERIOD }

  const mode: ReportPeriodMode = MANUAL_PERIOD_MODES.includes(raw.mode) ? raw.mode : 'all'
  const days = Math.trunc(Number(raw.days))

  return {
    mode,
    days: Number.isFinite(days) && days > 0 ? Math.min(days, MAX_DAYS) : 7,
    ...(typeof raw.from === 'string' && DATE_RE.test(raw.from) && { from: raw.from }),
    ...(typeof raw.to === 'string' && DATE_RE.test(raw.to) && { to: raw.to }),
  }
}

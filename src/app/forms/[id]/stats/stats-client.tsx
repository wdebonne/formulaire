'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PeriodPicker } from '@/components/forms/period-picker'
import { DEFAULT_MANUAL_PERIOD } from '@/lib/manual-period'
import { DEFAULT_REPORT_SETTINGS } from '@/lib/report-settings'
import {
  computeReportStats,
  resolveReportRange,
  type ReportBlockInput,
  type ReportChoiceStat,
  type ReportCompletionStat,
  type ReportFreeformStat,
  type ReportNumericStat,
  type ReportResponseInput,
} from '@/lib/report-stats'
import type { FormReportSettings, ReportPeriod } from '@/types/form'
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  FileSpreadsheet,
  Gauge,
  Hash,
  ListChecks,
  MessageSquareText,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

interface StatsClientProps {
  form: {
    id: string
    title: string
    blocks: ReportBlockInput[]
    createdAt: string | Date
  }
  responses: ReportResponseInput[]
  closingDate?: string
}

// Nombre de verbatims repris par question libre : assez pour saisir le ton des réponses, pas
// au point de transformer la page en liste de lecture — l'exhaustivité est le rôle du PDF.
const SCREEN_TEXT_SAMPLES = 6

export function StatsClient({ form, responses, closingDate }: StatsClientProps) {
  const [period, setPeriod] = useState<ReportPeriod>({ ...DEFAULT_MANUAL_PERIOD })

  // Mêmes réglages et même fonction que le rapport PDF : seule la période vient de l'écran.
  const { range, stats } = useMemo(() => {
    const settings: FormReportSettings = {
      ...DEFAULT_REPORT_SETTINGS,
      period,
      closingDate,
      includeEmptyChoices: true,
      textSampleSize: SCREEN_TEXT_SAMPLES,
      showAllTextAnswers: false,
    }
    const resolved = resolveReportRange(settings, { formCreatedAt: form.createdAt })
    return { range: resolved, stats: computeReportStats(form.blocks, responses, settings, resolved) }
  }, [period, closingDate, form.blocks, form.createdAt, responses])

  const { totals } = stats
  const granularity =
    stats.timelineGranularity === 'month'
      ? 'par mois'
      : stats.timelineGranularity === 'week'
        ? 'par semaine'
        : 'par jour'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="sticky top-0 z-10 border-b border-gray-200/50 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4">
            <Link href={`/forms/${form.id}/responses`}>
              <Button variant="ghost" size="sm" className="hover:bg-purple-50">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Réponses
              </Button>
            </Link>
            <div className="h-8 w-px bg-gray-200" />
            <div>
              <h1 className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-xl font-bold text-transparent">
                {form.title || 'Sans titre'}
              </h1>
              <p className="text-sm text-gray-500">Statistiques — {range.label}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-sm text-gray-500 sm:flex">
            <BarChart3 className="h-4 w-4 text-violet-500" />
            {totals.questionCount} question{totals.questionCount > 1 ? 's' : ''}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-gray-900">Période analysée</h2>
            <p className="text-sm text-gray-500">
              {totals.inPeriod} réponse{totals.inPeriod > 1 ? 's' : ''} sur {totals.allTime}
            </p>
          </div>
          <PeriodPicker period={period} onChange={setPeriod} />
        </section>

        {responses.length === 0 ? (
          <EmptyState
            title="Aucune réponse pour le moment"
            message="Les statistiques apparaîtront dès la première réponse reçue."
            formId={form.id}
          />
        ) : totals.inPeriod === 0 ? (
          <EmptyState
            title="Aucune réponse sur cette période"
            message={`Ce formulaire a reçu ${totals.allTime} réponse(s) au total : élargissez la période pour les voir.`}
            formId={form.id}
          />
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                icon={FileSpreadsheet}
                label="Réponses sur la période"
                value={String(totals.inPeriod)}
                hint={`${totals.allTime} depuis la création`}
                delta={totals.deltaPercent}
                deltaHint={
                  totals.previousPeriod !== null
                    ? `${totals.previousPeriod} sur la période précédente`
                    : undefined
                }
              />
              <StatTile
                icon={CalendarDays}
                label="Moyenne par jour"
                value={formatNumber(totals.perDay)}
                hint={`${totals.activeDays} jour(s) avec au moins une réponse sur ${totals.spanDays}`}
              />
              <StatTile
                icon={Gauge}
                label="Taux de remplissage moyen"
                value={`${formatNumber(totals.averageFillRate)} %`}
                hint="Part des questions renseignées, toutes réponses confondues"
              />
              <StatTile
                icon={TrendingUp}
                label="Journée la plus active"
                value={totals.bestDay ? totals.bestDay.label : '—'}
                hint={
                  totals.bestDay
                    ? `${totals.bestDay.count} réponse(s) ce jour-là`
                    : 'Aucune journée ne se détache'
                }
              />
            </section>

            {stats.timeline.length > 0 && (
              <SectionCard
                icon={BarChart3}
                title="Évolution dans le temps"
                subtitle={`Nombre de réponses ${granularity}`}
              >
                <Timeline points={stats.timeline} />
              </SectionCard>
            )}

            {stats.choices.length > 0 && (
              <SectionCard
                icon={ListChecks}
                title="Répartition des choix"
                subtitle="Pourcentages calculés sur les réponses ayant répondu à la question"
              >
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  {stats.choices.map((choice) => (
                    <ChoiceBlock key={choice.blockId} choice={choice} />
                  ))}
                </div>
              </SectionCard>
            )}

            {stats.numerics.length > 0 && (
              <SectionCard
                icon={Hash}
                title="Notes et valeurs numériques"
                subtitle="Moyenne, médiane et répartition des valeurs saisies"
              >
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  {stats.numerics.map((numeric) => (
                    <NumericBlock key={numeric.blockId} numeric={numeric} />
                  ))}
                </div>
              </SectionCard>
            )}

            {stats.completion.length > 0 && (
              <SectionCard
                icon={Gauge}
                title="Taux de remplissage par question"
                subtitle="Une question souvent laissée vide est une question à revoir"
              >
                <div className="space-y-3">
                  {stats.completion.map((item) => (
                    <CompletionRow key={item.blockId} item={item} />
                  ))}
                </div>
              </SectionCard>
            )}

            {stats.freeform.length > 0 && (
              <SectionCard
                icon={MessageSquareText}
                title="Réponses libres"
                subtitle={`Valeurs récurrentes et ${SCREEN_TEXT_SAMPLES} derniers verbatims par question`}
              >
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  {stats.freeform.map((item) => (
                    <FreeformBlock key={item.blockId} item={item} />
                  ))}
                </div>
              </SectionCard>
            )}
          </>
        )}
      </main>
    </div>
  )
}

// ── Briques d'affichage ────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  deltaHint,
}: {
  icon: any
  label: string
  value: string
  hint?: string
  delta?: number | null
  deltaHint?: string
}) {
  const positive = typeof delta === 'number' && delta > 0
  const negative = typeof delta === 'number' && delta < 0
  const DeltaIcon = positive ? TrendingUp : TrendingDown

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <Icon className="h-5 w-5 shrink-0 text-gray-300" />
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {(positive || negative) && (
        <p
          className={`mt-1 inline-flex items-center gap-1 text-sm font-medium ${
            positive ? 'text-emerald-700' : 'text-red-700'
          }`}
          title={deltaHint}
        >
          <DeltaIcon className="h-4 w-4" />
          {positive ? '+' : ''}
          {formatNumber(delta as number)} % vs période précédente
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: any
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
          <Icon className="h-5 w-5 text-indigo-600" />
        </span>
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

const TIMELINE_HEIGHT = 160
// Hauteur des barres + les deux lignes de texte qui les encadrent : sans cette réserve, la
// valeur de la barre la plus haute est rognée par le débordement du conteneur.
const TIMELINE_LABELS_HEIGHT = 48

function Timeline({ points }: { points: { label: string; count: number }[] }) {
  const max = Math.max(...points.map((point) => point.count), 1)

  return (
    <div className="overflow-x-auto pb-1">
      <div
        className="flex min-w-full items-end gap-2"
        style={{ height: TIMELINE_HEIGHT + TIMELINE_LABELS_HEIGHT }}
      >
        {points.map((point) => (
          <div
            key={point.label}
            className="flex min-w-[32px] flex-1 flex-col items-center justify-end gap-1"
            title={`${point.label} — ${point.count} réponse(s)`}
          >
            <span className="text-xs font-medium text-gray-600">{point.count}</span>
            <div
              className="w-full rounded-t-md bg-indigo-500"
              style={{ height: Math.max(3, (point.count / max) * TIMELINE_HEIGHT) }}
            />
            <span className="whitespace-nowrap text-[10px] text-gray-400">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Une barre par option, toujours de la même couleur : la teinte désigne la mesure, jamais le
// rang — repeindre la première option ferait lire un classement là où il n'y a qu'un compte.
function Bar({
  label,
  value,
  ratio,
  suffix,
}: {
  label: string
  value: string
  ratio: number
  suffix?: string
}) {
  return (
    <div className="space-y-1" title={`${label} — ${value}${suffix ? ` ${suffix}` : ''}`}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-gray-700">{label}</span>
        <span className="shrink-0 font-medium text-gray-900">
          {value}
          {suffix && <span className="ml-1 font-normal text-gray-400">{suffix}</span>}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-indigo-500"
          style={{ width: `${Math.min(100, Math.max(ratio > 0 ? 1.5 : 0, ratio * 100))}%` }}
        />
      </div>
    </div>
  )
}

function ChoiceBlock({ choice }: { choice: ReportChoiceStat }) {
  const max = Math.max(...choice.options.map((option) => option.count), 1)

  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <QuestionHeading label={choice.label} parentLabel={choice.parentLabel} />
      <p className="mb-3 text-xs text-gray-500">
        {choice.answered} réponse(s){choice.multi && ' — plusieurs choix possibles'}
        {choice.unit && ` — ${choice.unit}`}
      </p>
      <div className="space-y-3">
        {choice.options.map((option) => (
          <Bar
            key={option.label}
            label={option.label}
            value={String(option.count)}
            ratio={option.count / max}
            suffix={`(${formatNumber(option.percent)} %)`}
          />
        ))}
      </div>
    </div>
  )
}

function NumericBlock({ numeric }: { numeric: ReportNumericStat }) {
  const scale = numeric.scaleMax !== undefined ? ` / ${numeric.scaleMax}` : ''
  const max = Math.max(...(numeric.distribution ?? []).map((entry) => entry.count), 1)

  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <QuestionHeading label={numeric.label} parentLabel={numeric.parentLabel} />
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900">{formatNumber(numeric.average, 2)}</span>
        <span className="text-sm text-gray-500">
          {scale ? `sur ${numeric.scaleMax}` : 'de moyenne'} — {numeric.count} réponse(s)
        </span>
      </div>
      <dl className="mb-3 grid grid-cols-3 gap-2 text-sm">
        <MiniStat label="Médiane" value={formatNumber(numeric.median, 2)} />
        <MiniStat label="Minimum" value={formatNumber(numeric.min, 2)} />
        <MiniStat label="Maximum" value={formatNumber(numeric.max, 2)} />
      </dl>
      {numeric.distribution && (
        <div className="space-y-2">
          {numeric.distribution.map((entry) => (
            <Bar
              key={entry.value}
              label={String(entry.value)}
              value={String(entry.count)}
              ratio={entry.count / max}
              suffix={`(${formatNumber(entry.percent)} %)`}
            />
          ))}
        </div>
      )}
      {!numeric.distribution && numeric.scaleMax === undefined && (
        <p className="text-xs text-gray-500">Cumul des valeurs saisies : {formatNumber(numeric.sum, 2)}</p>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  )
}

const LOW_COMPLETION_RATE = 50

function CompletionRow({ item }: { item: ReportCompletionStat }) {
  const low = item.rate < LOW_COMPLETION_RATE

  return (
    <div className="space-y-1" title={`${item.label} — ${item.answered} réponse(s)`}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-gray-700">
          {item.parentLabel && <span className="text-gray-400">{item.parentLabel} › </span>}
          {item.label}
          {item.required && (
            <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500">
              obligatoire
            </span>
          )}
        </span>
        <span className={`shrink-0 font-medium ${low ? 'text-amber-700' : 'text-gray-900'}`}>
          {formatNumber(item.rate)} %
          <span className="ml-1 font-normal text-gray-400">({item.answered})</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-indigo-500"
          style={{ width: `${Math.min(100, Math.max(item.rate > 0 ? 1.5 : 0, item.rate))}%` }}
        />
      </div>
    </div>
  )
}

function FreeformBlock({ item }: { item: ReportFreeformStat }) {
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <QuestionHeading label={item.label} parentLabel={item.parentLabel} />
      <p className="mb-3 text-xs text-gray-500">
        {item.answered} réponse(s) — {item.total} valeur(s) saisie(s)
      </p>

      {item.top.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {item.top.map((entry) => (
            <span
              key={entry.value}
              className="max-w-full truncate rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-800"
              title={entry.value}
            >
              {entry.value} · {entry.count}×
            </span>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {item.samples.map((sample, index) => (
          <li
            key={`${item.blockId}-${index}`}
            className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"
          >
            {sample}
          </li>
        ))}
      </ul>
    </div>
  )
}

function QuestionHeading({ label, parentLabel }: { label: string; parentLabel?: string }) {
  return (
    <h3 className="font-medium text-gray-900">
      {parentLabel && <span className="text-sm font-normal text-gray-400">{parentLabel} › </span>}
      {label}
    </h3>
  )
}

function EmptyState({
  title,
  message,
  formId,
}: {
  title: string
  message: string
  formId: string
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-16 text-center shadow-sm">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100">
        <BarChart3 className="h-10 w-10 text-blue-500" />
      </div>
      <h2 className="mb-3 text-xl font-semibold text-gray-900">{title}</h2>
      <p className="mx-auto mb-8 max-w-md text-gray-500">{message}</p>
      <Link href={`/forms/${formId}/responses`}>
        <Button variant="outline">Retour aux réponses</Button>
      </Link>
    </div>
  )
}

// Les entiers restent entiers : « 12 » plutôt que « 12,0 ».
function formatNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return Number.isInteger(value)
    ? String(value)
    : value.toLocaleString('fr-FR', { maximumFractionDigits: digits })
}

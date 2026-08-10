'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  DEFAULT_REPORT_SETTINGS,
  describeSchedule,
  nextOccurrence,
  parseFormReportSettings,
} from '@/lib/report-settings'
import {
  computeReportStats,
  resolveReportRange,
  type ReportBlockInput,
  type ReportResponseInput,
} from '@/lib/report-stats'
import type {
  FormReportSettings,
  ReportFrequency,
  ReportPeriodMode,
  ReportSections,
} from '@/types/form'
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Download,
  Loader2,
  ListChecks,
  Mail,
  MinusCircle,
  Plus,
  Send,
  X,
  XCircle,
} from 'lucide-react'

interface ReportModalProps {
  formId: string
  formTitle: string
  blocks: ReportBlockInput[]
  responses: ReportResponseInput[]
  formCreatedAt?: string | Date
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PERIOD_OPTIONS: { value: ReportPeriodMode; label: string; hint: string }[] = [
  { value: 'last_days', label: 'N derniers jours', hint: 'Fenêtre glissante — idéale pour un envoi récurrent' },
  { value: 'current_month', label: 'Mois en cours', hint: 'Du 1er du mois à aujourd’hui' },
  { value: 'previous_month', label: 'Mois précédent', hint: 'Mois civil complet, figé' },
  { value: 'since_last_report', label: 'Depuis le dernier rapport', hint: 'Aucune réponse comptée deux fois' },
  { value: 'custom', label: 'Plage de dates fixe', hint: 'Deux dates choisies, corpus figé' },
  { value: 'all', label: 'Depuis la création', hint: 'Toutes les réponses du formulaire' },
]

const SECTION_OPTIONS: { key: keyof ReportSections; label: string; hint: string }[] = [
  { key: 'summary', label: 'Indicateurs clés', hint: 'Total, moyenne par jour, évolution, journée la plus active' },
  { key: 'timeline', label: 'Évolution dans le temps', hint: 'Histogramme par jour, semaine ou mois selon la période' },
  { key: 'choiceBreakdown', label: 'Répartition des choix', hint: 'Barres et pourcentages par option, y compris Oui/Non et quantités' },
  { key: 'numericStats', label: 'Notes et valeurs numériques', hint: 'Moyenne sur l’échelle, répartition des notes, min et max' },
  { key: 'textAnswers', label: 'Réponses libres', hint: 'Valeurs récurrentes puis derniers verbatims' },
  { key: 'completion', label: 'Taux de remplissage', hint: 'Part des réponses ayant renseigné chaque question' },
  { key: 'responseTable', label: 'Tableau des dernières réponses', hint: 'Détail ligne à ligne — allonge nettement le PDF' },
]

const FREQUENCIES: { value: ReportFrequency; label: string }[] = [
  { value: 'daily', label: 'Chaque jour' },
  { value: 'weekly', label: 'Chaque semaine' },
  { value: 'monthly', label: 'Chaque mois' },
]

// Ordre français : lundi en premier, dimanche en dernier — Date.getDay() place pourtant
// dimanche à 0, d'où la valeur explicite portée par chaque bouton.
const WEEKDAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
  { value: 0, label: 'Dim' },
]

type Tab = 'period' | 'content' | 'delivery'

export function ReportModal({
  formId,
  formTitle,
  blocks,
  responses,
  formCreatedAt,
  open,
  onOpenChange,
}: ReportModalProps) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState<Tab>('period')
  const [smtpConfigured, setSmtpConfigured] = useState(true)
  const [settings, setSettings] = useState<FormReportSettings>(DEFAULT_REPORT_SETTINGS)
  const [recipientDraft, setRecipientDraft] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/forms/${formId}/report`)
      if (!res.ok) throw new Error('Chargement impossible')
      const data = await res.json()
      setSettings(parseFormReportSettings(JSON.stringify(data)))
      setSmtpConfigured(data.smtpConfigured !== false)
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [formId, toast])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const patch = (changes: Partial<FormReportSettings>) =>
    setSettings((prev) => ({ ...prev, ...changes }))

  // Aperçu calculé exactement comme le PDF : même fonction, mêmes réglages, sur les réponses
  // déjà chargées par la page. Ce que la modale annonce est donc ce que le PDF contiendra.
  const preview = useMemo(() => {
    const range = resolveReportRange(settings, {
      lastReportAt: settings.schedule.lastRunAt ?? settings.lastStatus?.sentAt ?? null,
      formCreatedAt: formCreatedAt ?? null,
    })
    return { range, stats: computeReportStats(blocks, responses, settings, range) }
  }, [settings, blocks, responses, formCreatedAt])

  const nextRun = useMemo(() => {
    if (!settings.schedule.enabled) return null
    return nextOccurrence(settings.schedule, new Date())
  }, [settings.schedule])

  const save = async (): Promise<FormReportSettings | null> => {
    setSaving(true)
    try {
      const res = await fetch(`/api/forms/${formId}/report`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Enregistrement impossible')
      const saved = parseFormReportSettings(JSON.stringify(data))
      setSettings(saved)
      return saved
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    const saved = await save()
    if (!saved) return
    toast({ title: 'Réglages du rapport enregistrés' })
    onOpenChange(false)
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/forms/${formId}/report/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Génération impossible')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Rapport - ${formTitle || 'formulaire'}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setDownloading(false)
    }
  }

  // L'envoi part des réglages en base : on enregistre d'abord pour que le rapport reçu
  // corresponde à ce qui est affiché à l'écran.
  const handleSendNow = async () => {
    if (settings.recipients.length === 0) {
      toast({
        title: 'Aucun destinataire',
        description: 'Ajoutez au moins une adresse dans l’onglet « Envoi ».',
        variant: 'destructive',
      })
      setTab('delivery')
      return
    }

    setSending(true)
    try {
      const saved = await save()
      if (!saved) return

      const res = await fetch(`/api/forms/${formId}/report/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Envoi impossible')

      const status = data.status
      setSettings((prev) => ({ ...prev, lastStatus: status }))

      if (status?.success) {
        toast({
          title: 'Rapport envoyé',
          description: `${status.responseCount ?? 0} réponse(s) — ${(status.recipients ?? []).join(', ')}`,
        })
      } else {
        toast({
          title: 'Échec de l’envoi',
          description: status?.error || 'Erreur inconnue',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const addRecipient = () => {
    const address = recipientDraft.trim()
    if (!EMAIL_RE.test(address)) {
      toast({ title: 'Adresse invalide', variant: 'destructive' })
      return
    }
    if (!settings.recipients.includes(address)) {
      patch({ recipients: [...settings.recipients, address] })
    }
    setRecipientDraft('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-600" />
            Rapports
          </DialogTitle>
          <DialogDescription>
            Une synthèse PDF des réponses — volumes, répartition des choix en pourcentage,
            verbatims — envoyée par e-mail à la fréquence de votre choix.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <PreviewBar
              periodLabel={preview.range.label}
              inPeriod={preview.stats.totals.inPeriod}
              allTime={preview.stats.totals.allTime}
              fillRate={preview.stats.totals.averageFillRate}
              nextRun={nextRun}
            />

            {!smtpConfigured && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Aucun serveur SMTP n’est configuré : le téléchargement du PDF fonctionne, mais
                  aucun envoi ne pourra aboutir tant que l’administration → SMTP n’est pas renseignée.
                </span>
              </div>
            )}

            <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
              <TabButton active={tab === 'period'} onClick={() => setTab('period')} icon={CalendarRange}>
                Période
              </TabButton>
              <TabButton active={tab === 'content'} onClick={() => setTab('content')} icon={ListChecks}>
                Contenu
              </TabButton>
              <TabButton active={tab === 'delivery'} onClick={() => setTab('delivery')} icon={Mail}>
                Envoi
              </TabButton>
            </div>

            {tab === 'period' && (
              <PeriodTab settings={settings} patch={patch} preview={preview} />
            )}

            {tab === 'content' && <ContentTab settings={settings} patch={patch} preview={preview} />}

            {tab === 'delivery' && (
              <DeliveryTab
                settings={settings}
                patch={patch}
                nextRun={nextRun}
                recipientDraft={recipientDraft}
                setRecipientDraft={setRecipientDraft}
                addRecipient={addRecipient}
              />
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownload} disabled={downloading || loading}>
              {downloading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Télécharger le PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleSendNow}
              disabled={sending || loading}
              className="hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Envoyer maintenant
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: typeof CalendarRange
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  )
}

function PreviewBar({
  periodLabel,
  inPeriod,
  allTime,
  fillRate,
  nextRun,
}: {
  periodLabel: string
  inPeriod: number
  allTime: number
  fillRate: number
  nextRun: Date | null
}) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 sm:grid-cols-4">
      <Metric label="Réponses sur la période" value={String(inPeriod)} hint={`${allTime} au total`} />
      <Metric label="Période analysée" value={periodLabel} />
      <Metric label="Remplissage moyen" value={`${fillRate} %`} />
      <Metric
        label="Prochain envoi"
        value={nextRun ? format(nextRun, 'dd/MM à HH:mm', { locale: fr }) : 'Non programmé'}
        hint={nextRun ? format(nextRun, 'EEEE d MMMM', { locale: fr }) : undefined}
      />
    </div>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-indigo-500">{label}</div>
      <div className="truncate text-base font-semibold text-gray-900" title={value}>
        {value}
      </div>
      {hint && <div className="truncate text-xs text-gray-500">{hint}</div>}
    </div>
  )
}

function PeriodTab({
  settings,
  patch,
  preview,
}: {
  settings: FormReportSettings
  patch: (changes: Partial<FormReportSettings>) => void
  preview: { stats: ReturnType<typeof computeReportStats> }
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <Label>Réponses prises en compte</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => patch({ period: { ...settings.period, mode: option.value } })}
              className={`rounded-lg border p-3 text-left transition-colors ${
                settings.period.mode === option.value
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-sm font-medium text-gray-900">{option.label}</div>
              <div className="mt-0.5 text-xs text-gray-500">{option.hint}</div>
            </button>
          ))}
        </div>

        {settings.period.mode === 'last_days' && (
          <div className="flex items-center gap-2 pt-1">
            <Label className="whitespace-nowrap">Nombre de jours</Label>
            <Input
              type="number"
              min={1}
              max={3650}
              value={settings.period.days ?? 7}
              onChange={(e) =>
                patch({ period: { ...settings.period, days: Number(e.target.value) || 1 } })
              }
              className="w-28"
            />
          </div>
        )}

        {settings.period.mode === 'custom' && (
          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Du</Label>
              <Input
                type="date"
                value={settings.period.from ?? ''}
                onChange={(e) => patch({ period: { ...settings.period, from: e.target.value } })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Au</Label>
              <Input
                type="date"
                value={settings.period.to ?? ''}
                onChange={(e) => patch({ period: { ...settings.period, to: e.target.value } })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-indigo-500" />
          <Label>Date de clôture</Label>
        </div>
        <p className="text-xs text-gray-500">
          Passée cette date, tous les rapports s’arrêtent à cette borne : la synthèse décrit un
          corpus figé au lieu de s’étendre indéfiniment. Cette date ne ferme pas le formulaire aux
          nouvelles réponses — elle ne concerne que les rapports.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="date"
            value={settings.closingDate ?? ''}
            onChange={(e) => patch({ closingDate: e.target.value || undefined })}
            className="w-48"
          />
          {settings.closingDate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => patch({ closingDate: undefined })}
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Retirer
            </Button>
          )}
        </div>

        <label className="flex items-start gap-3 pt-1">
          <input
            type="checkbox"
            checked={settings.sendFinalReportOnClosing}
            onChange={(e) => patch({ sendFinalReportOnClosing: e.target.checked })}
            disabled={!settings.closingDate}
            className="mt-0.5 rounded"
          />
          <span className="text-sm text-gray-700">
            Envoyer un rapport final le soir de la clôture
            <span className="block text-xs text-gray-500">
              Envoyé une seule fois, en plus des rapports programmés.
            </span>
          </span>
        </label>

        {settings.finalReportSentAt && (
          <p className="text-xs text-emerald-700">
            Rapport final déjà envoyé le{' '}
            {format(new Date(settings.finalReportSentAt), 'dd/MM/yyyy à HH:mm', { locale: fr })}.
          </p>
        )}
      </div>

      <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
        Avec ces réglages, le rapport porterait sur{' '}
        <strong>{preview.stats.totals.inPeriod} réponse(s)</strong>
        {preview.stats.totals.bestDay && (
          <>
            , la journée la plus active étant le {preview.stats.totals.bestDay.label} (
            {preview.stats.totals.bestDay.count} réponse(s))
          </>
        )}
        .
      </div>
    </div>
  )
}

function ContentTab({
  settings,
  patch,
  preview,
}: {
  settings: FormReportSettings
  patch: (changes: Partial<FormReportSettings>) => void
  preview: { stats: ReturnType<typeof computeReportStats> }
}) {
  const counts: Partial<Record<keyof ReportSections, string>> = {
    choiceBreakdown: `${preview.stats.choices.length} question(s) à choix`,
    numericStats: `${preview.stats.numerics.length} question(s) numérique(s)`,
    textAnswers: `${preview.stats.freeform.length} question(s) libre(s)`,
    completion: `${preview.stats.completion.length} question(s)`,
    timeline: `${preview.stats.timeline.length} point(s)`,
    responseTable: `${preview.stats.tableRows.length} ligne(s)`,
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-gray-200 p-4">
        <Label>Sections incluses dans le PDF</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {SECTION_OPTIONS.map((option) => (
            <label
              key={option.key}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                settings.sections[option.key]
                  ? 'border-indigo-300 bg-indigo-50/50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={settings.sections[option.key]}
                onChange={(e) =>
                  patch({ sections: { ...settings.sections, [option.key]: e.target.checked } })
                }
                className="mt-0.5 rounded"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                <span className="block text-xs text-gray-500">{option.hint}</span>
                {counts[option.key] && (
                  <span className="mt-0.5 block text-[11px] text-indigo-600">
                    {counts[option.key]} sur la période
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-gray-200 p-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Verbatims par question</Label>
          <Input
            type="number"
            min={0}
            max={50}
            value={settings.textSampleSize}
            onChange={(e) => patch({ textSampleSize: Number(e.target.value) || 0 })}
          />
          <p className="text-xs text-gray-500">0 pour n’afficher que les valeurs récurrentes.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Lignes du tableau</Label>
          <Input
            type="number"
            min={1}
            max={200}
            value={settings.tableRowLimit}
            onChange={(e) => patch({ tableRowLimit: Number(e.target.value) || 1 })}
            disabled={!settings.sections.responseTable}
          />
          <p className="text-xs text-gray-500">Réponses les plus récentes.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Options jamais choisies</Label>
          <label className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              checked={settings.includeEmptyChoices}
              onChange={(e) => patch({ includeEmptyChoices: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Les afficher à 0 %</span>
          </label>
          <p className="text-xs text-gray-500">
            Utile pour voir ce que personne ne demande.
          </p>
        </div>
      </div>

      <div className="space-y-1.5 rounded-xl border border-gray-200 p-4">
        <Label>Nom du fichier PDF</Label>
        <Input
          value={settings.fileNamePattern}
          onChange={(e) => patch({ fileNamePattern: e.target.value })}
          placeholder="Rapport - {form_title}"
        />
        <p className="text-xs text-gray-500">
          La date de génération est ajoutée automatiquement à la fin.
        </p>
      </div>
    </div>
  )
}

function DeliveryTab({
  settings,
  patch,
  nextRun,
  recipientDraft,
  setRecipientDraft,
  addRecipient,
}: {
  settings: FormReportSettings
  patch: (changes: Partial<FormReportSettings>) => void
  nextRun: Date | null
  recipientDraft: string
  setRecipientDraft: (value: string) => void
  addRecipient: () => void
}) {
  const schedule = settings.schedule

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) => patch({ schedule: { ...schedule, enabled: e.target.checked } })}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-900">Envoyer le rapport automatiquement</span>
        </label>

        <div className={schedule.enabled ? 'space-y-3' : 'pointer-events-none space-y-3 opacity-50'}>
          <div className="flex flex-wrap gap-2">
            {FREQUENCIES.map((frequency) => (
              <button
                key={frequency.value}
                type="button"
                onClick={() => patch({ schedule: { ...schedule, frequency: frequency.value } })}
                className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                  schedule.frequency === frequency.value
                    ? 'border-indigo-400 bg-indigo-50 font-medium text-indigo-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {frequency.label}
              </button>
            ))}
          </div>

          {schedule.frequency === 'weekly' && (
            <div className="space-y-1.5">
              <Label>Jour de la semaine</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => patch({ schedule: { ...schedule, dayOfWeek: day.value } })}
                    className={`w-14 rounded-lg border py-2 text-sm transition-colors ${
                      schedule.dayOfWeek === day.value
                        ? 'border-indigo-400 bg-indigo-500 font-medium text-white'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {schedule.frequency === 'monthly' && (
            <div className="space-y-1.5">
              <Label>Jour du mois</Label>
              <Input
                type="number"
                min={1}
                max={28}
                value={schedule.dayOfMonth}
                onChange={(e) =>
                  patch({ schedule: { ...schedule, dayOfMonth: Number(e.target.value) || 1 } })
                }
                className="w-28"
              />
              <p className="text-xs text-gray-500">
                Limité au 28 pour que l’envoi ait lieu tous les mois, février compris.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Heure d’envoi</Label>
            <div className="flex items-center gap-2">
              <select
                value={schedule.hour}
                onChange={(e) => patch({ schedule: { ...schedule, hour: Number(e.target.value) } })}
                className="rounded-md border px-3 py-2 text-sm"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="text-gray-500">:</span>
              <select
                value={schedule.minute}
                onChange={(e) => patch({ schedule: { ...schedule, minute: Number(e.target.value) } })}
                className="rounded-md border px-3 py-2 text-sm"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500">heure du serveur</span>
            </div>
          </div>

          <div className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">
            {describeSchedule(schedule)}
            {nextRun && (
              <span className="block text-xs text-indigo-600">
                Prochain envoi : {format(nextRun, "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <Label>Destinataires</Label>
        <div className="flex gap-2">
          <Input
            value={recipientDraft}
            onChange={(e) => setRecipientDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addRecipient()
              }
            }}
            placeholder="direction@exemple.fr"
            type="email"
          />
          <Button type="button" variant="outline" onClick={addRecipient}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </div>

        {settings.recipients.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {settings.recipients.map((address) => (
              <span
                key={address}
                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 py-1 pl-3 pr-1.5 text-sm text-indigo-800"
              >
                {address}
                <button
                  type="button"
                  onClick={() =>
                    patch({ recipients: settings.recipients.filter((a) => a !== address) })
                  }
                  className="rounded-full p-0.5 hover:bg-indigo-100"
                  title="Retirer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-red-600">
            Aucun destinataire : le rapport ne pourra pas être envoyé.
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <div className="space-y-1.5">
          <Label>Objet</Label>
          <Input value={settings.subject} onChange={(e) => patch({ subject: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Corps du message (HTML)</Label>
          <textarea
            value={settings.body}
            onChange={(e) => patch({ body: e.target.value })}
            className="h-32 w-full rounded-md border px-3 py-2 font-mono text-sm"
          />
        </div>
        <div className="rounded-lg bg-gray-50 p-3">
          <p className="mb-1.5 text-xs font-medium text-gray-600">Jetons acceptés :</p>
          <div className="flex flex-wrap gap-1">
            {[
              'form_title',
              'period',
              'response_count',
              'response_total',
              'generated_at',
              'closing_date',
              'site_name',
            ].map((token) => (
              <code
                key={token}
                className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-gray-700 ring-1 ring-gray-200"
              >
                {`{${token}}`}
              </code>
            ))}
          </div>
        </div>
      </div>

      {settings.lastStatus && <LastStatus status={settings.lastStatus} />}
    </div>
  )
}

function LastStatus({ status }: { status: NonNullable<FormReportSettings['lastStatus']> }) {
  const when = status.sentAt
    ? format(new Date(status.sentAt), 'dd/MM/yyyy à HH:mm', { locale: fr })
    : ''
  const triggerLabel =
    status.trigger === 'schedule' ? 'envoi programmé' : status.trigger === 'closing' ? 'clôture' : 'envoi manuel'

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
        status.success
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-800'
      }`}
    >
      {status.success ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="min-w-0">
        <div className="font-medium">
          {status.success ? 'Dernier rapport envoyé' : 'Dernier envoi en échec'} — {when} ({triggerLabel})
        </div>
        {status.success ? (
          <div className="text-xs">
            {(status.recipients ?? []).join(', ')}
            {status.responseCount !== undefined && ` — ${status.responseCount} réponse(s)`}
            {status.periodLabel && ` — ${status.periodLabel}`}
          </div>
        ) : (
          <div className="text-xs">{status.error}</div>
        )}
        {status.success && (
          <div className="mt-1 flex items-start gap-1 text-[11px] opacity-80">
            <MinusCircle className="mt-0.5 h-3 w-3 shrink-0" />
            Adresses acceptées par le serveur d’envoi — la remise finale n’est pas vérifiable ici.
          </div>
        )}
      </div>
    </div>
  )
}

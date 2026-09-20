'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
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
import { PeriodPicker } from '@/components/forms/period-picker'
import { DEFAULT_MANUAL_PERIOD } from '@/lib/manual-period'
import { resolveReportRange } from '@/lib/report-stats'
import {
  buildExportColumns,
  filterResponsesByRange,
  type ExportBlock,
  type ExportResponseInput,
} from '@/lib/response-export'
import type { ReportPeriod } from '@/types/form'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'

interface ExportModalProps {
  formId: string
  blocks: ExportBlock[]
  responses: ExportResponseInput[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ExportFormat = 'xlsx' | 'csv'

export function ExportModal({ formId, blocks, responses, open, onOpenChange }: ExportModalProps) {
  const [fileFormat, setFileFormat] = useState<ExportFormat>('xlsx')
  const [period, setPeriod] = useState<ReportPeriod>({ ...DEFAULT_MANUAL_PERIOD })
  const [downloading, setDownloading] = useState(false)
  const { toast } = useToast()

  // Le décompte est calculé avec les fonctions qu'utilise la route : ce que la modale annonce
  // est donc exactement ce que le fichier contiendra, sans aller-retour serveur.
  const preview = useMemo(() => {
    const range = resolveReportRange({ period })
    const selected = filterResponsesByRange(responses, range)
    return {
      range,
      rows: selected.length,
      columns: buildExportColumns(blocks, selected).length,
    }
  }, [period, responses, blocks])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/forms/${formId}/responses/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: fileFormat, period }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Export impossible')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileNameFromResponse(res, fileFormat)
      link.click()
      URL.revokeObjectURL(url)

      toast({
        title: fileFormat === 'xlsx' ? 'Export Excel téléchargé' : 'Export CSV téléchargé',
        description: `${preview.rows} réponse(s) — ${preview.range.label}`,
      })
      onOpenChange(false)
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error?.message || 'Impossible de générer l’export',
        variant: 'destructive',
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-green-600" />
            Exporter les réponses
          </DialogTitle>
          <DialogDescription>
            Un tableau d’une ligne par réponse et d’une colonne par question, répéteurs et
            groupes dépliés. Les deux formats contiennent exactement les mêmes données.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid grid-cols-2 gap-2">
              <FormatCard
                active={fileFormat === 'xlsx'}
                onClick={() => setFileFormat('xlsx')}
                icon={FileSpreadsheet}
                title="Excel (.xlsx)"
                hint="Colonnes dimensionnées sur leur contenu"
              />
              <FormatCard
                active={fileFormat === 'csv'}
                onClick={() => setFileFormat('csv')}
                icon={FileText}
                title="CSV (.csv)"
                hint="Texte brut, pour un import dans un autre outil"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Période</Label>
            <PeriodPicker period={period} onChange={setPeriod} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
            <strong className="text-gray-900">{preview.rows} réponse(s)</strong> sur{' '}
            {responses.length}, {preview.range.label} — {preview.columns} colonne(s).
            {preview.rows === 0 && (
              <span className="mt-1 block text-amber-700">
                Aucune réponse sur cette période : le fichier ne contiendra que les en-têtes.
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Télécharger
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FormatCard({
  active,
  onClick,
  icon: Icon,
  title,
  hint,
}: {
  active: boolean
  onClick: () => void
  icon: any
  title: string
  hint: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
        active
          ? 'border-green-500 bg-green-50'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${active ? 'text-green-600' : 'text-gray-400'}`} />
      <span>
        <span className={`block text-sm font-medium ${active ? 'text-green-800' : 'text-gray-900'}`}>
          {title}
        </span>
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
    </button>
  )
}

// Le nom est construit côté serveur (titre nettoyé, bornes de la période) et transporté par
// Content-Disposition ; la reconstruction locale n'est qu'un filet de sécurité.
function fileNameFromResponse(res: Response, fileFormat: ExportFormat): string {
  const header = res.headers.get('Content-Disposition') ?? ''
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      /* en-tête illisible : on retombe sur le nom générique */
    }
  }
  const ascii = header.match(/filename="([^"]+)"/i)
  if (ascii) return ascii[1]
  return `reponses.${fileFormat}`
}

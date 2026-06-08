'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  ShieldCheck,
  Loader2,
  Search,
  FileSpreadsheet,
  FileText,
  Trash2,
  RotateCcw,
} from 'lucide-react'

interface GdprSettings {
  retentionEnabled: boolean
  retentionMonths: number
}

interface RetentionInfo {
  total: number
  retentionMonths: number
  byForm: { formId: string; formTitle: string; count: number }[]
}

interface SearchResult {
  id: string
  formId: string
  formTitle: string
  createdAt: string
  snippet: string
}

const DEFAULT_SETTINGS: GdprSettings = {
  retentionEnabled: true,
  retentionMonths: 36,
}

const LEGAL_RETENTION_MONTHS = 36

export function GdprClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [purgingExpired, setPurgingExpired] = useState(false)

  const [settings, setSettings] = useState<GdprSettings>(DEFAULT_SETTINGS)
  const [retentionInfo, setRetentionInfo] = useState<RetentionInfo | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null)
  const [purgingSelection, setPurgingSelection] = useState(false)

  const fetchAll = async () => {
    try {
      const [settingsRes, retentionRes] = await Promise.all([
        fetch('/api/admin/gdpr/settings'),
        fetch('/api/admin/gdpr/retention'),
      ])
      if (settingsRes.ok) setSettings(await settingsRes.json())
      if (retentionRes.ok) setRetentionInfo(await retentionRes.json())
    } catch (error) {
      console.error('Error fetching GDPR data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const refreshRetentionInfo = async () => {
    try {
      const res = await fetch('/api/admin/gdpr/retention')
      if (res.ok) setRetentionInfo(await res.json())
    } catch (error) {
      console.error('Error refreshing retention info:', error)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/gdpr/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde')

      const data = await res.json()
      setSettings(data)
      toast({ title: 'Paramètres sauvegardés', description: 'La durée de conservation a été mise à jour' })
      refreshRetentionInfo()
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handlePurgeExpired = async () => {
    if (!retentionInfo || retentionInfo.total === 0) return
    if (!confirm(`Supprimer définitivement ${retentionInfo.total} réponse(s) datant de plus de ${settings.retentionMonths} mois ? Cette action est irréversible.`)) return

    setPurgingExpired(true)
    try {
      const res = await fetch('/api/admin/gdpr/retention', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la purge')

      toast({ title: 'Purge effectuée', description: `${data.deleted} réponse(s) supprimée(s)` })
      refreshRetentionInfo()
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setPurgingExpired(false)
    }
  }

  const handleSearch = async () => {
    const term = searchTerm.trim()
    if (term.length < 2) {
      toast({ title: 'Terme trop court', description: 'Saisissez au moins 2 caractères', variant: 'destructive' })
      return
    }

    setSearching(true)
    setResults(null)
    setSelectedIds(new Set())
    try {
      const res = await fetch('/api/admin/gdpr/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: term }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la recherche')

      setResults(data.results)
      setTruncated(data.truncated)
      setSelectedIds(new Set(data.results.map((r: SearchResult) => r.id)))
      if (data.results.length === 0) {
        toast({ title: 'Aucun résultat', description: `Aucune réponse ne contient « ${term} »` })
      }
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setSearching(false)
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!results) return
    setSelectedIds((prev) => (prev.size === results.length ? new Set() : new Set(results.map((r) => r.id))))
  }

  const handleExport = async (exportFormat: 'xlsx' | 'pdf') => {
    if (selectedIds.size === 0) return

    setExporting(exportFormat)
    try {
      const res = await fetch('/api/admin/gdpr/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseIds: Array.from(selectedIds), format: exportFormat }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Erreur lors de l'export")
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportFormat === 'pdf' ? 'recapitulatif-rgpd.pdf' : 'export-donnees-rgpd.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Export téléchargé' })
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setExporting(null)
    }
  }

  const handlePurgeSelection = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Supprimer définitivement les ${selectedIds.size} réponse(s) sélectionnée(s) ? Cette action est irréversible — pensez à générer le récapitulatif avant si la personne doit en être informée.`)) return

    setPurgingSelection(true)
    try {
      const res = await fetch('/api/admin/gdpr/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseIds: Array.from(selectedIds) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la suppression')

      toast({ title: 'Suppression effectuée', description: `${data.deleted} réponse(s) supprimée(s)` })
      setResults((prev) => prev?.filter((r) => !selectedIds.has(r.id)) ?? null)
      setSelectedIds(new Set())
      refreshRetentionInfo()
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setPurgingSelection(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h1 className="text-xl font-semibold">RGPD</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Durée de conservation */}
        <Card>
          <CardHeader>
            <CardTitle>Durée de conservation des réponses</CardTitle>
            <CardDescription>
              Définit la durée maximale pendant laquelle les réponses aux formulaires sont conservées.
              La durée légale par défaut couramment retenue est de {LEGAL_RETENTION_MONTHS} mois — vous pouvez la
              personnaliser selon la finalité de vos traitements.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Limiter la durée de conservation</p>
                <p className="text-sm text-gray-500">
                  Permet de suivre et de purger manuellement les réponses qui dépassent la durée définie.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.retentionEnabled}
                  onChange={(e) => setSettings({ ...settings, retentionEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="retentionMonths">Durée de conservation (en mois)</Label>
                <Input
                  id="retentionMonths"
                  type="number"
                  min={1}
                  className="sm:w-40"
                  value={settings.retentionMonths}
                  onChange={(e) => setSettings({ ...settings, retentionMonths: parseInt(e.target.value) || 1 })}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettings({ ...settings, retentionMonths: LEGAL_RETENTION_MONTHS })}
                disabled={settings.retentionMonths === LEGAL_RETENTION_MONTHS}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Réinitialiser à la durée légale ({LEGAL_RETENTION_MONTHS} mois)
              </Button>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </div>

            <div className="border-t pt-4 space-y-3">
              {retentionInfo ? (
                <>
                  <p className="text-sm">
                    <span className="font-semibold">{retentionInfo.total}</span> réponse(s) actuellement âgée(s) de plus
                    de {settings.retentionMonths} mois.
                  </p>
                  {retentionInfo.byForm.length > 0 && (
                    <ul className="text-sm text-gray-500 space-y-1">
                      {retentionInfo.byForm.map((f) => (
                        <li key={f.formId}>— {f.formTitle} : {f.count} réponse(s)</li>
                      ))}
                    </ul>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handlePurgeExpired}
                    disabled={retentionInfo.total === 0 || purgingExpired}
                  >
                    {purgingExpired ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Purger les réponses expirées
                  </Button>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">Chargement du décompte…</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recherche & droits des personnes */}
        <Card>
          <CardHeader>
            <CardTitle>Recherche & droits des personnes</CardTitle>
            <CardDescription>
              Recherchez toutes les réponses (tous formulaires confondus) correspondant à une personne — par nom,
              email ou tout autre texte présent dans ses réponses — pour répondre à une demande d'accès, de
              portabilité ou d'effacement de ses données.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Nom, email ou texte à rechercher…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Rechercher
              </Button>
            </div>

            {results && (
              <div className="space-y-3">
                {results.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Aucune réponse ne correspond à cette recherche.</p>
                ) : (
                  <>
                    {truncated && (
                      <p className="text-xs text-amber-600">
                        Plus de 500 résultats trouvés — seuls les 500 plus récents sont affichés. Affinez votre
                        recherche si besoin.
                      </p>
                    )}
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === results.length && results.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded"
                      />
                      {selectedIds.size} / {results.length} sélectionnée(s) — décochez les faux positifs avant
                      d'exporter ou de supprimer
                    </label>

                    <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
                      {results.map((r) => (
                        <label key={r.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleSelection(r.id)}
                            className="mt-1 w-4 h-4 rounded"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{r.formTitle}</p>
                            <p className="text-xs text-gray-500">
                              Soumise le {format(new Date(r.createdAt), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5 truncate">{r.snippet}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport('xlsx')}
                        disabled={selectedIds.size === 0 || exporting !== null}
                      >
                        {exporting === 'xlsx' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                        Exporter les données (Excel)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport('pdf')}
                        disabled={selectedIds.size === 0 || exporting !== null}
                      >
                        {exporting === 'pdf' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                        Générer le récapitulatif (PDF)
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handlePurgeSelection}
                        disabled={selectedIds.size === 0 || purgingSelection}
                      >
                        {purgingSelection ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                        Supprimer ces réponses
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Astuce : exportez les données ou générez le récapitulatif PDF avant de supprimer, pour
                      pouvoir transmettre à la personne ce qui était détenu et ce qui a été effacé.
                    </p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

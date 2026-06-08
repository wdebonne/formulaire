'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { ACTION_CATEGORIES, actionLabel } from '@/lib/audit-actions'
import {
  ArrowLeft,
  ScrollText,
  Loader2,
  Search,
  FileSpreadsheet,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface LogEntry {
  id: string
  action: string
  status: string
  userEmail: string | null
  ipAddress: string | null
  targetLabel: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

interface LogFilters {
  action: string
  status: string
  q: string
  from: string
  to: string
}

interface LogSettings {
  retentionEnabled: boolean
  retentionDays: number
}

interface RetentionInfo {
  cutoff: string
  retentionDays: number
  total: number
}

const EMPTY_FILTERS: LogFilters = { action: '', status: '', q: '', from: '', to: '' }

const DEFAULT_SETTINGS: LogSettings = {
  retentionEnabled: true,
  retentionDays: 365,
}

const PAGE_SIZE = 25

function formatMetadata(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata || {})
  if (entries.length === 0) return '—'
  return entries
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    .join(' • ')
}

export function LogsClient() {
  const { toast } = useToast()

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const [filters, setFilters] = useState<LogFilters>(EMPTY_FILTERS)
  const [searchInput, setSearchInput] = useState('')

  const [settings, setSettings] = useState<LogSettings>(DEFAULT_SETTINGS)
  const [retentionInfo, setRetentionInfo] = useState<RetentionInfo | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [purging, setPurging] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))
      if (filters.action) params.set('action', filters.action)
      if (filters.status) params.set('status', filters.status)
      if (filters.q) params.set('q', filters.q)
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)

      const res = await fetch(`/api/admin/logs?${params.toString()}`)
      if (!res.ok) throw new Error('Erreur lors du chargement du journal')

      const data = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, filters, toast])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const refreshRetentionInfo = async () => {
    try {
      const res = await fetch('/api/admin/logs/retention')
      if (res.ok) setRetentionInfo(await res.json())
    } catch (error) {
      console.error('Error refreshing log retention info:', error)
    }
  }

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [settingsRes, retentionRes] = await Promise.all([
          fetch('/api/admin/logs/settings'),
          fetch('/api/admin/logs/retention'),
        ])
        if (settingsRes.ok) setSettings(await settingsRes.json())
        if (retentionRes.ok) setRetentionInfo(await retentionRes.json())
      } catch (error) {
        console.error('Error fetching log settings:', error)
      }
    }
    fetchSettings()
  }, [])

  const updateFilter = (key: keyof LogFilters, value: string) => {
    setPage(1)
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const applySearch = () => {
    setPage(1)
    setFilters((prev) => ({ ...prev, q: searchInput.trim() }))
  }

  const resetFilters = () => {
    setSearchInput('')
    setPage(1)
    setFilters(EMPTY_FILTERS)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/logs/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Erreur lors de l'export")
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'journal-activite.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Export téléchargé' })
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch('/api/admin/logs/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde')

      const data = await res.json()
      setSettings(data)
      toast({ title: 'Paramètres sauvegardés', description: 'La durée de conservation du journal a été mise à jour' })
      refreshRetentionInfo()
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setSavingSettings(false)
    }
  }

  const handlePurgeExpired = async () => {
    if (!retentionInfo || retentionInfo.total === 0) return
    if (!confirm(`Supprimer définitivement ${retentionInfo.total} entrée(s) du journal datant de plus de ${settings.retentionDays} jour(s) ? Cette action est irréversible.`)) return

    setPurging(true)
    try {
      const res = await fetch('/api/admin/logs/retention', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la purge')

      toast({ title: 'Purge effectuée', description: `${data.deleted} entrée(s) supprimée(s)` })
      refreshRetentionInfo()
      fetchLogs()
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setPurging(false)
    }
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
              <ScrollText className="w-5 h-5 text-slate-600" />
              <h1 className="text-xl font-semibold">Journal d&apos;activité</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Filtres */}
        <Card>
          <CardHeader>
            <CardTitle>Filtres</CardTitle>
            <CardDescription>
              Affinez la liste pour retrouver rapidement un événement — par type d&apos;action, statut, période,
              utilisateur, adresse IP ou cible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filter-action">Action</Label>
                <select
                  id="filter-action"
                  value={filters.action}
                  onChange={(e) => updateFilter('action', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">Toutes les actions</option>
                  {ACTION_CATEGORIES.map((category) => (
                    <optgroup key={category.label} label={category.label}>
                      {category.actions.map((action) => (
                        <option key={action} value={action}>
                          {actionLabel(action)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-status">Statut</Label>
                <select
                  id="filter-status"
                  value={filters.status}
                  onChange={(e) => updateFilter('status', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">Tous les statuts</option>
                  <option value="success">Succès</option>
                  <option value="failure">Échec</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-from">Du</Label>
                <Input
                  id="filter-from"
                  type="date"
                  value={filters.from}
                  onChange={(e) => updateFilter('from', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-to">Au</Label>
                <Input
                  id="filter-to"
                  type="date"
                  value={filters.to}
                  onChange={(e) => updateFilter('to', e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Utilisateur, email, adresse IP ou cible…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applySearch() }}
                className="flex-1"
              />
              <Button onClick={applySearch} variant="outline">
                <Search className="w-4 h-4 mr-2" />
                Rechercher
              </Button>
              <Button onClick={resetFilters} variant="ghost">
                Réinitialiser
              </Button>
              <Button onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                Exporter (Excel)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tableau */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Statut</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Utilisateur</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Adresse IP</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cible</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Détails</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400 italic">
                      Aucune entrée ne correspond à ces critères.
                    </td>
                  </tr>
                ) : (
                  logs.map((log, idx) => (
                    <tr key={log.id} className={`hover:bg-blue-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {format(new Date(log.createdAt), 'dd MMM yyyy', { locale: fr })}
                        </div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(log.createdAt), 'HH:mm:ss', { locale: fr })}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700 whitespace-nowrap">{actionLabel(log.action)}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {log.status === 'success' ? 'Succès' : 'Échec'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-700 max-w-[180px] truncate">{log.userEmail || '—'}</td>
                      <td className="px-5 py-4 text-sm text-gray-700 whitespace-nowrap font-mono">{log.ipAddress || '—'}</td>
                      <td className="px-5 py-4 text-sm text-gray-700 max-w-[180px] truncate">{log.targetLabel || '—'}</td>
                      <td
                        className="px-5 py-4 text-sm text-gray-500 max-w-[280px] truncate"
                        title={formatMetadata(log.metadata)}
                      >
                        {formatMetadata(log.metadata)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <p className="text-sm text-gray-600">
                Affichage de <span className="font-medium">{total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}</span> à{' '}
                <span className="font-medium">{Math.min(page * PAGE_SIZE, total)}</span> sur{' '}
                <span className="font-medium">{total}</span> entrées
              </p>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600 px-2">Page {page} / {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Conservation du journal */}
        <Card>
          <CardHeader>
            <CardTitle>Conservation du journal</CardTitle>
            <CardDescription>
              Définit la durée maximale pendant laquelle les entrées du journal d&apos;activité sont conservées.
              Les entrées plus anciennes peuvent être purgées manuellement pour maîtriser le volume de données.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Limiter la durée de conservation</p>
                <p className="text-sm text-gray-500">
                  Permet de suivre et de purger manuellement les entrées qui dépassent la durée définie.
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
                <Label htmlFor="retentionDays">Durée de conservation (en jours)</Label>
                <Input
                  id="retentionDays"
                  type="number"
                  min={1}
                  className="sm:w-40"
                  value={settings.retentionDays}
                  onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </div>

            <div className="border-t pt-4 space-y-3">
              {retentionInfo ? (
                <>
                  <p className="text-sm">
                    <span className="font-semibold">{retentionInfo.total}</span> entrée(s) actuellement âgée(s) de plus
                    de {settings.retentionDays} jour(s).
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handlePurgeExpired}
                    disabled={retentionInfo.total === 0 || purging}
                  >
                    {purging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Purger les entrées expirées
                  </Button>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">Chargement du décompte…</p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { History, RotateCcw, Plus, Loader2, Clock, Tag, Trash2, Search, X } from 'lucide-react'

interface VersionSummary {
  id: string
  number: number
  label: string | null
  isAuto: boolean
  title: string
  themeId: string | null
  createdBy: string
  createdAt: string
}

interface VersionsModalProps {
  formId: string
  open: boolean
  onClose: () => void
  onRestored?: () => void
}

export function VersionsModal({ formId, open, onClose, onRestored }: VersionsModalProps) {
  const { toast } = useToast()
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [creatingManual, setCreatingManual] = useState(false)
  const [manualLabel, setManualLabel] = useState('')
  const [showLabelInput, setShowLabelInput] = useState(false)
  const [search, setSearch] = useState('')

  const loadVersions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/forms/${formId}/versions`)
      if (!res.ok) throw new Error()
      setVersions(await res.json())
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de charger les versions', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [formId, toast])

  useEffect(() => {
    if (open) {
      loadVersions()
      setSearch('')
      setConfirmDeleteId(null)
    }
  }, [open, loadVersions])

  const filteredVersions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return versions
    return versions.filter(v =>
      (v.label ?? '').toLowerCase().includes(q) ||
      v.title.toLowerCase().includes(q) ||
      String(v.number).includes(q) ||
      (v.isAuto ? 'auto' : 'manuel').includes(q)
    )
  }, [versions, search])

  const handleCreateManual = async () => {
    setCreatingManual(true)
    try {
      const res = await fetch(`/api/forms/${formId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: manualLabel.trim() || null }),
      })
      if (!res.ok) throw new Error()
      setManualLabel('')
      setShowLabelInput(false)
      await loadVersions()
      toast({ title: 'Version enregistrée', description: 'La version a été créée avec succès' })
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de créer la version', variant: 'destructive' })
    } finally {
      setCreatingManual(false)
    }
  }

  const handleRestore = async (version: VersionSummary) => {
    setRestoringId(version.id)
    try {
      const res = await fetch(`/api/forms/${formId}/versions/${version.id}/restore`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast({
        title: 'Formulaire restauré',
        description: `Retour à la version ${version.label ? `"${version.label}"` : `#${version.number}`}`,
      })
      onRestored?.()
      onClose()
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de restaurer cette version', variant: 'destructive' })
    } finally {
      setRestoringId(null)
    }
  }

  const handleDelete = async (version: VersionSummary) => {
    setDeletingId(version.id)
    try {
      const res = await fetch(`/api/forms/${formId}/versions/${version.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setVersions(prev => prev.filter(v => v.id !== version.id))
      toast({ title: 'Version supprimée' })
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de supprimer cette version', variant: 'destructive' })
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historique des versions
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Manual version creation */}
          <div className="border rounded-lg p-3 bg-gray-50">
            {showLabelInput ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="Nom de la version (optionnel)"
                  value={manualLabel}
                  onChange={(e) => setManualLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateManual() }}
                  className="flex-1"
                />
                <Button size="sm" onClick={handleCreateManual} disabled={creatingManual}>
                  {creatingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowLabelInput(false); setManualLabel('') }}>
                  Annuler
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="w-full" onClick={() => setShowLabelInput(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Enregistrer la version actuelle
              </Button>
            )}
          </div>

          {/* Search */}
          {versions.length > 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                placeholder="Rechercher une version…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-8"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Versions list */}
          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-8">
                Aucune version enregistrée.<br />
                Les versions automatiques apparaissent toutes les 10 sauvegardes.
              </p>
            ) : filteredVersions.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-6">
                Aucune version ne correspond à « {search} »
              </p>
            ) : (
              filteredVersions.map((v) => (
                <div key={v.id} className="rounded-lg border bg-white overflow-hidden">
                  <div className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">#{v.number}</span>
                        {v.isAuto ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                            <Clock className="w-3 h-3" />
                            Auto
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">
                            <Tag className="w-3 h-3" />
                            Manuel
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate mt-0.5">
                        {v.label ?? v.title}
                      </p>
                      {v.label && (
                        <p className="text-xs text-gray-400 truncate">{v.title}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(v.createdAt)}</p>
                    </div>

                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      {/* Restore */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRestore(v)}
                        disabled={restoringId === v.id || deletingId === v.id}
                        title="Restaurer"
                      >
                        {restoringId === v.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <RotateCcw className="w-4 h-4" />}
                      </Button>

                      {/* Delete — two-step confirm */}
                      {confirmDeleteId === v.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(v)}
                            disabled={deletingId === v.id}
                            className="text-xs px-2 h-8"
                          >
                            {deletingId === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmer'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs px-2 h-8"
                          >
                            Annuler
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDeleteId(v.id)}
                          disabled={restoringId === v.id || deletingId === v.id}
                          title="Supprimer"
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Result count when filtering */}
          {search && filteredVersions.length > 0 && (
            <p className="text-xs text-gray-400 text-center">
              {filteredVersions.length} résultat{filteredVersions.length > 1 ? 's' : ''} sur {versions.length}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

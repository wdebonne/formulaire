'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { History, RotateCcw, Plus, Loader2, Clock, Tag } from 'lucide-react'

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
  const [creatingManual, setCreatingManual] = useState(false)
  const [manualLabel, setManualLabel] = useState('')
  const [showLabelInput, setShowLabelInput] = useState(false)

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
    if (open) loadVersions()
  }, [open, loadVersions])

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

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historique des versions
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setShowLabelInput(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Enregistrer la version actuelle
              </Button>
            )}
          </div>

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
            ) : (
              versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
                >
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRestore(v)}
                    disabled={restoringId === v.id}
                    className="ml-3 shrink-0"
                  >
                    {restoringId === v.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Loader2,
  FileText,
  User,
  Calendar,
  MessageSquare,
  Shield,
} from 'lucide-react'

interface TrashedForm {
  id: string
  title: string
  slug: string
  status: string
  deletedAt: string
  createdAt: string
  user: { id: string; name: string | null; email: string }
  _count: { responses: number }
}

interface UserOption {
  id: string
  name: string | null
  email: string
}

export function TrashClient() {
  const { toast } = useToast()
  const [forms, setForms] = useState<TrashedForm[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [restoreDialog, setRestoreDialog] = useState<TrashedForm | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<TrashedForm | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchTrash = async () => {
    try {
      const res = await fetch('/api/admin/trash')
      if (res.ok) setForms(await res.json())
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de charger la corbeille', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) setUsers(await res.json())
    } catch {}
  }

  useEffect(() => {
    fetchTrash()
    fetchUsers()
  }, [])

  const openRestoreDialog = (form: TrashedForm) => {
    setSelectedUserId(form.user.id)
    setRestoreDialog(form)
  }

  const handleRestore = async () => {
    if (!restoreDialog) return
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/admin/trash/${restoreDialog.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setForms(forms.filter(f => f.id !== restoreDialog.id))
      toast({ title: 'Formulaire restauré', description: `"${restoreDialog.title}" a été restauré avec succès` })
      setRestoreDialog(null)
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (!deleteDialog) return
    setIsProcessing(true)
    try {
      const res = await fetch(`/api/admin/trash/${deleteDialog.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      setForms(forms.filter(f => f.id !== deleteDialog.id))
      toast({ title: 'Formulaire supprimé', description: `"${deleteDialog.title}" a été supprimé définitivement` })
      setDeleteDialog(null)
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour à l'administration
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-purple-600" />
              <Trash2 className="w-5 h-5 text-red-500" />
              <h1 className="text-xl font-semibold">Corbeille des formulaires</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Corbeille</h2>
          <p className="text-gray-600 mt-1">
            Restaurez ou supprimez définitivement les formulaires supprimés par les utilisateurs.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : forms.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Trash2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">La corbeille est vide</p>
            <p className="text-sm mt-1">Aucun formulaire n'a été supprimé.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {forms.map(form => (
              <Card key={form.id} className="border border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{form.title}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {form.user.name || form.user.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {form._count.responses} réponse{form._count.responses !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Supprimé le {formatDate(form.deletedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRestoreDialog(form)}
                        className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Restaurer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteDialog(form)}
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Restore dialog */}
      <Dialog open={!!restoreDialog} onOpenChange={open => !open && setRestoreDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurer le formulaire</DialogTitle>
            <DialogDescription>
              Choisissez le propriétaire auquel ce formulaire sera restauré.
            </DialogDescription>
          </DialogHeader>
          {restoreDialog && (
            <div className="space-y-4 py-2">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Formulaire</p>
                <p className="text-sm text-gray-900 font-semibold">{restoreDialog.title}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Restaurer pour</p>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name ? `${u.name} (${u.email})` : u.email}
                      {u.id === restoreDialog.user.id ? ' — propriétaire d\'origine' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialog(null)} disabled={isProcessing}>
              Annuler
            </Button>
            <Button onClick={handleRestore} disabled={isProcessing || !selectedUserId} className="bg-green-600 hover:bg-green-700 text-white">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Restaurer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent delete dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={open => !open && setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Suppression définitive
            </DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Le formulaire et toutes ses réponses seront définitivement supprimés.
            </DialogDescription>
          </DialogHeader>
          {deleteDialog && (
            <div className="py-2">
              <p className="text-sm text-gray-700">
                Voulez-vous vraiment supprimer définitivement{' '}
                <span className="font-semibold text-gray-900">"{deleteDialog.title}"</span> ?
              </p>
              {deleteDialog._count.responses > 0 && (
                <p className="text-sm text-red-600 mt-2">
                  {deleteDialog._count.responses} réponse{deleteDialog._count.responses !== 1 ? 's' : ''} seront également supprimée{deleteDialog._count.responses !== 1 ? 's' : ''}.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)} disabled={isProcessing}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handlePermanentDelete} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

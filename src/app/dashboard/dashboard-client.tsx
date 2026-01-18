'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { ShareDialog } from '@/components/builder/share-dialog'
import {
  Plus,
  Search,
  FileText,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  ExternalLink,
  Download,
  Upload,
  LogOut,
  BarChart3,
  Settings,
  Shield,
  Users,
  Share2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface FormData {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published'
  responsesCount: number
  updatedAt: string
  isShared?: boolean
  sharePermission?: string | null
  owner?: {
    id: string
    name: string | null
    email: string
  }
}

interface UserData {
  id: string
  name: string | null
  email: string
  role: string
}

interface DashboardClientProps {
  forms: FormData[]
  user: UserData
}

export function DashboardClient({ forms: initialForms, user }: DashboardClientProps) {
  const [forms, setForms] = useState(initialForms)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all')
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [selectedFormForShare, setSelectedFormForShare] = useState<FormData | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  const handleOpenShareDialog = (form: FormData) => {
    setSelectedFormForShare(form)
    setShareDialogOpen(true)
  }

  const filteredForms = forms.filter((form) => {
    const matchesSearch = form.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === 'all' || form.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const handleCreateForm = async () => {
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nouveau formulaire' }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      router.push(`/builder/${data.id}`)
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleDuplicateForm = async (formId: string) => {
    try {
      const res = await fetch(`/api/forms/${formId}/duplicate`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      // Ajouter le nouveau formulaire à la liste locale
      const newForm: FormData = {
        id: data.id,
        title: data.title,
        slug: data.slug,
        status: data.status,
        responsesCount: 0,
        updatedAt: data.updatedAt,
      }
      setForms([newForm, ...forms])

      toast({
        title: 'Formulaire dupliqué',
        description: 'Le formulaire a été dupliqué avec succès',
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleDeleteForm = async (formId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce formulaire ?')) return

    try {
      const res = await fetch(`/api/forms/${formId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      setForms(forms.filter((f) => f.id !== formId))

      toast({
        title: 'Formulaire supprimé',
        description: 'Le formulaire a été supprimé avec succès',
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleExport = async (formId: string) => {
    try {
      const res = await fetch(`/api/forms/${formId}/export`)
      const data = await res.json()

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `form-${data.slug}.json`
      a.click()
      URL.revokeObjectURL(url)

      toast({
        title: 'Export réussi',
        description: 'Le formulaire a été exporté',
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const formData = JSON.parse(text)

      const res = await fetch('/api/forms/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      toast({
        title: 'Import réussi',
        description: 'Le formulaire a été importé avec succès',
      })

      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    }

    e.target.value = ''
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
    }).format(new Date(dateString))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold">FB</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">FormBuilder</h1>
            </div>

            <div className="flex items-center space-x-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {user.name?.[0] || user.email[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="hidden sm:inline">{user.name || user.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Paramètres
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <>
                      <DropdownMenuItem onClick={() => router.push('/admin')}>
                        <Shield className="w-4 h-4 mr-2" />
                        Administration
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Mes formulaires</h2>
            <p className="text-gray-500 mt-1">{forms.length} formulaire(s)</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
              <Button variant="outline" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Importer
                </span>
              </Button>
            </label>

            <Button onClick={handleCreateForm}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau formulaire
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Rechercher un formulaire..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
            >
              Tous ({forms.length})
            </Button>
            <Button
              variant={filterStatus === 'published' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('published')}
            >
              Publiés ({forms.filter((f) => f.status === 'published').length})
            </Button>
            <Button
              variant={filterStatus === 'draft' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('draft')}
            >
              Brouillons ({forms.filter((f) => f.status === 'draft').length})
            </Button>
          </div>
        </div>

        {/* Forms grid */}
        {filteredForms.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? 'Aucun résultat' : 'Aucun formulaire'}
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery
                  ? 'Essayez avec d\'autres termes de recherche'
                  : 'Créez votre premier formulaire pour commencer'}
              </p>
              {!searchQuery && (
                <Button onClick={handleCreateForm}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer un formulaire
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredForms.map((form) => (
              <Card key={form.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{form.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          form.status === 'published'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {form.status === 'published' ? 'Publié' : 'Brouillon'}
                      </span>
                      {form.isShared && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          form.sharePermission === 'admin' 
                            ? 'bg-purple-100 text-purple-800'
                            : form.sharePermission === 'edit'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          <Share2 className="w-3 h-3 mr-1" />
                          Partagé ({form.sharePermission === 'admin' ? 'admin' : form.sharePermission === 'edit' ? 'édition' : 'lecture'})
                        </span>
                      )}
                    </div>
                    {form.owner && form.isShared && (
                      <p className="text-xs text-gray-500 mt-1">
                        Par {form.owner.name || form.owner.email}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(!form.isShared || form.sharePermission === 'edit' || form.sharePermission === 'admin') && (
                        <DropdownMenuItem onClick={() => router.push(`/builder/${form.id}`)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => router.push(`/forms/${form.id}/responses`)}>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Réponses
                      </DropdownMenuItem>
                      {form.status === 'published' && (
                        <DropdownMenuItem onClick={() => window.open(`/${form.slug}`, '_blank')}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Voir le formulaire
                        </DropdownMenuItem>
                      )}
                      {(!form.isShared || form.sharePermission === 'admin') && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleOpenShareDialog(form)}>
                            <Users className="w-4 h-4 mr-2" />
                            Gérer les droits
                          </DropdownMenuItem>
                        </>
                      )}
                      {!form.isShared && (
                        <>
                          <DropdownMenuItem onClick={() => handleDuplicateForm(form.id)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(form.id)}>
                            <Download className="w-4 h-4 mr-2" />
                            Exporter
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteForm(form.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{form.responsesCount} réponse(s)</span>
                    <span>Modifié le {formatDate(form.updatedAt)}</span>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/builder/${form.id}`)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Éditer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/forms/${form.id}/responses`)}
                    >
                      <BarChart3 className="w-4 h-4 mr-1" />
                      Réponses
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Share Dialog */}
      {selectedFormForShare && (
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          formSlug={selectedFormForShare.slug}
          formId={selectedFormForShare.id}
        />
      )}
    </div>
  )
}

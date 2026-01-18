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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                <span className="text-white font-bold">FB</span>
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">FormBuilder</h1>
            </div>

            <div className="flex items-center space-x-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 hover:bg-purple-50">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md">
                      <span className="text-sm font-medium text-white">
                        {user.name?.[0] || user.email[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="hidden sm:inline font-medium">{user.name || user.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
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
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total formulaires</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{forms.length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Publiés</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{forms.filter(f => f.status === 'published').length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center">
                <ExternalLink className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Brouillons</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{forms.filter(f => f.status === 'draft').length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center">
                <Edit className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total réponses</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{forms.reduce((acc, f) => acc + f.responsesCount, 0)}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Mes formulaires</h2>
            <p className="text-gray-500 mt-1">{filteredForms.length} formulaire(s) affiché(s)</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
              <Button variant="outline" asChild className="hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700">
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Importer
                </span>
              </Button>
            </label>

            <Button onClick={handleCreateForm} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/25">
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
              className="pl-10 bg-white border-gray-200 focus:border-purple-300 focus:ring-purple-200"
            />
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatus('all')}
              className={filterStatus === 'all' ? 'bg-purple-600 hover:bg-purple-700' : 'hover:bg-purple-50'}
            >
              Tous
            </Button>
            <Button
              variant={filterStatus === 'published' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatus('published')}
              className={filterStatus === 'published' ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-green-50'}
            >
              Publiés
            </Button>
            <Button
              variant={filterStatus === 'draft' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatus('draft')}
              className={filterStatus === 'draft' ? 'bg-amber-600 hover:bg-amber-700' : 'hover:bg-amber-50'}
            >
              Brouillons
            </Button>
          </div>
        </div>

        {/* Forms grid */}
        {filteredForms.length === 0 ? (
          <Card className="text-center py-16 border-dashed border-2 bg-white/50">
            <CardContent>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'Aucun résultat' : 'Aucun formulaire'}
              </h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                {searchQuery
                  ? 'Essayez avec d\'autres termes de recherche'
                  : 'Créez votre premier formulaire pour commencer à collecter des réponses'}
              </p>
              {!searchQuery && (
                <Button onClick={handleCreateForm} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Créer un formulaire
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredForms.map((form) => (
              <Card key={form.id} className="group bg-white hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 border-gray-100 overflow-hidden">
                <div className={`h-1.5 ${form.status === 'published' ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`} />
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-semibold truncate group-hover:text-purple-700 transition-colors">{form.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          form.status === 'published'
                            ? 'bg-green-100 text-green-700 ring-1 ring-green-600/20'
                            : 'bg-amber-100 text-amber-700 ring-1 ring-amber-600/20'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${form.status === 'published' ? 'bg-green-500' : 'bg-amber-500'}`} />
                        {form.status === 'published' ? 'Publié' : 'Brouillon'}
                      </span>
                      {form.isShared && (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ring-1 ${
                          form.sharePermission === 'admin' 
                            ? 'bg-purple-100 text-purple-700 ring-purple-600/20'
                            : form.sharePermission === 'edit'
                              ? 'bg-blue-100 text-blue-700 ring-blue-600/20'
                              : 'bg-gray-100 text-gray-700 ring-gray-600/20'
                        }`}>
                          <Share2 className="w-3 h-3 mr-1" />
                          {form.sharePermission === 'admin' ? 'Admin' : form.sharePermission === 'edit' ? 'Édition' : 'Lecture'}
                        </span>
                      )}
                    </div>
                    {form.owner && form.isShared && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center">
                        <span className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center mr-1.5 text-[10px] font-medium">
                          {(form.owner.name || form.owner.email)[0].toUpperCase()}
                        </span>
                        {form.owner.name || form.owner.email}
                      </p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
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
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4 pb-4 border-b border-gray-100">
                    <span className="flex items-center">
                      <BarChart3 className="w-4 h-4 mr-1.5 text-blue-500" />
                      <span className="font-medium text-gray-700">{form.responsesCount}</span>
                      <span className="ml-1">réponse(s)</span>
                    </span>
                    <span className="text-xs">Modifié le {formatDate(form.updatedAt)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700"
                      onClick={() => router.push(`/builder/${form.id}`)}
                    >
                      <Edit className="w-4 h-4 mr-1.5" />
                      Éditer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                      onClick={() => router.push(`/forms/${form.id}/responses`)}
                    >
                      <BarChart3 className="w-4 h-4 mr-1.5" />
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

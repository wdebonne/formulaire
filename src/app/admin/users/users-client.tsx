'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Users,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Search,
  Shield,
  User,
} from 'lucide-react'

interface UserData {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
  _count: {
    forms: number
  }
}

export function UsersManagementClient() {
  const { toast } = useToast()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
  })

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les utilisateurs',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleOpenDialog = (user?: UserData) => {
    if (user) {
      setEditingUser(user)
      setFormData({
        name: user.name || '',
        email: user.email,
        password: '',
        role: user.role,
      })
    } else {
      setEditingUser(null)
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'user',
      })
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const url = editingUser
        ? `/api/admin/users/${editingUser.id}`
        : '/api/admin/users'
      
      const method = editingUser ? 'PUT' : 'POST'
      
      const body: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
      }
      
      if (formData.password) {
        body.password = formData.password
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la sauvegarde')
      }

      toast({
        title: editingUser ? 'Utilisateur modifié' : 'Utilisateur créé',
        description: 'Les modifications ont été enregistrées',
      })

      setIsDialogOpen(false)
      fetchUsers()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (userId: string) => {
    const user = users.find(u => u.id === userId)
    const formCount = user?._count?.forms ?? 0
    const formsWarning = formCount > 0
      ? `\n\nSes ${formCount} formulaire${formCount > 1 ? 's' : ''} seront déplacés dans la corbeille admin pour être supprimés définitivement ou réassignés.`
      : ''
    if (!confirm(`Êtes-vous sûr de vouloir supprimer cet utilisateur ? Son compte sera supprimé définitivement.${formsWarning}`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression')
      }

      toast({
        title: 'Utilisateur supprimé',
        description: formCount > 0
          ? `Le compte a été supprimé. ${formCount} formulaire${formCount > 1 ? 's' : ''} ont été déplacé${formCount > 1 ? 's' : ''} dans la corbeille.`
          : 'L\'utilisateur a été supprimé avec succès',
      })

      fetchUsers()
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  )

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
              <Users className="w-5 h-5 text-blue-600" />
              <h1 className="text-xl font-semibold">Gestion des utilisateurs</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Rechercher un utilisateur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvel utilisateur
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredUsers.map((user) => (
              <Card key={user.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${user.role === 'admin' ? 'bg-purple-100' : 'bg-gray-100'}`}>
                      {user.role === 'admin' ? (
                        <Shield className="w-5 h-5 text-purple-600" />
                      ) : (
                        <User className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{user.name || 'Sans nom'}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {user._count.forms} formulaire(s)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(user)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(user.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                Aucun utilisateur trouvé
              </div>
            )}
          </div>
        )}

        {/* Dialog for creating/editing user */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
              </DialogTitle>
              <DialogDescription>
                {editingUser 
                  ? 'Modifiez les informations de l\'utilisateur'
                  : 'Créez un nouveau compte utilisateur'
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nom de l'utilisateur"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemple.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {editingUser ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    required={!editingUser}
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rôle</Label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="user">Utilisateur</option>
                    <option value="admin">Administrateur</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingUser ? 'Enregistrer' : 'Créer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

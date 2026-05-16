'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, User, Lock, Loader2 } from 'lucide-react'

interface SettingsClientProps {
  user: {
    id: string
    email: string
    name: string | null
    createdAt: Date
  }
}

export function SettingsClient({ user }: SettingsClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  const [name, setName] = useState(user.name || '')
  const [email, setEmail] = useState(user.email)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingProfile(true)

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la mise à jour')
      }

      toast({
        title: 'Profil mis à jour',
        description: 'Vos informations ont été enregistrées',
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas',
        variant: 'destructive',
      })
      return
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 8 caractères',
        variant: 'destructive',
      })
      return
    }

    setIsUpdatingPassword(true)

    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la mise à jour')
      }

      toast({
        title: 'Mot de passe mis à jour',
        description: 'Votre mot de passe a été modifié avec succès',
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour au tableau de bord
              </Button>
            </Link>
            <h1 className="text-xl font-semibold">Paramètres</h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Profile settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-gray-500" />
              <CardTitle>Informations du profil</CardTitle>
            </div>
            <CardDescription>
              Modifiez vos informations personnelles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre nom"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isUpdatingProfile}>
                  {isUpdatingProfile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Password settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Lock className="w-5 h-5 text-gray-500" />
              <CardTitle>Changer le mot de passe</CardTitle>
            </div>
            <CardDescription>
              Mettez à jour votre mot de passe pour sécuriser votre compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={isUpdatingPassword}>
                  {isUpdatingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Changer le mot de passe
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Account info */}
        <Card>
          <CardHeader>
            <CardTitle>Informations du compte</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500">
              <p>Compte créé le : {new Date(user.createdAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

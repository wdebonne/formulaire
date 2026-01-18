'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Settings,
  Loader2,
  UserPlus,
  Shield,
} from 'lucide-react'

interface GeneralSettings {
  registrationEnabled: boolean
}

export function GeneralSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [settings, setSettings] = useState<GeneralSettings>({
    registrationEnabled: true,
  })

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings({
          registrationEnabled: data.registrationEnabled !== false,
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!res.ok) {
        throw new Error('Erreur lors de la sauvegarde')
      }

      toast({
        title: 'Paramètres sauvegardés',
        description: 'Les modifications ont été enregistrées',
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
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
              <Settings className="w-5 h-5 text-gray-600" />
              <h1 className="text-xl font-semibold">Paramètres généraux</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Registration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserPlus className="w-5 h-5" />
              <span>Inscription des utilisateurs</span>
            </CardTitle>
            <CardDescription>
              Contrôlez si les nouveaux utilisateurs peuvent s'inscrire sur la plateforme
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Autoriser les inscriptions</p>
                <p className="text-sm text-gray-500">
                  Lorsque désactivé, seuls les administrateurs peuvent créer de nouveaux comptes
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.registrationEnabled}
                  onChange={(e) => setSettings({ ...settings, registrationEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {!settings.registrationEnabled && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">Mode restreint activé</p>
                    <p className="text-sm text-yellow-700">
                      Les inscriptions sont désactivées. Pour ajouter de nouveaux utilisateurs, 
                      rendez-vous dans la section "Gestion des utilisateurs".
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Future settings can be added here */}
        <Card>
          <CardHeader>
            <CardTitle>Autres paramètres</CardTitle>
            <CardDescription>
              D'autres options de configuration seront disponibles prochainement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-sm">
              Pas d'autres paramètres disponibles pour le moment.
            </p>
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enregistrer les modifications
          </Button>
        </div>
      </main>
    </div>
  )
}

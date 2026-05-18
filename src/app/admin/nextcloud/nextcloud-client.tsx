'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Cloud,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Save,
  Wifi,
  FolderOpen,
  Info,
  RefreshCw,
  Folder,
  FileText,
  ChevronRight,
} from 'lucide-react'
import type { NextCloudItem } from '@/app/api/admin/nextcloud/browse/route'

interface NextCloudSettings {
  nextcloudUrl: string
  nextcloudUser: string
  nextcloudPass: string
  nextcloudBasePath: string
}

export function NextCloudSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [connectionMessage, setConnectionMessage] = useState('')

  // Navigateur de fichiers (aperçu)
  const [browsing, setBrowsing] = useState(false)
  const [browsePath, setBrowsePath] = useState('/')
  const [browseItems, setBrowseItems] = useState<NextCloudItem[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)

  const [settings, setSettings] = useState<NextCloudSettings>({
    nextcloudUrl: '',
    nextcloudUser: '',
    nextcloudPass: '',
    nextcloudBasePath: '/',
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings({
          nextcloudUrl: data.nextcloudUrl || '',
          nextcloudUser: data.nextcloudUser || '',
          nextcloudPass: data.nextcloudPass || '',
          nextcloudBasePath: data.nextcloudBasePath || '/',
        })
        if (data.nextcloudUrl && data.nextcloudUser) {
          setConnectionStatus('idle')
        }
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de charger les paramètres', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde')
      setConnectionStatus('idle')
      toast({ title: 'Enregistré', description: 'Configuration NextCloud sauvegardée' })
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!settings.nextcloudUrl || !settings.nextcloudUser || !settings.nextcloudPass) {
      toast({ title: 'Champs manquants', description: 'Remplissez l\'URL, le nom d\'utilisateur et le mot de passe', variant: 'destructive' })
      return
    }
    setTesting(true)
    setConnectionStatus('idle')
    try {
      const res = await fetch('/api/admin/nextcloud/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: settings.nextcloudUrl,
          user: settings.nextcloudUser,
          pass: settings.nextcloudPass,
          basePath: settings.nextcloudBasePath || '/',
        }),
      })
      const data = await res.json()
      if (data.success) {
        setConnectionStatus('success')
        setConnectionMessage(data.message || 'Connexion réussie')
        toast({ title: 'Connexion réussie', description: 'NextCloud est accessible' })
      } else {
        setConnectionStatus('error')
        setConnectionMessage(data.error || 'Échec de la connexion')
        toast({ title: 'Échec', description: data.error || 'Connexion impossible', variant: 'destructive' })
      }
    } catch (e: any) {
      setConnectionStatus('error')
      setConnectionMessage(e.message)
      toast({ title: 'Erreur réseau', description: e.message, variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  const browseTo = async (path: string) => {
    setBrowseLoading(true)
    setBrowsePath(path)
    try {
      const res = await fetch(`/api/admin/nextcloud/browse?path=${encodeURIComponent(path)}`)
      const data = await res.json()
      if (res.ok) {
        setBrowseItems(data.items)
      } else {
        toast({ title: 'Erreur', description: data.error || 'Impossible de lire le dossier', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Erreur réseau', description: 'Navigation impossible', variant: 'destructive' })
    } finally {
      setBrowseLoading(false)
    }
  }

  const openBrowser = () => {
    setBrowsing(true)
    browseTo(settings.nextcloudBasePath || '/')
  }

  const selectFolder = (path: string) => {
    setSettings(s => ({ ...s, nextcloudBasePath: path }))
    setBrowsing(false)
    toast({ title: 'Dossier sélectionné', description: path })
  }

  const breadcrumbs = browsePath.split('/').filter(Boolean)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Administration
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Cloud className="w-5 h-5 text-blue-500" />
              <h1 className="text-xl font-semibold">NextCloud</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Info card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 space-y-1">
                <p className="font-medium">Configuration partagée entre tous les administrateurs</p>
                <p>Cette connexion NextCloud est commune à tous les administrateurs. Les fichiers liés à un bloc de formulaire sont servis via un proxy sécurisé — les répondants ne voient jamais vos identifiants.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connexion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="w-5 h-5 text-blue-500" />
              Connexion WebDAV
            </CardTitle>
            <CardDescription>
              Utilisez un <strong>mot de passe d'application</strong> NextCloud (Paramètres → Sécurité → Appareils et sessions) plutôt que votre mot de passe principal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nc-url">URL de l'instance NextCloud</Label>
              <Input
                id="nc-url"
                type="url"
                placeholder="https://cloud.monsite.fr"
                value={settings.nextcloudUrl}
                onChange={(e) => { setSettings(s => ({ ...s, nextcloudUrl: e.target.value })); setConnectionStatus('idle') }}
              />
              <p className="text-xs text-gray-500">Ne pas inclure <code>/remote.php/dav/…</code> — l'application le construit automatiquement.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nc-user">Nom d'utilisateur</Label>
              <Input
                id="nc-user"
                placeholder="admin"
                value={settings.nextcloudUser}
                onChange={(e) => { setSettings(s => ({ ...s, nextcloudUser: e.target.value })); setConnectionStatus('idle') }}
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nc-pass">Mot de passe d'application</Label>
              <div className="relative">
                <Input
                  id="nc-pass"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  value={settings.nextcloudPass}
                  onChange={(e) => { setSettings(s => ({ ...s, nextcloudPass: e.target.value })); setConnectionStatus('idle') }}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Status de connexion */}
            {connectionStatus !== 'idle' && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                connectionStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {connectionStatus === 'success'
                  ? <CheckCircle className="w-4 h-4 shrink-0" />
                  : <XCircle className="w-4 h-4 shrink-0" />}
                {connectionMessage}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Tester la connexion
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Dossier racine */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-yellow-500" />
              Dossier racine
            </CardTitle>
            <CardDescription>
              Dossier de départ affiché lors de la sélection d'un fichier depuis le constructeur de formulaires. Laissez <code>/</code> pour afficher tous les fichiers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="nc-base">Chemin</Label>
                <Input
                  id="nc-base"
                  placeholder="/Formulaires"
                  value={settings.nextcloudBasePath}
                  onChange={(e) => setSettings(s => ({ ...s, nextcloudBasePath: e.target.value }))}
                />
              </div>
              <Button
                variant="outline"
                onClick={openBrowser}
                disabled={!settings.nextcloudUrl || !settings.nextcloudUser || !settings.nextcloudPass}
                className="shrink-0"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Parcourir
              </Button>
            </div>

            {/* Navigateur intégré */}
            {browsing && (
              <div className="border rounded-lg overflow-hidden">
                {/* Barre de navigation */}
                <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b text-sm flex-wrap">
                  <button
                    className="text-blue-600 hover:underline font-medium"
                    onClick={() => browseTo('/')}
                  >
                    /
                  </button>
                  {breadcrumbs.map((crumb, i) => {
                    const crumbPath = '/' + breadcrumbs.slice(0, i + 1).join('/')
                    return (
                      <span key={i} className="flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 text-gray-400" />
                        <button
                          className="text-blue-600 hover:underline"
                          onClick={() => browseTo(crumbPath)}
                        >
                          {crumb}
                        </button>
                      </span>
                    )
                  })}
                </div>

                {/* Contenu */}
                <div className="max-h-64 overflow-auto">
                  {browseLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : browseItems.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-8">Dossier vide</p>
                  ) : (
                    <div className="divide-y">
                      {/* Bouton "Utiliser ce dossier" */}
                      <button
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 font-medium"
                        onClick={() => selectFolder(browsePath)}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Utiliser « {browsePath} »
                      </button>
                      {browseItems.map((item) => (
                        <button
                          key={item.path}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 text-left"
                          onClick={() => item.type === 'folder' ? browseTo(item.path) : undefined}
                          disabled={item.type === 'file'}
                        >
                          {item.type === 'folder'
                            ? <Folder className="w-4 h-4 text-yellow-400 shrink-0" />
                            : <FileText className="w-4 h-4 text-gray-400 shrink-0" />}
                          <span className={item.type === 'file' ? 'text-gray-400' : 'text-gray-800'}>
                            {item.name}
                          </span>
                          {item.type === 'folder' && <ChevronRight className="w-3 h-3 text-gray-400 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sauvegarde */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="min-w-32">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
        </div>
      </main>
    </div>
  )
}

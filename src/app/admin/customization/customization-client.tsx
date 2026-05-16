'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Palette,
  Loader2,
  Upload,
  Image,
  Trash2,
} from 'lucide-react'

interface CustomizationSettings {
  siteName: string
  siteLogo: string | null
  siteFavicon: string | null
}

export function CustomizationClient() {
  const { toast } = useToast()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)

  const [settings, setSettings] = useState<CustomizationSettings>({
    siteName: 'FormBuilder',
    siteLogo: null,
    siteFavicon: null,
  })

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings({
          siteName: data.siteName || 'FormBuilder',
          siteLogo: data.siteLogo || null,
          siteFavicon: data.siteFavicon || null,
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

  const handleUpload = async (file: File, type: 'logo' | 'favicon') => {
    const setUploading = type === 'logo' ? setUploadingLogo : setUploadingFavicon
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l\'upload')
      }

      setSettings({
        ...settings,
        [type === 'logo' ? 'siteLogo' : 'siteFavicon']: data.url,
      })

      toast({
        title: 'Image uploadée',
        description: `Le ${type === 'logo' ? 'logo' : 'favicon'} a été mis à jour`,
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = (type: 'logo' | 'favicon') => {
    setSettings({
      ...settings,
      [type === 'logo' ? 'siteLogo' : 'siteFavicon']: null,
    })
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
              <Palette className="w-5 h-5 text-purple-600" />
              <h1 className="text-xl font-semibold">Personnalisation</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Site Name */}
        <Card>
          <CardHeader>
            <CardTitle>Nom du site</CardTitle>
            <CardDescription>
              Le nom qui apparaîtra dans les emails et l'interface
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-md">
              <Label htmlFor="siteName">Nom du site</Label>
              <Input
                id="siteName"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                placeholder="FormBuilder"
              />
            </div>
          </CardContent>
        </Card>

        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>
              Le logo principal du site (recommandé : 200x50 px)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start space-x-6">
              <div className="w-48 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50">
                {settings.siteLogo ? (
                  <img
                    src={settings.siteLogo}
                    alt="Logo"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <Image className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div className="space-y-2">
                <input
                  type="file"
                  ref={logoInputRef}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(file, 'logo')
                  }}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Uploader un logo
                </Button>
                {settings.siteLogo && (
                  <Button
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => handleRemoveImage('logo')}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Favicon */}
        <Card>
          <CardHeader>
            <CardTitle>Favicon</CardTitle>
            <CardDescription>
              L'icône qui apparaît dans l'onglet du navigateur (recommandé : 32x32 px)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start space-x-6">
              <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50">
                {settings.siteFavicon ? (
                  <img
                    src={settings.siteFavicon}
                    alt="Favicon"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <Image className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="space-y-2">
                <input
                  type="file"
                  ref={faviconInputRef}
                  accept="image/*,.ico"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(file, 'favicon')
                  }}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={uploadingFavicon}
                >
                  {uploadingFavicon ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Uploader un favicon
                </Button>
                {settings.siteFavicon && (
                  <Button
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => handleRemoveImage('favicon')}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Aperçu</CardTitle>
            <CardDescription>
              Voici comment votre site apparaîtra
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-6 bg-white">
              <div className="flex items-center space-x-3">
                {settings.siteLogo ? (
                  <img src={settings.siteLogo} alt="Logo" className="h-10 object-contain" />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-lg font-bold">
                      {settings.siteName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-xl font-semibold">{settings.siteName}</span>
              </div>
            </div>
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

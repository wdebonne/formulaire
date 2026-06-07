'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { cn, getLoginBackgroundStyle } from '@/lib/utils'
import type { LoginPageSettings, BackgroundType, GradientDirection } from '@/types/form'
import {
  ArrowLeft,
  Palette,
  Loader2,
  Upload,
  Image,
  Trash2,
} from 'lucide-react'

const loginBackgroundTypeOptions: { value: BackgroundType; label: string }[] = [
  { value: 'solid', label: 'Couleur unie' },
  { value: 'gradient', label: 'Dégradé' },
  { value: 'image', label: 'Image' },
]

const loginGradientDirectionOptions: { value: GradientDirection; label: string }[] = [
  { value: 'to-right', label: '→ Droite' },
  { value: 'to-left', label: '← Gauche' },
  { value: 'to-bottom', label: '↓ Bas' },
  { value: 'to-top', label: '↑ Haut' },
  { value: 'to-bottom-right', label: '↘ Bas-Droite' },
  { value: 'to-bottom-left', label: '↙ Bas-Gauche' },
  { value: 'to-top-right', label: '↗ Haut-Droite' },
  { value: 'to-top-left', label: '↖ Haut-Gauche' },
]

interface CustomizationSettings {
  siteName: string
  siteLogo: string | null
  siteFavicon: string | null
  registrationEnabled: boolean
  loginPageSettings: LoginPageSettings
}

export function CustomizationClient() {
  const { toast } = useToast()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)
  const loginBgInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [uploadingLoginBg, setUploadingLoginBg] = useState(false)

  const [settings, setSettings] = useState<CustomizationSettings>({
    siteName: 'FormBuilder',
    siteLogo: null,
    siteFavicon: null,
    registrationEnabled: true,
    loginPageSettings: {},
  })

  const updateLoginPageSettings = (patch: Partial<LoginPageSettings>) => {
    setSettings((prev) => ({ ...prev, loginPageSettings: { ...prev.loginPageSettings, ...patch } }))
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings({
          siteName: data.siteName || 'FormBuilder',
          siteLogo: data.siteLogo || null,
          siteFavicon: data.siteFavicon || null,
          registrationEnabled: data.registrationEnabled !== false,
          loginPageSettings: data.loginPageSettings || {},
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

  const handleLoginBgUpload = async (file: File) => {
    setUploadingLoginBg(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'upload")
      }

      updateLoginPageSettings({ backgroundImage: data.url })

      toast({
        title: 'Image uploadée',
        description: "L'image de fond de la page de connexion a été mise à jour",
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setUploadingLoginBg(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const loginBackgroundPreview = getLoginBackgroundStyle(settings.loginPageSettings)

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

        {/* Login page */}
        <Card>
          <CardHeader>
            <CardTitle>Page de connexion</CardTitle>
            <CardDescription>
              Personnalisez l'apparence et les liens affichés sur la page de connexion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Afficher "Mot de passe oublié ?"</p>
                  <p className="text-sm text-gray-500">
                    Le lien de récupération de mot de passe sous le formulaire de connexion
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.loginPageSettings.showForgotPassword ?? true}
                    onChange={(e) => updateLoginPageSettings({ showForgotPassword: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Autoriser les inscriptions</p>
                  <p className="text-sm text-gray-500">
                    Affiche le lien "S'inscrire" sur la page de connexion — identique au réglage de Paramètres généraux
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
            </div>

            <div className="space-y-2">
              <Label>Arrière-plan</Label>
              <div className="flex gap-2 max-w-md">
                {loginBackgroundTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateLoginPageSettings({ backgroundType: option.value })}
                    className={`flex-1 px-3 py-2 text-sm border-2 transition-all rounded ${
                      (settings.loginPageSettings.backgroundType || 'gradient') === option.value
                        ? 'border-primary bg-primary/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {settings.loginPageSettings.backgroundType === 'solid' && (
              <div className="space-y-2 max-w-md">
                <Label>Couleur de fond</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={settings.loginPageSettings.backgroundColor || '#7c3aed'}
                    onChange={(e) => updateLoginPageSettings({ backgroundColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={settings.loginPageSettings.backgroundColor || '#7c3aed'}
                    onChange={(e) => updateLoginPageSettings({ backgroundColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>
            )}

            {(!settings.loginPageSettings.backgroundType || settings.loginPageSettings.backgroundType === 'gradient') && (
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label>Direction du dégradé</Label>
                  <select
                    value={settings.loginPageSettings.gradientDirection || 'to-bottom-right'}
                    onChange={(e) => updateLoginPageSettings({ gradientDirection: e.target.value as GradientDirection })}
                    className="w-full px-3 py-2 text-sm border rounded-md"
                  >
                    {loginGradientDirectionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Couleur de départ</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={settings.loginPageSettings.gradientStartColor || '#a855f7'}
                      onChange={(e) => updateLoginPageSettings({ gradientStartColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={settings.loginPageSettings.gradientStartColor || '#a855f7'}
                      onChange={(e) => updateLoginPageSettings({ gradientStartColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Couleur de fin</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={settings.loginPageSettings.gradientEndColor || '#4338ca'}
                      onChange={(e) => updateLoginPageSettings({ gradientEndColor: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer"
                    />
                    <Input
                      value={settings.loginPageSettings.gradientEndColor || '#4338ca'}
                      onChange={(e) => updateLoginPageSettings({ gradientEndColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {settings.loginPageSettings.backgroundType === 'image' && (
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label>Image de fond</Label>
                  <div className="flex items-start space-x-6">
                    <div className="w-32 h-20 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                      {settings.loginPageSettings.backgroundImage ? (
                        <div
                          className="w-full h-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${settings.loginPageSettings.backgroundImage})` }}
                        />
                      ) : (
                        <Image className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        type="file"
                        ref={loginBgInputRef}
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleLoginBgUpload(file)
                        }}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => loginBgInputRef.current?.click()}
                        disabled={uploadingLoginBg}
                      >
                        {uploadingLoginBg ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        Uploader une image
                      </Button>
                      {settings.loginPageSettings.backgroundImage && (
                        <Button
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => updateLoginPageSettings({ backgroundImage: undefined })}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Flou — effet fondu ({settings.loginPageSettings.backgroundBlur ?? 0}px)</Label>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={settings.loginPageSettings.backgroundBlur ?? 0}
                    onChange={(e) => updateLoginPageSettings({ backgroundBlur: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Net</span>
                    <span>Très flou</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Aperçu de la page de connexion</Label>
              <div
                className={cn(
                  'relative h-40 rounded-lg overflow-hidden border flex items-center justify-center',
                  loginBackgroundPreview.className
                )}
                style={loginBackgroundPreview.style}
              >
                {loginBackgroundPreview.imageLayerStyle && <div style={loginBackgroundPreview.imageLayerStyle} />}
                <div className="relative z-10 bg-white rounded-md shadow px-6 py-3 text-sm font-medium text-gray-700">
                  Connectez-vous à votre compte
                </div>
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

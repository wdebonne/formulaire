'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import type { SystemDocumentSettings } from '@/types/form'
import {
  ArrowLeft,
  CheckCircle,
  FileType2,
  Loader2,
  Plug,
  XCircle,
} from 'lucide-react'

export function DocumentsSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [settings, setSettings] = useState<SystemDocumentSettings>({})
  const [url, setUrl] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/documents')
        if (res.ok) {
          const data: SystemDocumentSettings = await res.json()
          setSettings(data)
          setUrl(data.pdfConverterUrl ?? '')
        }
      } catch (error) {
        console.error('Error fetching document settings:', error)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Enregistrer une adresse différente invalide la vérification côté serveur : les options PDF
  // se referment jusqu'au prochain test concluant.
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfConverterUrl: url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Enregistrement impossible')
      setSettings(data)
      toast({ title: 'Adresse enregistrée' })
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/admin/documents/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfConverterUrl: url }),
      })
      const data = await res.json()

      const refreshed = await fetch('/api/admin/documents')
      if (refreshed.ok) setSettings(await refreshed.json())

      if (data.success) {
        toast({
          title: 'Connexion réussie',
          description: data.version
            ? `Service joignable (version ${data.version})`
            : 'Service joignable',
        })
      } else {
        toast({
          title: 'Échec de connexion',
          description: data.error || 'Service injoignable',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  const verified = Boolean(settings.pdfConverterUrl && settings.pdfConverterVerified)
  const urlChanged = url.trim().replace(/\/+$/, '') !== (settings.pdfConverterUrl ?? '')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <FileType2 className="w-5 h-5 text-blue-600" />
              <h1 className="text-xl font-semibold">Documents</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Convertisseur PDF externe</CardTitle>
            <CardDescription>
              Les modèles Word sont remplis par l’application elle-même. La conversion en PDF, qui
              suppose LibreOffice, est déléguée à un conteneur séparé afin de ne pas alourdir
              l’image applicative. Sans convertisseur vérifié, les documents sont envoyés au
              format .docx.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="converterUrl">Adresse du service</Label>
              <Input
                id="converterUrl"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://gotenberg:3000"
              />
              <p className="text-xs text-gray-500">
                Service compatible Gotenberg : l’application interroge <code>/health</code> pour
                le test et <code>/forms/libreoffice/convert</code> pour la conversion.
              </p>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                verified ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {verified ? (
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                )}
                <div className="text-sm">
                  <p className={`font-medium ${verified ? 'text-green-800' : 'text-gray-700'}`}>
                    {verified ? 'Convertisseur vérifié' : 'Convertisseur non vérifié'}
                  </p>
                  <p className={verified ? 'text-green-700' : 'text-gray-500'}>
                    {verified
                      ? `L’option PDF est proposée dans les modèles de document.${
                          settings.pdfConverterVerifiedAt
                            ? ` Dernier test réussi le ${new Date(
                                settings.pdfConverterVerifiedAt
                              ).toLocaleString('fr-FR')}.`
                            : ''
                        }`
                      : 'Les options PDF restent masquées dans les formulaires tant qu’un test de connexion n’a pas abouti.'}
                  </p>
                  {verified && settings.pdfConverterVersion && (
                    <p className="mt-1 text-xs text-green-700">
                      Version rapportée : {settings.pdfConverterVersion}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {urlChanged && settings.pdfConverterUrl && (
              <p className="text-xs text-amber-700">
                L’adresse a été modifiée : enregistrez-la, puis relancez un test pour rouvrir les
                options PDF.
              </p>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="outline" onClick={handleTest} disabled={testing || !url.trim()}>
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="mr-2 h-4 w-4" />
                )}
                Tester la connexion
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mise en service</CardTitle>
            <CardDescription>
              Exemple de service à ajouter à votre <code>docker-compose.yml</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400">
              {`  gotenberg:
    image: gotenberg/gotenberg:8
    container_name: gotenberg
    restart: unless-stopped`}
            </pre>
            <p className="mt-3 text-sm text-gray-600">
              Les deux conteneurs partageant le réseau Compose, l’adresse à renseigner ci-dessus
              est <code>http://gotenberg:3000</code>. N’exposez pas ce port publiquement : le
              service n’a pas d’authentification.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

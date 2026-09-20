'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import type { PdfConverterProvider, SystemDocumentSettings } from '@/types/form'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Cloud,
  Download,
  FileType2,
  Loader2,
  Plug,
  Server,
  Wand2,
  XCircle,
} from 'lucide-react'

interface NextcloudSummary {
  configured: boolean
  url?: string
  user?: string
  basePath?: string
}

interface DocumentSettingsView extends SystemDocumentSettings {
  nextcloud?: NextcloudSummary
}

interface ConversionResult {
  success: boolean
  method?: string
  bytes?: number
  pdfBase64?: string
  error?: string
}

const PROVIDERS: Array<{
  value: PdfConverterProvider
  title: string
  subtitle: string
  icon: typeof Cloud
}> = [
  {
    value: 'nextcloud',
    title: 'NextCloud',
    subtitle: 'Le serveur bureautique déjà branché — Euro-Office, ONLYOFFICE, Nextcloud Office',
    icon: Cloud,
  },
  {
    value: 'gotenberg',
    title: 'Gotenberg',
    subtitle: 'Un conteneur LibreOffice dédié, à ajouter au docker-compose',
    icon: Server,
  },
]

export function DocumentsSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [converting, setConverting] = useState(false)
  const [settings, setSettings] = useState<DocumentSettingsView>({})
  const [provider, setProvider] = useState<PdfConverterProvider>('gotenberg')
  const [url, setUrl] = useState('')
  const [conversion, setConversion] = useState<ConversionResult | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/documents')
        if (res.ok) {
          const data: DocumentSettingsView = await res.json()
          setSettings(data)
          setProvider(data.pdfConverterProvider === 'nextcloud' ? 'nextcloud' : 'gotenberg')
          setUrl(data.pdfConverterUrl ?? '')
        }
      } catch (error) {
        console.error('Error fetching document settings:', error)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const refresh = async () => {
    const res = await fetch('/api/admin/documents')
    if (res.ok) setSettings(await res.json())
  }

  // Enregistrer un moteur ou une adresse différents invalide la vérification côté serveur : les
  // options PDF se referment jusqu'au prochain test concluant.
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfConverterProvider: provider, pdfConverterUrl: url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Enregistrement impossible')
      setSettings(data)
      toast({ title: 'Réglage enregistré' })
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
        body: JSON.stringify({ pdfConverterProvider: provider, pdfConverterUrl: url }),
      })
      const data = await res.json()
      await refresh()

      if (data.success) {
        const details = [
          data.version && `version ${data.version}`,
          data.office?.length && `applications : ${data.office.join(', ')}`,
        ].filter(Boolean)
        toast({
          title: 'Connexion réussie',
          description: details.length ? `Service joignable (${details.join(' — ')})` : 'Service joignable',
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

  const handleConversionTest = async () => {
    setConverting(true)
    setConversion(null)
    try {
      const res = await fetch('/api/admin/documents/test-conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfConverterProvider: provider, pdfConverterUrl: url }),
      })
      const data: ConversionResult = await res.json()
      setConversion(data)
      await refresh()

      if (data.success) {
        toast({
          title: 'Conversion réussie',
          description: `Document témoin converti par ${data.method ?? 'le service'}`,
        })
      } else {
        toast({
          title: 'Conversion impossible',
          description: data.error || 'Le document témoin n’a pas pu être converti',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setConverting(false)
    }
  }

  // Le PDF produit est rendu en base64 par la route de test : l'ouvrir est le seul moyen de
  // vérifier qu'une conversion « réussie » n'a pas rendu une page blanche.
  const downloadProbe = () => {
    if (!conversion?.pdfBase64) return
    const bytes = Uint8Array.from(atob(conversion.pdfBase64), (c) => c.charCodeAt(0))
    const href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = href
    link.download = 'verification-conversion.pdf'
    link.click()
    URL.revokeObjectURL(href)
  }

  const savedProvider: PdfConverterProvider =
    settings.pdfConverterProvider === 'nextcloud' ? 'nextcloud' : 'gotenberg'
  const verified = Boolean(settings.pdfConverterVerified)
  const nextcloud = settings.nextcloud
  const nextcloudMissing = provider === 'nextcloud' && !nextcloud?.configured

  const pendingChange =
    provider !== savedProvider ||
    (provider === 'gotenberg' && url.trim().replace(/\/+$/, '') !== (settings.pdfConverterUrl ?? ''))

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
            <CardTitle>Conversion en PDF</CardTitle>
            <CardDescription>
              Les modèles Word sont remplis par l’application elle-même. La conversion en PDF, qui
              suppose un moteur bureautique, est déléguée à un service extérieur. Sans conversion
              vérifiée, les documents sont envoyés au format .docx.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Moteur de conversion</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                {PROVIDERS.map((option) => {
                  const Icon = option.icon
                  const active = provider === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setProvider(option.value)}
                      className={`rounded-xl border p-4 text-left transition ${
                        active
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className="font-medium text-sm text-gray-900">{option.title}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-gray-600">{option.subtitle}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {provider === 'nextcloud' ? (
              <div className="space-y-2">
                <Label>Instance utilisée</Label>
                {nextcloud?.configured ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
                    <p className="font-medium text-gray-900">{nextcloud.url}</p>
                    <p className="text-gray-600">
                      Compte {nextcloud.user} — dossier {nextcloud.basePath}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      Les identifiants sont ceux d’
                      <Link href="/admin/nextcloud" className="text-blue-600 hover:underline">
                        Administration › NextCloud
                      </Link>
                      . Le document à convertir est déposé dans un sous-dossier
                      <code className="mx-1">.formbuilder-conversion</code>, puis retiré aussitôt —
                      y compris en cas d’échec.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <p className="text-amber-800">
                        Aucun NextCloud n’est configuré. Renseignez l’adresse, le compte et le mot
                        de passe d’application dans{' '}
                        <Link href="/admin/nextcloud" className="font-medium hover:underline">
                          Administration › NextCloud
                        </Link>
                        , puis revenez ici.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
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
                  le test de connexion et <code>/forms/libreoffice/convert</code> pour la
                  conversion.
                </p>
              </div>
            )}

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
                    {verified ? 'Conversion PDF disponible' : 'Conversion PDF indisponible'}
                  </p>
                  <p className={verified ? 'text-green-700' : 'text-gray-500'}>
                    {verified
                      ? 'L’option PDF est proposée dans les modèles de document.'
                      : 'Les options PDF restent masquées dans les formulaires tant qu’un test n’a pas abouti.'}
                  </p>
                  {settings.pdfConversionVerifiedAt && (
                    <p className="mt-1 text-xs text-green-700">
                      Dernière conversion éprouvée le{' '}
                      {new Date(settings.pdfConversionVerifiedAt).toLocaleString('fr-FR')}
                      {settings.pdfConversionMethod ? ` — ${settings.pdfConversionMethod}` : ''}
                    </p>
                  )}
                  {savedProvider === 'gotenberg' && settings.pdfConverterVersion && (
                    <p className="mt-1 text-xs text-green-700">
                      Version rapportée : {settings.pdfConverterVersion}
                    </p>
                  )}
                  {savedProvider === 'nextcloud' && !settings.pdfConversionVerifiedAt && (
                    <p className="mt-1 text-xs text-gray-500">
                      Une instance NextCloud joignable ne prouve pas qu’un serveur bureautique lui
                      est branché : c’est le test de conversion qui ouvre l’option PDF.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {conversion && (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  conversion.success
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {conversion.success ? (
                    <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  )}
                  <div className="min-w-0 flex-1">
                    {conversion.success ? (
                      <>
                        <p className="font-medium text-green-800">
                          Document témoin converti par {conversion.method}
                        </p>
                        <p className="text-green-700">
                          PDF de {Math.max(1, Math.round((conversion.bytes ?? 0) / 1024))} Ko
                          produit. Ouvrez-le pour vérifier qu’il porte bien le texte attendu.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={downloadProbe}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger le PDF produit
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-red-800">Conversion impossible</p>
                        <p className="break-words text-red-700">{conversion.error}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {pendingChange && (
              <p className="text-xs text-amber-700">
                Le réglage a été modifié : enregistrez-le, puis relancez un test pour rouvrir les
                options PDF.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing || nextcloudMissing || (provider === 'gotenberg' && !url.trim())}
                >
                  {testing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plug className="mr-2 h-4 w-4" />
                  )}
                  Tester la connexion
                </Button>
                <Button
                  variant="outline"
                  onClick={handleConversionTest}
                  disabled={
                    converting || nextcloudMissing || (provider === 'gotenberg' && !url.trim())
                  }
                >
                  {converting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  Tester la conversion
                </Button>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>

        {provider === 'nextcloud' ? (
          <Card>
            <CardHeader>
              <CardTitle>Comment la conversion se déroule</CardTitle>
              <CardDescription>
                Aucun conteneur à ajouter : c’est le serveur bureautique de votre NextCloud qui
                travaille.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p>
                Le document rempli est déposé sur le NextCloud, converti par le serveur
                bureautique, rapatrié, puis les deux fichiers sont effacés. Trois chemins sont
                essayés dans l’ordre — connecteur <code>eurooffice</code>, connecteur{' '}
                <code>onlyoffice</code>, puis l’API de conversion de NextCloud, qui sert Nextcloud
                Office. Le test indique lequel a répondu.
              </p>
              <p>
                Euro-Office étant un fork d’ONLYOFFICE Docs, son connecteur porte un identifiant
                d’application différent : les deux sont tentés, un connecteur absent ne coûtant
                qu’un 404.
              </p>
              <p>
                Si la conversion échoue au moment d’un envoi réel, le <strong>.docx</strong> rempli
                part à la place du PDF et la réponse conserve la raison de l’échec — un serveur
                bureautique en panne ne fait perdre aucun envoi.
              </p>
            </CardContent>
          </Card>
        ) : (
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
        )}
      </main>
    </div>
  )
}

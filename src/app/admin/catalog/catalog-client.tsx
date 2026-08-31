'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import type { CatalogItem } from '@/lib/catalog'
import {
  ArrowLeft,
  Boxes,
  CheckCircle,
  Loader2,
  Plug,
  RefreshCw,
  XCircle,
} from 'lucide-react'

interface Service {
  id: number
  name: string
  slug: string
}

interface Categorie {
  id: number
  name: string
}

interface Reglages {
  apiUrl: string
  hasToken: boolean
  verified: boolean
  verifiedAt?: string
  verifiedServiceCount?: number
  verifiedItemCount?: number
  source: 'settings' | 'env' | null
  envUrl: string
}

interface Apercu {
  dateFrom: string
  dateTo: string
  items: CatalogItem[]
  services: Service[]
  categories: Categorie[]
}

const selectCls =
  'w-full h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function aujourdhui(): string {
  const maintenant = new Date()
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0')
  const jour = String(maintenant.getDate()).padStart(2, '0')
  return `${maintenant.getFullYear()}-${mois}-${jour}`
}

export function CatalogSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [reglages, setReglages] = useState<Reglages | null>(null)
  const [url, setUrl] = useState('')
  const [jeton, setJeton] = useState('')

  const [service, setService] = useState('')
  const [nature, setNature] = useState('all')
  const [categorie, setCategorie] = useState('')
  const [dateFrom, setDateFrom] = useState(aujourdhui)
  const [dateTo, setDateTo] = useState(aujourdhui)

  const [apercu, setApercu] = useState<Apercu | null>(null)
  const [chargementApercu, setChargementApercu] = useState(false)
  const [erreurApercu, setErreurApercu] = useState<string | null>(null)

  const chargerApercu = useCallback(async () => {
    setChargementApercu(true)
    setErreurApercu(null)
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
      if (service) params.set('service', service)
      if (nature !== 'all') params.set('kind', nature)
      if (categorie) params.set('category_id', categorie)

      const res = await fetch(`/api/admin/catalog/preview?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Aperçu impossible')
      setApercu(data)
    } catch (error: any) {
      setApercu(null)
      setErreurApercu(error.message)
    } finally {
      setChargementApercu(false)
    }
  }, [dateFrom, dateTo, service, nature, categorie])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/catalog')
        if (res.ok) {
          const data: Reglages = await res.json()
          setReglages(data)
          setUrl(data.apiUrl)
          // Un catalogue déjà raccordé montre ce qu'il répond sans qu'on le demande : c'est la
          // question qui amène ici, et la réponse tient en une requête en lecture.
          if (data.source) void chargerApercu()
        }
      } catch (error) {
        console.error('Error fetching catalog settings:', error)
      } finally {
        setLoading(false)
      }
    })()
    // Volontairement au montage seulement : les filtres ont leur propre bouton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/catalog', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl: url, apiToken: jeton }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Enregistrement impossible')
      setReglages(data)
      setJeton('')
      toast({ title: 'Raccordement enregistré' })
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/admin/catalog/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl: url, apiToken: jeton }),
      })
      const data = await res.json()
      if (data.settings) setReglages(data.settings)

      if (data.success) {
        setJeton('')
        toast({
          title: 'Connexion réussie',
          description: `${data.services?.length ?? 0} service(s), ${data.categories?.length ?? 0} catégorie(s), ${data.itemCount ?? 0} article(s) aujourd'hui`,
        })
        await chargerApercu()
      } else {
        toast({
          title: 'Échec de connexion',
          description: data.error || 'Catalogue injoignable',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  const verifie = Boolean(reglages?.verified)
  const modifie =
    url.trim().replace(/\/+$/, '') !== (reglages?.apiUrl ?? '') || jeton.trim().length > 0

  const services = apercu?.services ?? []
  const categories = apercu?.categories ?? []
  const articles = apercu?.items ?? []
  // Une prestation n'a pas de disponible à comparer : elle est demandée puis réalisée, jamais
  // épuisée. La compter parmi les indisponibles ferait chercher une rupture qui n'existe pas.
  const indisponibles = articles.filter(
    (item) => item.available !== null && item.available <= 0
  ).length

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Boxes className="w-5 h-5 text-amber-600" />
              <h1 className="text-xl font-semibold">Catalogue</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Application de gestion</CardTitle>
            <CardDescription>
              Un bloc de choix multiple ou de liste déroulante peut tirer ses options d’ici plutôt
              que d’une liste saisie à la main : le matériel et les prestations d’un service, avec
              ce qu’il en reste à la date choisie dans le formulaire. Sans raccordement, ces blocs
              annoncent une liste indisponible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="catalogUrl">Adresse de l’application</Label>
              <Input
                id="catalogUrl"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://materiels.example.com"
              />
              <p className="text-xs text-gray-500">
                Racine du site, sans <code>/api</code> : l’application interroge{' '}
                <code>/api/services</code>, <code>/api/categories</code> et{' '}
                <code>/api/manifestations/catalogue</code>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="catalogToken">Jeton d’API</Label>
              <Input
                id="catalogToken"
                type="password"
                autoComplete="new-password"
                value={jeton}
                onChange={(e) => setJeton(e.target.value)}
                placeholder={
                  reglages?.hasToken
                    ? 'Jeton enregistré — laisser vide pour le conserver'
                    : 'Jeton en lecture seule'
                }
              />
              <p className="text-xs text-gray-500">
                À créer côté application de gestion (Réglages → jetons d’API), en lecture seule et
                depuis un compte administrateur : la portée d’un jeton est celle de son créateur, et
                un compte restreint amputerait la liste sans rien dire. Le jeton reste sur le
                serveur — ni le navigateur du répondant, ni cet écran ne le relisent.
              </p>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                verifie ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {verifie ? (
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                )}
                <div className="text-sm">
                  <p className={`font-medium ${verifie ? 'text-green-800' : 'text-gray-700'}`}>
                    {verifie ? 'Raccordement vérifié' : 'Raccordement non vérifié'}
                  </p>
                  <p className={verifie ? 'text-green-700' : 'text-gray-500'}>
                    {verifie
                      ? `Dernier test réussi${
                          reglages?.verifiedAt
                            ? ` le ${new Date(reglages.verifiedAt).toLocaleString('fr-FR')}`
                            : ''
                        } : ${reglages?.verifiedServiceCount ?? 0} service(s), ${
                          reglages?.verifiedItemCount ?? 0
                        } article(s) ce jour-là.`
                      : 'Le test n’a pas encore abouti. Les formulaires interrogent tout de même le catalogue si une adresse et un jeton sont enregistrés — le test rend compte, il ne conditionne rien.'}
                  </p>
                </div>
              </div>
            </div>

            {reglages?.source === 'env' && (
              <p className="text-xs text-amber-700">
                Le catalogue est actuellement raccordé par les variables d’environnement
                {reglages.envUrl ? ` (${reglages.envUrl})` : ''}, d’où les champs vides ci-dessus.
                Ce qui est enregistré ici prendra le dessus.
              </p>
            )}

            {modifie && reglages?.apiUrl && (
              <p className="text-xs text-amber-700">
                Le raccordement a été modifié : enregistrez-le, puis relancez un test.
              </p>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing || !url.trim() || (!jeton.trim() && !reglages?.hasToken)}
              >
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
            <CardTitle>Ce que répond le catalogue</CardTitle>
            <CardDescription>
              La liste telle qu’un bloc la recevra, filtres compris. Le tri est demandé à
              l’application de gestion, comme le fait le formulaire : ce qui s’affiche ici est donc
              ce que verra le répondant, et non une approximation calculée sur place.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Service</Label>
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Tous les services</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nature</Label>
                <select
                  value={nature}
                  onChange={(e) => setNature(e.target.value)}
                  className={selectCls}
                >
                  <option value="all">Matériels et prestations</option>
                  <option value="prestation">Prestations seulement</option>
                  <option value="materiel">Matériels seulement</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Catégorie</Label>
                <select
                  value={categorie}
                  onChange={(e) => setCategorie(e.target.value)}
                  className={selectCls}
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Du</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Au</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-gray-600">
                {apercu
                  ? `${articles.length} article(s)${
                      indisponibles ? `, dont ${indisponibles} sans disponibilité` : ''
                    }`
                  : 'Aucune interrogation pour le moment.'}
              </p>
              <Button variant="outline" onClick={chargerApercu} disabled={chargementApercu}>
                {chargementApercu ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Interroger
              </Button>
            </div>

            {erreurApercu && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {erreurApercu}
              </p>
            )}

            {apercu && articles.length === 0 && !erreurApercu && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Le catalogue n’a rien renvoyé pour ce périmètre. Un bloc réglé ainsi afficherait une
                liste vide : élargissez le service, la nature ou la catégorie.
              </p>
            )}

            {articles.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Article</th>
                      <th className="px-3 py-2 font-medium">Catégorie</th>
                      <th className="px-3 py-2 font-medium">Unité</th>
                      <th className="px-3 py-2 text-right font-medium">Disponible</th>
                      <th className="px-3 py-2 text-right font-medium">Parc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {articles.map((item) => {
                      const epuise = item.available !== null && item.available <= 0
                      return (
                        <tr key={item.ref} className={epuise ? 'bg-gray-50' : undefined}>
                          <td className="px-3 py-2">
                            {item.name}
                            {item.is_prestation && (
                              <span className="ml-2 text-xs text-purple-600">prestation</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{item.category || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{item.unit || '—'}</td>
                          <td
                            className={`px-3 py-2 text-right font-medium ${
                              epuise ? 'text-gray-400' : 'text-gray-900'
                            }`}
                          >
                            {/* Sans limite : une prestation ne se compte pas, l'annoncer à zéro
                                laisserait croire qu'elle n'est plus proposable. */}
                            {item.available ?? 'sans limite'}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-500">{item.total ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {apercu && (
              <p className="text-xs text-gray-500">
                Disponibilité calculée sur la période du{' '}
                {new Date(`${apercu.dateFrom}T00:00`).toLocaleDateString('fr-FR')} au{' '}
                {new Date(`${apercu.dateTo}T00:00`).toLocaleDateString('fr-FR')}, engagements déjà
                pris déduits. Les articles à zéro sont montrés ici, alors qu’un bloc réglé sur
                « masquer ce qui n’est plus disponible » les écarte.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

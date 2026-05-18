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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Type,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Font {
  id: string
  name: string
  family: string
  source: string
  url: string | null
  weights: number[]
  isDefault: boolean
  createdAt: string
}

// Liste de polices Google populaires pour suggestion
const googleFontsSuggestions = [
  { name: 'Dancing Script', family: 'Dancing Script', category: 'Cursive' },
  { name: 'Pacifico', family: 'Pacifico', category: 'Cursive' },
  { name: 'Lobster', family: 'Lobster', category: 'Display' },
  { name: 'Bebas Neue', family: 'Bebas Neue', category: 'Sans-serif' },
  { name: 'Comfortaa', family: 'Comfortaa', category: 'Display' },
  { name: 'Abril Fatface', family: 'Abril Fatface', category: 'Display' },
  { name: 'Righteous', family: 'Righteous', category: 'Display' },
  { name: 'Satisfy', family: 'Satisfy', category: 'Cursive' },
  { name: 'Permanent Marker', family: 'Permanent Marker', category: 'Handwriting' },
  { name: 'Indie Flower', family: 'Indie Flower', category: 'Handwriting' },
  { name: 'Shadows Into Light', family: 'Shadows Into Light', category: 'Handwriting' },
  { name: 'Amatic SC', family: 'Amatic SC', category: 'Handwriting' },
  { name: 'Courgette', family: 'Courgette', category: 'Handwriting' },
  { name: 'Great Vibes', family: 'Great Vibes', category: 'Cursive' },
  { name: 'Architects Daughter', family: 'Architects Daughter', category: 'Handwriting' },
  { name: 'Cinzel', family: 'Cinzel', category: 'Serif' },
  { name: 'Josefin Sans', family: 'Josefin Sans', category: 'Sans-serif' },
  { name: 'Barlow', family: 'Barlow', category: 'Sans-serif' },
  { name: 'DM Sans', family: 'DM Sans', category: 'Sans-serif' },
  { name: 'Space Grotesk', family: 'Space Grotesk', category: 'Sans-serif' },
]

export function FontsClient() {
  const [fonts, setFonts] = useState<Font[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedFont, setSelectedFont] = useState<Font | null>(null)
  const [newFont, setNewFont] = useState({
    name: '',
    family: '',
    source: 'google',
    weights: [400, 700],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [fontPreviewLoaded, setFontPreviewLoaded] = useState<boolean | null>(null)
  const { toast } = useToast()

  // Charger dynamiquement la police du dialog en temps réel
  useEffect(() => {
    if (!newFont.family) {
      setFontPreviewLoaded(null)
      return
    }

    setFontPreviewLoaded(null)
    const family = newFont.family.trim().replace(/ /g, '+')
    const href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;700&display=swap`
    const linkId = 'google-fonts-dialog-preview'

    let link = document.getElementById(linkId) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = linkId
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    link.href = href

    // Vérifier si la police a bien été chargée
    link.onload = async () => {
      try {
        const loaded = await document.fonts.load(`16px "${newFont.family.trim()}"`)
        setFontPreviewLoaded(loaded.length > 0)
      } catch {
        setFontPreviewLoaded(false)
      }
    }
    link.onerror = () => setFontPreviewLoaded(false)
  }, [newFont.family])

  // Charger les polices Google dynamiquement
  useEffect(() => {
    const loadGoogleFonts = () => {
      // Charger les polices pour l'aperçu
      const fontsToLoad = [...fonts.filter(f => f.source === 'google').map(f => f.family), ...googleFontsSuggestions.map(f => f.family)]
      const uniqueFonts = Array.from(new Set(fontsToLoad))
      
      if (uniqueFonts.length > 0) {
        const link = document.getElementById('google-fonts-preview') as HTMLLinkElement
        if (link) {
          link.href = `https://fonts.googleapis.com/css2?${uniqueFonts.map(f => `family=${f.replace(/ /g, '+')}:wght@400;700`).join('&')}&display=swap`
        } else {
          const newLink = document.createElement('link')
          newLink.id = 'google-fonts-preview'
          newLink.rel = 'stylesheet'
          newLink.href = `https://fonts.googleapis.com/css2?${uniqueFonts.map(f => `family=${f.replace(/ /g, '+')}:wght@400;700`).join('&')}&display=swap`
          document.head.appendChild(newLink)
        }
      }
    }

    loadGoogleFonts()
  }, [fonts])

  const fetchFonts = async () => {
    try {
      const res = await fetch('/api/admin/fonts')
      if (res.ok) {
        const data = await res.json()
        setFonts(data)
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les polices',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFonts()
  }, [])

  const handleSeedFonts = async () => {
    setIsSeeding(true)
    try {
      const res = await fetch('/api/admin/fonts/seed', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        toast({
          title: 'Polices initialisées',
          description: data.message,
        })
        fetchFonts()
      } else {
        throw new Error()
      }
    } catch (error) {
      toast({
        title: 'Erreur',
        description: "Impossible d'initialiser les polices",
        variant: 'destructive',
      })
    } finally {
      setIsSeeding(false)
    }
  }

  const handleAddFont = async () => {
    if (!newFont.name || !newFont.family) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs obligatoires',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/fonts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFont),
      })

      if (res.ok) {
        toast({
          title: 'Police ajoutée',
          description: `La police "${newFont.name}" a été ajoutée avec succès`,
        })
        setIsAddDialogOpen(false)
        setNewFont({ name: '', family: '', source: 'google', weights: [400, 700] })
        setFontPreviewLoaded(null)
        fetchFonts()
      } else {
        const error = await res.json()
        throw new Error(error.error || 'Erreur inconnue')
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || "Impossible d'ajouter la police",
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteFont = async () => {
    if (!selectedFont) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/fonts/${selectedFont.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast({
          title: 'Police supprimée',
          description: `La police "${selectedFont.name}" a été supprimée`,
        })
        setIsDeleteDialogOpen(false)
        setSelectedFont(null)
        fetchFonts()
      } else {
        const error = await res.json()
        throw new Error(error.error || 'Erreur inconnue')
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer la police',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSelectSuggestion = (suggestion: typeof googleFontsSuggestions[0]) => {
    setNewFont({
      ...newFont,
      name: suggestion.name,
      family: suggestion.family,
    })
  }

  const filteredFonts = fonts.filter(
    (font) =>
      font.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      font.family.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredSuggestions = googleFontsSuggestions.filter(
    (font) =>
      !fonts.some((f) => f.family === font.family) &&
      (font.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        font.family.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <Type className="w-5 h-5 text-pink-600" />
                <h1 className="text-xl font-semibold">Gestion des polices</h1>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {fonts.length === 0 && (
                <Button
                  variant="outline"
                  onClick={handleSeedFonts}
                  disabled={isSeeding}
                >
                  {isSeeding ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Initialiser les polices
                </Button>
              )}
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une police
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Rechercher une police..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Polices installées */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">
                Polices installées ({filteredFonts.length})
              </h2>
              
              {filteredFonts.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Type className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 mb-4">
                      Aucune police installée. Initialisez les polices par défaut ou ajoutez-en une nouvelle.
                    </p>
                    <Button onClick={handleSeedFonts} disabled={isSeeding}>
                      {isSeeding ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Initialiser les polices par défaut
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredFonts.map((font) => (
                    <Card key={font.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{font.name}</CardTitle>
                          {font.isDefault ? (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              Par défaut
                            </span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setSelectedFont(font)
                                setIsDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <CardDescription className="text-xs">
                          {font.family} • {font.source === 'google' ? 'Google Fonts' : 'Personnalisée'}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {/* Aperçu de la police */}
                        <div
                          className="p-4 bg-gray-50 rounded-lg border"
                          style={{ fontFamily: `"${font.family}", sans-serif` }}
                        >
                          <p className="text-2xl mb-2">Aa Bb Cc</p>
                          <p className="text-sm text-gray-600">
                            Voici un aperçu de la police {font.name}.
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            ABCDEFGHIJKLMNOPQRSTUVWXYZ
                            <br />
                            abcdefghijklmnopqrstuvwxyz
                            <br />
                            0123456789
                          </p>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Graisses: {font.weights.join(', ')}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Suggestions si recherche active */}
            {searchQuery && filteredSuggestions.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">
                  Suggestions Google Fonts
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredSuggestions.map((font) => (
                    <Card key={font.family} className="overflow-hidden border-dashed">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{font.name}</CardTitle>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleSelectSuggestion(font)
                              setIsAddDialogOpen(true)
                            }}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        <CardDescription className="text-xs">
                          {font.category}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div
                          className="p-4 bg-gray-50 rounded-lg border"
                          style={{ fontFamily: `"${font.family}", sans-serif` }}
                        >
                          <p className="text-2xl mb-2">Aa Bb Cc</p>
                          <p className="text-sm text-gray-600">
                            Aperçu de la police {font.name}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Dialog d'ajout */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter une police</DialogTitle>
            <DialogDescription>
              Ajoutez une police Google Fonts à votre collection
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom d'affichage *</Label>
              <Input
                placeholder="Ex: Dancing Script"
                value={newFont.name}
                onChange={(e) => setNewFont({ ...newFont, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Famille CSS *</Label>
              <Input
                placeholder="Ex: Dancing Script"
                value={newFont.family}
                onChange={(e) => setNewFont({ ...newFont, family: e.target.value })}
              />
              <p className="text-xs text-gray-500">
                Le nom exact de la police sur Google Fonts
              </p>
            </div>

            {newFont.family && (
              <div className="space-y-2">
                <Label>Aperçu</Label>
                <div
                  className="p-4 bg-gray-50 rounded-lg border"
                  style={{ fontFamily: `"${newFont.family}", sans-serif` }}
                >
                  <p className="text-2xl mb-2">Aa Bb Cc Dd</p>
                  <p className="text-sm text-gray-600">
                    Voici un aperçu de la police {newFont.name || newFont.family}.
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Le rapide renard brun saute par-dessus le chien paresseux.
                  </p>
                </div>
                {fontPreviewLoaded === false && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Police introuvable sur Google Fonts. Vérifiez le nom exact (ex&nbsp;: &quot;Road Rage&quot; et non &quot;Rage Road&quot;).
                  </p>
                )}
              </div>
            )}

            <div className="pt-2">
              <a
                href="https://fonts.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Parcourir Google Fonts
              </a>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button onClick={handleAddFont} disabled={isSubmitting}>
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de suppression */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Supprimer la police
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la police "{selectedFont?.name}" ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteFont}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

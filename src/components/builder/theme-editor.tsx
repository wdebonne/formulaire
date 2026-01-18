'use client'

import { useState, useRef } from 'react'
import { useFormBuilder } from '@/stores/form-builder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Theme, ThemeProperties } from '@/types/form'
import { Plus, Check, Palette, Trash2, AlertTriangle, Upload, X, Image as ImageIcon } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface ThemeEditorProps {
  themes: Theme[]
  onThemeChange?: (theme: Theme) => void
}

const colorPresets = [
  '#7c3aed', // Purple
  '#2563eb', // Blue
  '#059669', // Green
  '#dc2626', // Red
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#000000', // Black
]

const fontOptions = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro' },
  { value: 'Nunito', label: 'Nunito' },
  { value: 'Raleway', label: 'Raleway' },
  { value: 'Ubuntu', label: 'Ubuntu' },
  { value: 'PT Sans', label: 'PT Sans' },
  { value: 'Oswald', label: 'Oswald' },
  { value: 'Quicksand', label: 'Quicksand' },
  { value: 'Cabin', label: 'Cabin' },
  { value: 'Work Sans', label: 'Work Sans' },
  { value: 'Fira Sans', label: 'Fira Sans' },
  { value: 'Libre Baskerville', label: 'Libre Baskerville' },
  { value: 'Crimson Text', label: 'Crimson Text' },
]

const buttonRadiusOptions = [
  { value: 'none', label: 'Carré', preview: 'rounded-none' },
  { value: 'small', label: 'Léger', preview: 'rounded' },
  { value: 'medium', label: 'Moyen', preview: 'rounded-lg' },
  { value: 'large', label: 'Grand', preview: 'rounded-xl' },
  { value: 'full', label: 'Pilule', preview: 'rounded-full' },
]

const inputRadiusOptions = [
  { value: 'none', label: 'Carré', preview: 'rounded-none' },
  { value: 'small', label: 'Léger', preview: 'rounded' },
  { value: 'medium', label: 'Moyen', preview: 'rounded-lg' },
  { value: 'large', label: 'Grand', preview: 'rounded-xl' },
]

const inputStyleOptions = [
  { value: 'underline', label: 'Souligné' },
  { value: 'outlined', label: 'Bordure' },
  { value: 'filled', label: 'Rempli' },
]

const backgroundTypeOptions = [
  { value: 'solid', label: 'Couleur' },
  { value: 'gradient', label: 'Dégradé' },
  { value: 'image', label: 'Image' },
]

const gradientDirectionOptions = [
  { value: 'to-right', label: '→ Droite', css: 'to right' },
  { value: 'to-left', label: '← Gauche', css: 'to left' },
  { value: 'to-bottom', label: '↓ Bas', css: 'to bottom' },
  { value: 'to-top', label: '↑ Haut', css: 'to top' },
  { value: 'to-bottom-right', label: '↘ Bas-Droite', css: 'to bottom right' },
  { value: 'to-bottom-left', label: '↙ Bas-Gauche', css: 'to bottom left' },
  { value: 'to-top-right', label: '↗ Haut-Droite', css: 'to top right' },
  { value: 'to-top-left', label: '↖ Haut-Gauche', css: 'to top left' },
]

export function ThemeEditor({ themes: initialThemes, onThemeChange }: ThemeEditorProps) {
  const { themeId, setTheme } = useFormBuilder()
  const [themes, setThemes] = useState(initialThemes)
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteConfirmTheme, setDeleteConfirmTheme] = useState<Theme | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const currentTheme = themes.find((t) => t.id === themeId)

  const handleCreateTheme = async () => {
    setIsCreating(true)
    try {
      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Nouveau thème',
          properties: {
            font: 'Inter',
            backgroundColor: '#ffffff',
            questionsColor: '#000000',
            answersColor: '#4a4a4a',
            buttonsBgColor: '#7c3aed',
            buttonsFontColor: '#ffffff',
            buttonsBorderRadius: 'medium',
            inputBorderRadius: 'small',
            inputStyle: 'underline',
          },
        }),
      })

      const newTheme = await res.json()
      setThemes([...themes, { ...newTheme, properties: JSON.parse(newTheme.properties) }])
      setEditingTheme({ ...newTheme, properties: JSON.parse(newTheme.properties) })

      toast({
        title: 'Thème créé',
        description: 'Vous pouvez maintenant le personnaliser',
      })
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le thème',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteTheme = async () => {
    if (!deleteConfirmTheme) return
    
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/themes/${deleteConfirmTheme.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error()

      // Si le thème supprimé était sélectionné, revenir au thème par défaut
      if (themeId === deleteConfirmTheme.id) {
        const defaultTheme = themes.find(t => t.isDefault)
        if (defaultTheme) {
          setTheme(defaultTheme.id)
        }
      }

      setThemes(themes.filter(t => t.id !== deleteConfirmTheme.id))
      setDeleteConfirmTheme(null)

      toast({
        title: 'Thème supprimé',
      })
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer le thème',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSaveTheme = async () => {
    if (!editingTheme) return

    try {
      const res = await fetch(`/api/themes/${editingTheme.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingTheme.name,
          properties: editingTheme.properties,
        }),
      })

      if (!res.ok) throw new Error()

      setThemes(themes.map((t) => (t.id === editingTheme.id ? editingTheme : t)))
      setEditingTheme(null)

      toast({
        title: 'Thème enregistré',
      })
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder le thème',
        variant: 'destructive',
      })
    }
  }

  const updateEditingTheme = (property: keyof ThemeProperties, value: any) => {
    if (!editingTheme) return
    const updatedTheme = {
      ...editingTheme,
      properties: { ...editingTheme.properties, [property]: value },
    }
    setEditingTheme(updatedTheme)
    // Notifier le parent pour le live preview
    if (onThemeChange && editingTheme.id === themeId) {
      onThemeChange(updatedTheme)
    }
  }

  const handleImageUpload = async (file: File) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')

      const { url } = await res.json()
      updateEditingTheme('backgroundImage', url)
      toast({
        title: 'Image téléchargée',
      })
    } catch (error) {
      toast({
        title: 'Erreur',
        description: "Impossible de télécharger l'image",
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }

  if (editingTheme) {
    return (
      <div className="p-4 space-y-4 max-h-full overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Modifier le thème</h3>
          <Button variant="ghost" size="sm" onClick={() => setEditingTheme(null)}>
            Annuler
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Nom du thème</Label>
          <Input
            value={editingTheme.name}
            onChange={(e) => setEditingTheme({ ...editingTheme, name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Police</Label>
          <select
            value={editingTheme.properties.font || 'Inter'}
            onChange={(e) => updateEditingTheme('font', e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md"
            style={{ fontFamily: editingTheme.properties.font || 'Inter' }}
          >
            {fontOptions.map((font) => (
              <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                {font.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Type de fond</Label>
          <div className="flex gap-2">
            {backgroundTypeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updateEditingTheme('backgroundType', option.value)}
                className={`flex-1 px-3 py-2 text-xs border-2 transition-all rounded ${
                  (editingTheme.properties.backgroundType || 'solid') === option.value
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {(editingTheme.properties.backgroundType || 'solid') === 'solid' && (
          <div className="space-y-2">
            <Label>Couleur de fond</Label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={editingTheme.properties.backgroundColor || '#ffffff'}
                onChange={(e) => updateEditingTheme('backgroundColor', e.target.value)}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <Input
                value={editingTheme.properties.backgroundColor || '#ffffff'}
                onChange={(e) => updateEditingTheme('backgroundColor', e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        )}

        {editingTheme.properties.backgroundType === 'gradient' && (
          <>
            <div className="space-y-2">
              <Label>Direction du dégradé</Label>
              <select
                value={editingTheme.properties.gradientDirection || 'to-bottom'}
                onChange={(e) => updateEditingTheme('gradientDirection', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md"
              >
                {gradientDirectionOptions.map((option) => (
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
                  value={editingTheme.properties.gradientStartColor || '#667eea'}
                  onChange={(e) => updateEditingTheme('gradientStartColor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  value={editingTheme.properties.gradientStartColor || '#667eea'}
                  onChange={(e) => updateEditingTheme('gradientStartColor', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Couleur de fin</Label>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={editingTheme.properties.gradientEndColor || '#764ba2'}
                  onChange={(e) => updateEditingTheme('gradientEndColor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  value={editingTheme.properties.gradientEndColor || '#764ba2'}
                  onChange={(e) => updateEditingTheme('gradientEndColor', e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Opacité du dégradé ({editingTheme.properties.gradientOpacity ?? 100}%)</Label>
              <input
                type="range"
                min="0"
                max="100"
                value={editingTheme.properties.gradientOpacity ?? 100}
                onChange={(e) => updateEditingTheme('gradientOpacity', parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Transparent</span>
                <span>Opaque</span>
              </div>
            </div>

            <div className="p-3 rounded-lg border" style={{
              background: (editingTheme.properties.gradientOpacity ?? 100) < 100
                ? `linear-gradient(rgba(255,255,255,${1 - (editingTheme.properties.gradientOpacity ?? 100) / 100}), rgba(255,255,255,${1 - (editingTheme.properties.gradientOpacity ?? 100) / 100})), linear-gradient(${gradientDirectionOptions.find(o => o.value === (editingTheme.properties.gradientDirection || 'to-bottom'))?.css || 'to bottom'}, ${editingTheme.properties.gradientStartColor || '#667eea'}, ${editingTheme.properties.gradientEndColor || '#764ba2'})`
                : `linear-gradient(${gradientDirectionOptions.find(o => o.value === (editingTheme.properties.gradientDirection || 'to-bottom'))?.css || 'to bottom'}, ${editingTheme.properties.gradientStartColor || '#667eea'}, ${editingTheme.properties.gradientEndColor || '#764ba2'})`
            }}>
              <p className="text-xs text-center text-white drop-shadow">Aperçu du dégradé</p>
            </div>
          </>
        )}

        {editingTheme.properties.backgroundType === 'image' && (
          <>
            <div className="space-y-2">
              <Label>Image de fond</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageUpload(file)
                }}
                className="hidden"
              />
              
              {editingTheme.properties.backgroundImage ? (
                <div className="relative">
                  <div 
                    className="w-full h-32 rounded-lg border bg-cover bg-center"
                    style={{ backgroundImage: `url(${editingTheme.properties.backgroundImage})` }}
                  />
                  <button
                    onClick={() => updateEditingTheme('backgroundImage', '')}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="absolute bottom-2 right-2 px-2 py-1 bg-white/90 text-xs rounded hover:bg-white"
                  >
                    Changer
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  {isUploading ? (
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-gray-400" />
                      <span className="text-xs text-gray-500">Cliquez pour télécharger</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Opacité de l'image ({editingTheme.properties.backgroundImageOpacity ?? 100}%)</Label>
              <input
                type="range"
                min="0"
                max="100"
                value={editingTheme.properties.backgroundImageOpacity ?? 100}
                onChange={(e) => updateEditingTheme('backgroundImageOpacity', parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Transparent</span>
                <span>Opaque</span>
              </div>
            </div>

            {editingTheme.properties.backgroundImage && (
              <div 
                className="p-3 rounded-lg border h-20 bg-cover bg-center"
                style={{ 
                  backgroundImage: `linear-gradient(rgba(255,255,255,${1 - (editingTheme.properties.backgroundImageOpacity ?? 100) / 100}), rgba(255,255,255,${1 - (editingTheme.properties.backgroundImageOpacity ?? 100) / 100})), url(${editingTheme.properties.backgroundImage})`,
                }}
              >
                <p className="text-xs text-center" style={{ color: editingTheme.properties.questionsColor || '#000' }}>Aperçu avec opacité</p>
              </div>
            )}
          </>
        )}

        <div className="space-y-2">
          <Label>Couleur des questions</Label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={editingTheme.properties.questionsColor || '#000000'}
              onChange={(e) => updateEditingTheme('questionsColor', e.target.value)}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <Input
              value={editingTheme.properties.questionsColor || '#000000'}
              onChange={(e) => updateEditingTheme('questionsColor', e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Couleur des réponses</Label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={editingTheme.properties.answersColor || '#4a4a4a'}
              onChange={(e) => updateEditingTheme('answersColor', e.target.value)}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <Input
              value={editingTheme.properties.answersColor || '#4a4a4a'}
              onChange={(e) => updateEditingTheme('answersColor', e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Couleur des boutons</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {colorPresets.map((color) => (
              <button
                key={color}
                onClick={() => updateEditingTheme('buttonsBgColor', color)}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: color,
                  borderColor:
                    editingTheme.properties.buttonsBgColor === color ? '#000' : 'transparent',
                }}
              />
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={editingTheme.properties.buttonsBgColor || '#7c3aed'}
              onChange={(e) => updateEditingTheme('buttonsBgColor', e.target.value)}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <Input
              value={editingTheme.properties.buttonsBgColor || '#7c3aed'}
              onChange={(e) => updateEditingTheme('buttonsBgColor', e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Couleur texte des boutons</Label>
          <div className="flex items-center space-x-2">
            <input
              type="color"
              value={editingTheme.properties.buttonsFontColor || '#ffffff'}
              onChange={(e) => updateEditingTheme('buttonsFontColor', e.target.value)}
              className="w-10 h-10 rounded cursor-pointer"
            />
            <Input
              value={editingTheme.properties.buttonsFontColor || '#ffffff'}
              onChange={(e) => updateEditingTheme('buttonsFontColor', e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Forme des boutons</Label>
          <div className="flex flex-wrap gap-2">
            {buttonRadiusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updateEditingTheme('buttonsBorderRadius', option.value)}
                className={`px-3 py-2 text-xs border-2 transition-all ${option.preview} ${
                  editingTheme.properties.buttonsBorderRadius === option.value
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Style des champs</Label>
          <div className="flex flex-wrap gap-2">
            {inputStyleOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updateEditingTheme('inputStyle', option.value)}
                className={`px-3 py-2 text-xs border-2 transition-all rounded ${
                  (editingTheme.properties.inputStyle || 'outlined') === option.value
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {editingTheme.properties.inputStyle === 'underline' && 'Ligne sous le champ uniquement'}
            {editingTheme.properties.inputStyle === 'filled' && 'Fond coloré sans bordure'}
            {(!editingTheme.properties.inputStyle || editingTheme.properties.inputStyle === 'outlined') && 'Bordure classique autour du champ'}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Forme des champs</Label>
          <div className="flex flex-wrap gap-2">
            {inputRadiusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => updateEditingTheme('inputBorderRadius', option.value)}
                className={`px-3 py-2 text-xs border-2 transition-all ${option.preview} ${
                  editingTheme.properties.inputBorderRadius === option.value
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <Button className="w-full" onClick={handleSaveTheme}>
          Enregistrer le thème
        </Button>

        {!editingTheme.isDefault && (
          <Button 
            variant="outline" 
            className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            onClick={handleDeleteTheme}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Supprimer ce thème
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <h3 className="font-medium">Thèmes</h3>
        <p className="text-sm text-gray-500 mt-1">Personnalisez l'apparence du formulaire</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {themes.map((theme) => (
          <div
            key={theme.id}
            className={`relative p-3 rounded-lg border-2 cursor-pointer transition-all ${
              theme.id === themeId
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setTheme(theme.id)}
          >
            {theme.id === themeId && (
              <div className="absolute top-2 right-2">
                <Check className="w-4 h-4 text-primary" />
              </div>
            )}
            <div
              className="w-full h-16 rounded mb-2 bg-cover bg-center"
              style={
                theme.properties.backgroundType === 'gradient' 
                  ? {
                      background: (theme.properties.gradientOpacity ?? 100) < 100
                        ? `linear-gradient(rgba(255,255,255,${1 - (theme.properties.gradientOpacity ?? 100) / 100}), rgba(255,255,255,${1 - (theme.properties.gradientOpacity ?? 100) / 100})), linear-gradient(${gradientDirectionOptions.find(o => o.value === (theme.properties.gradientDirection || 'to-bottom'))?.css || 'to bottom'}, ${theme.properties.gradientStartColor || '#667eea'}, ${theme.properties.gradientEndColor || '#764ba2'})`
                        : `linear-gradient(${gradientDirectionOptions.find(o => o.value === (theme.properties.gradientDirection || 'to-bottom'))?.css || 'to bottom'}, ${theme.properties.gradientStartColor || '#667eea'}, ${theme.properties.gradientEndColor || '#764ba2'})`
                    } 
                  : theme.properties.backgroundType === 'image' && theme.properties.backgroundImage
                    ? {
                        backgroundImage: `linear-gradient(rgba(255,255,255,${1 - (theme.properties.backgroundImageOpacity ?? 100) / 100}), rgba(255,255,255,${1 - (theme.properties.backgroundImageOpacity ?? 100) / 100})), url(${theme.properties.backgroundImage})`,
                      }
                    : { backgroundColor: theme.properties.backgroundColor || '#fff' }
              }
            >
              <div className="p-2">
                <div
                  className="text-xs font-medium truncate"
                  style={{ color: theme.properties.questionsColor || '#000' }}
                >
                  Question
                </div>
                <div
                  className="w-8 h-4 rounded mt-1"
                  style={{ backgroundColor: theme.properties.buttonsBgColor || '#7c3aed' }}
                />
              </div>
            </div>
            <p className="text-xs font-medium truncate">{theme.name}</p>
            {!theme.isDefault && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingTheme(theme)
                }}
                className="text-xs text-primary hover:underline"
              >
                Modifier
              </button>
            )}
          </div>
        ))}

        <button
          onClick={handleCreateTheme}
          disabled={isCreating}
          className="p-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors flex flex-col items-center justify-center min-h-[100px]"
        >
          <Plus className="w-6 h-6 text-gray-400 mb-1" />
          <span className="text-xs text-gray-500">Nouveau thème</span>
        </button>
      </div>
    </div>
  )
}

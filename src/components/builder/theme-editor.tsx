'use client'

import { useState } from 'react'
import { useFormBuilder } from '@/stores/form-builder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Theme, ThemeProperties } from '@/types/form'
import { Plus, Check, Palette, Trash2, AlertTriangle } from 'lucide-react'
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

export function ThemeEditor({ themes: initialThemes }: ThemeEditorProps) {
  const { themeId, setTheme } = useFormBuilder()
  const [themes, setThemes] = useState(initialThemes)
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [deleteConfirmTheme, setDeleteConfirmTheme] = useState<Theme | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
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
    setEditingTheme({
      ...editingTheme,
      properties: { ...editingTheme.properties, [property]: value },
    })
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
              className="w-full h-16 rounded mb-2"
              style={{ backgroundColor: theme.properties.backgroundColor || '#fff' }}
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

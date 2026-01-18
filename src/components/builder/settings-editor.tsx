'use client'

import { useState, useEffect } from 'react'
import { useFormBuilder } from '@/stores/form-builder'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

export function SettingsEditor() {
  const { settings, updateSettings, slug, setFormData } = useFormBuilder()
  const [localSlug, setLocalSlug] = useState(slug)
  const [slugError, setSlugError] = useState('')

  useEffect(() => {
    setLocalSlug(slug)
  }, [slug])

  const handleSlugChange = (value: string) => {
    // Convertir en slug valide (minuscules, tirets, pas d'espaces ni caractères spéciaux)
    const sanitized = value
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
    
    setLocalSlug(sanitized)
    setSlugError('')
  }

  const handleSlugBlur = () => {
    if (localSlug && localSlug !== slug) {
      setFormData({ slug: localSlug })
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div className="mb-4">
        <h3 className="font-medium">Paramètres du formulaire</h3>
        <p className="text-sm text-gray-500 mt-1">
          Configurez le comportement du formulaire
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Barre de progression</Label>
          <p className="text-xs text-gray-500">Afficher l'avancement</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showProgressBar ?? true}
            onChange={(e) => updateSettings({ showProgressBar: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {/* Progress bar position */}
      {(settings.showProgressBar ?? true) && (
        <div className="space-y-2 ml-4">
          <Label>Position de la barre</Label>
          <select
            value={settings.progressBarPosition ?? 'top'}
            onChange={(e) =>
              updateSettings({ progressBarPosition: e.target.value as 'top' | 'bottom' | 'left' | 'right' })
            }
            className="w-full px-3 py-2 text-sm border rounded-md"
          >
            <option value="top">En haut</option>
            <option value="bottom">En bas</option>
            <option value="left">À gauche</option>
            <option value="right">À droite</option>
          </select>
        </div>
      )}

      {/* Progress bar size */}
      {(settings.showProgressBar ?? true) && (
        <div className="space-y-2 ml-4">
          <Label>Taille de la barre</Label>
          <select
            value={settings.progressBarSize ?? 'small'}
            onChange={(e) =>
              updateSettings({ progressBarSize: e.target.value as 'small' | 'medium' | 'large' })
            }
            className="w-full px-3 py-2 text-sm border rounded-md"
          >
            <option value="small">Petite</option>
            <option value="medium">Moyenne</option>
            <option value="large">Grande</option>
          </select>
        </div>
      )}

      {/* Question numbers */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Numéros de questions</Label>
          <p className="text-xs text-gray-500">Afficher la numérotation</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showQuestionNumbers ?? true}
            onChange={(e) => updateSettings({ showQuestionNumbers: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {/* Question counter */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Compteur de questions</Label>
          <p className="text-xs text-gray-500">Afficher 1/5, 2/5... en bas</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showQuestionCounter ?? true}
            onChange={(e) => updateSettings({ showQuestionCounter: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {/* Letters on answers */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Lettres sur les choix</Label>
          <p className="text-xs text-gray-500">A, B, C... sur les options</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.lettersOnAnswers ?? true}
            onChange={(e) => updateSettings({ lettersOnAnswers: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {/* Disable swipe by wheel */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Désactiver scroll molette</Label>
          <p className="text-xs text-gray-500">Navigation au clavier uniquement</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.disableSwipeByWheel ?? false}
            onChange={(e) => updateSettings({ disableSwipeByWheel: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {/* Auto submit */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Soumission auto</Label>
          <p className="text-xs text-gray-500">Soumettre après dernière question</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.autoSubmitLastQuestion ?? false}
            onChange={(e) => updateSettings({ autoSubmitLastQuestion: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {/* Animation direction */}
      <div className="space-y-2">
        <Label>Direction d'animation</Label>
        <select
          value={settings.animationDirection ?? 'vertical'}
          onChange={(e) =>
            updateSettings({ animationDirection: e.target.value as 'vertical' | 'horizontal' })
          }
          className="w-full px-3 py-2 text-sm border rounded-md"
        >
          <option value="vertical">Verticale</option>
          <option value="horizontal">Horizontale</option>
        </select>
      </div>

      {/* Slug / URL section */}
      <div className="pt-4 border-t">
        <h4 className="font-medium text-sm mb-4">URL du formulaire</h4>
        
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input
            value={localSlug}
            onChange={(e) => handleSlugChange(e.target.value)}
            onBlur={handleSlugBlur}
            placeholder="mon-formulaire"
            className="font-mono text-sm"
          />
          <p className="text-xs text-gray-500">
            L'URL sera : /{localSlug || 'mon-formulaire'}
          </p>
          {slugError && (
            <p className="text-xs text-red-500">{slugError}</p>
          )}
        </div>
      </div>

      {/* Branding section */}
      <div className="pt-4 border-t">
        <h4 className="font-medium text-sm mb-4">Marque</h4>
        
        {/* Show branding */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <Label>Afficher la marque</Label>
            <p className="text-xs text-gray-500">"propulsé par..." en bas</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showBranding ?? true}
              onChange={(e) => updateSettings({ showBranding: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Branding text */}
        {(settings.showBranding ?? true) && (
          <div className="space-y-2">
            <Label>Texte de marque</Label>
            <input
              type="text"
              value={settings.brandingText ?? 'FormBuilder'}
              onChange={(e) => updateSettings({ brandingText: e.target.value })}
              placeholder="FormBuilder"
              className="w-full px-3 py-2 text-sm border rounded-md"
            />
            <p className="text-xs text-gray-500">Affiché après "propulsé par"</p>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { useFormBuilder } from '@/stores/form-builder'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { FormBlock, BlockChoice, BlockType } from '@/types/form'
import { v4 as uuidv4 } from 'uuid'
import { Plus, Trash2, GripVertical, Upload, Type, AlignLeft, Hash, Mail, Phone, MapPin, Calendar, CalendarRange, Clock, ChevronDown, CheckSquare, SlidersHorizontal, ArrowLeft, Image, Video, Layers, PanelRight, PanelLeft, LayoutTemplate, X, Package, Search, Filter, FileSpreadsheet, ArrowUp, ArrowDown, AlignRight, Download, Expand, Cloud, Folder, ChevronRight, Loader2, CheckCircle, FolderOpen } from 'lucide-react'

const innerBlockTypes: { type: BlockType; label: string; icon: React.ReactNode }[] = [
  { type: 'short-text', label: 'Texte court', icon: <Type className="w-4 h-4" /> },
  { type: 'long-text', label: 'Texte long', icon: <AlignLeft className="w-4 h-4" /> },
  { type: 'number', label: 'Nombre', icon: <Hash className="w-4 h-4" /> },
  { type: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
  { type: 'phone', label: 'Téléphone', icon: <Phone className="w-4 h-4" /> },
  { type: 'address', label: 'Adresse', icon: <MapPin className="w-4 h-4" /> },
  { type: 'date', label: 'Date', icon: <Calendar className="w-4 h-4" /> },
  { type: 'advanced-date', label: 'Date avancée', icon: <CalendarRange className="w-4 h-4" /> },
  { type: 'time', label: 'Heure', icon: <Clock className="w-4 h-4" /> },
  { type: 'dropdown', label: 'Liste déroulante', icon: <ChevronDown className="w-4 h-4" /> },
  { type: 'multiple-choice', label: 'Choix multiple', icon: <CheckSquare className="w-4 h-4" /> },
  { type: 'slider', label: 'Curseur', icon: <SlidersHorizontal className="w-4 h-4" /> },
]

interface BlockEditorProps {
  block: FormBlock
  isInnerBlock?: boolean
  parentGroupId?: string
}

export function BlockEditor({ block, isInnerBlock = false, parentGroupId }: BlockEditorProps) {
  const { updateBlock, updateInnerBlock, selectInnerBlock } = useFormBuilder()
  const [importText, setImportText] = useState('')
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [choicesSearchFilter, setChoicesSearchFilter] = useState('')
  const [expandedConditionId, setExpandedConditionId] = useState<string | null>(null)

  const updateAttribute = (key: string, value: any) => {
    if (isInnerBlock && parentGroupId) {
      updateInnerBlock(parentGroupId, block.id, {
        attributes: { ...block.attributes, [key]: value },
      })
    } else {
      updateBlock(block.id, {
        attributes: { ...block.attributes, [key]: value },
      })
    }
  }

  const addChoice = () => {
    const choices = block.attributes.choices || []
    const newChoice: BlockChoice = {
      id: uuidv4(),
      label: `Option ${choices.length + 1}`,
      value: `option-${choices.length + 1}`,
    }
    updateAttribute('choices', [...choices, newChoice])
  }

  const updateChoice = (choiceId: string, updates: Partial<BlockChoice>) => {
    const choices = block.attributes.choices || []
    updateAttribute(
      'choices',
      choices.map((c) => (c.id === choiceId ? { ...c, ...updates } : c))
    )
  }

  const removeChoice = (choiceId: string) => {
    const choices = block.attributes.choices || []
    updateAttribute(
      'choices',
      choices.filter((c) => c.id !== choiceId)
    )
  }

  const importChoices = () => {
    if (!importText.trim()) return
    
    const lines = importText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
    
    const existingChoices = block.attributes.choices || []
    const newChoices: BlockChoice[] = lines.map((line) => ({
      id: uuidv4(),
      label: line,
      value: line.toLowerCase().replace(/\s+/g, '-'),
    }))
    
    updateAttribute('choices', [...existingChoices, ...newChoices])
    setImportText('')
    setImportDialogOpen(false)
  }

  return (
    <div className="p-4 space-y-6">
      {/* Bouton retour pour les blocs internes */}
      {isInnerBlock && parentGroupId && (
        <button
          onClick={() => selectInnerBlock(parentGroupId, null)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au groupe
        </button>
      )}
      
      <div>
        <h3 className="font-medium mb-4">
          {isInnerBlock ? 'Propriétés de la question' : 'Propriétés du bloc'}
        </h3>
      </div>

      {/* Label */}
      <div className="space-y-2">
        <Label htmlFor="label">Question / Titre</Label>
        <Input
          id="label"
          value={block.attributes.label || ''}
          onChange={(e) => updateAttribute('label', e.target.value)}
          placeholder="Entrez votre question"
        />
        <p className="text-xs text-gray-500">
          💡 Utilisez <code className="bg-gray-100 px-1 rounded">@1</code>, <code className="bg-gray-100 px-1 rounded">@2</code>, etc. pour insérer les réponses des questions précédentes. 
          Pour les groupes : <code className="bg-gray-100 px-1 rounded">@2a</code>, <code className="bg-gray-100 px-1 rounded">@2b</code>...
        </p>
      </div>

      {/* Hide label toggle - disponible pour tous les blocs sauf welcome/thankyou */}
      {!['welcome-screen', 'thankyou-screen'].includes(block.type) && (
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="hideLabel">Masquer le titre</Label>
            <p className="text-xs text-gray-500">Le titre ne sera pas affiché dans le formulaire</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="hideLabel"
              checked={block.attributes.hideLabel || false}
              onChange={(e) => updateAttribute('hideLabel', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      )}

      {/* Description (pas pour les repeaters qui ont leur propre champ) */}
      {block.type !== 'repeater' && (
        <div className="space-y-2">
          <Label htmlFor="description">Description (optionnel)</Label>
          <textarea
            id="description"
            value={block.attributes.description || ''}
            onChange={(e) => updateAttribute('description', e.target.value)}
            placeholder="Description ou instruction supplémentaire"
            className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-gray-500">
            💡 Utilisez <code className="bg-gray-100 px-1 rounded">@1</code>, <code className="bg-gray-100 px-1 rounded">@2</code>, etc. pour insérer les réponses des questions précédentes. 
            Pour les groupes : <code className="bg-gray-100 px-1 rounded">@2a</code>, <code className="bg-gray-100 px-1 rounded">@2b</code>...
          </p>
        </div>
      )}

      {/* Placeholder (for text inputs) */}
      {['short-text', 'long-text', 'number', 'email', 'phone', 'address'].includes(block.type) && (
        <div className="space-y-2">
          <Label htmlFor="placeholder">Placeholder</Label>
          <Input
            id="placeholder"
            value={block.attributes.placeholder || ''}
            onChange={(e) => updateAttribute('placeholder', e.target.value)}
            placeholder="Texte d'exemple"
          />
        </div>
      )}

      {/* Text transform (short-text only) */}
      {block.type === 'short-text' && (
        <div className="space-y-2">
          <Label htmlFor="textTransform">Formatage de la réponse</Label>
          <select
            id="textTransform"
            value={block.attributes.textTransform || 'none'}
            onChange={(e) =>
              updateAttribute('textTransform', e.target.value as 'none' | 'uppercase' | 'capitalize')
            }
            className="w-full h-10 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="none">Aucun (tel quel)</option>
            <option value="uppercase">MAJUSCULES — ex : MARTIN, DA SILVA</option>
            <option value="capitalize">Première lettre — ex : Martin, Jean-Marie</option>
          </select>
        </div>
      )}

      {/* Required toggle */}
      {!['welcome-screen', 'thankyou-screen', 'statement'].includes(block.type) && (
        <div className="flex items-center justify-between">
          <Label htmlFor="required">Obligatoire</Label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="required"
              checked={block.attributes.required || false}
              onChange={(e) => updateAttribute('required', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      )}

      {/* Button text (for screens and statements) */}
      {['welcome-screen', 'statement'].includes(block.type) && (
        <div className="space-y-2">
          <Label htmlFor="buttonText">Texte du bouton</Label>
          <Input
            id="buttonText"
            value={block.attributes.buttonText || ''}
            onChange={(e) => updateAttribute('buttonText', e.target.value)}
            placeholder="Continuer"
          />
        </div>
      )}

      {/* Bouton Recommencer (thankyou-screen uniquement) */}
      {block.type === 'thankyou-screen' && (
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showRestartButton">Bouton Recommencer</Label>
              <p className="text-xs text-gray-500 mt-0.5">
                Permet à l'utilisateur de soumettre plusieurs fois de suite
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="showRestartButton"
                checked={block.attributes.showRestartButton || false}
                onChange={(e) => updateAttribute('showRestartButton', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          {block.attributes.showRestartButton && (
            <div className="space-y-2">
              <Label htmlFor="restartButtonText">Texte du bouton</Label>
              <Input
                id="restartButtonText"
                value={block.attributes.restartButtonText || ''}
                onChange={(e) => updateAttribute('restartButtonText', e.target.value)}
                placeholder="Recommencer"
              />
            </div>
          )}
        </div>
      )}

      {/* Attachment pour welcome-screen et thankyou-screen */}
      {['welcome-screen', 'thankyou-screen'].includes(block.type) && (
        <WelcomeScreenAttachment block={block} updateAttribute={updateAttribute} />
      )}

      {/* Média pour les blocs de saisie et de choix */}
      {['short-text', 'long-text', 'multiple-choice', 'dropdown'].includes(block.type) && (
        <BlockMediaEditor block={block} updateAttribute={updateAttribute} />
      )}

      {/* Number options */}
      {block.type === 'number' && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min">Minimum</Label>
              <Input
                id="min"
                type="number"
                value={block.attributes.min ?? ''}
                onChange={(e) => updateAttribute('min', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Min"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max">Maximum</Label>
              <Input
                id="max"
                type="number"
                value={block.attributes.max ?? ''}
                onChange={(e) => updateAttribute('max', e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Max"
              />
            </div>
          </div>
        </>
      )}

      {/* Slider options */}
      {block.type === 'slider' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min">Min</Label>
              <Input
                id="min"
                type="number"
                value={block.attributes.min ?? 0}
                onChange={(e) => updateAttribute('min', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max">Max</Label>
              <Input
                id="max"
                type="number"
                value={block.attributes.max ?? 10}
                onChange={(e) => updateAttribute('max', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="step">Pas</Label>
              <Input
                id="step"
                type="number"
                value={block.attributes.step ?? 1}
                onChange={(e) => updateAttribute('step', Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultValue">Valeur par défaut</Label>
            <Input
              id="defaultValue"
              type="number"
              value={block.attributes.defaultValue ?? ''}
              onChange={(e) => updateAttribute('defaultValue', Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {/* Phone options */}
      {block.type === 'phone' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneFormat">Format du numéro</Label>
            <select
              id="phoneFormat"
              value={block.attributes.phoneFormat || 'standard'}
              onChange={(e) => {
                const format = e.target.value as 'standard' | 'international'
                updateAttribute('phoneFormat', format)
                // Ajuster le nombre de chiffres par défaut selon le format
                if (format === 'international' && !block.attributes.phoneDigitsCount) {
                  updateAttribute('phoneDigitsCount', 11)
                } else if (format === 'standard' && !block.attributes.phoneDigitsCount) {
                  updateAttribute('phoneDigitsCount', 10)
                }
              }}
              className="w-full h-10 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="standard">Standard (06 12 34 56 78)</option>
              <option value="international">International (+33 6 12 34 56 78)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneDigitsCount">Nombre de chiffres attendu</Label>
            <Input
              id="phoneDigitsCount"
              type="number"
              min={1}
              max={20}
              value={block.attributes.phoneDigitsCount ?? (block.attributes.phoneFormat === 'international' ? 11 : 10)}
              onChange={(e) => updateAttribute('phoneDigitsCount', e.target.value ? Number(e.target.value) : undefined)}
              placeholder={block.attributes.phoneFormat === 'international' ? '11' : '10'}
            />
            <p className="text-xs text-gray-500">
              {block.attributes.phoneFormat === 'international' 
                ? '💡 Format +33 : comptez 11 chiffres (33 + 9 chiffres)' 
                : '💡 Format standard : 10 chiffres (06 12 34 56 78)'
              }
            </p>
          </div>
        </div>
      )}

      {/* Email options */}
      {block.type === 'email' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="validateEmail">Validation stricte de l'email</Label>
              <p className="text-xs text-gray-500">Vérifie que l'email est au format valide (ex: test@exemple.fr)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="validateEmail"
                checked={block.attributes.validateEmail !== false}
                onChange={(e) => updateAttribute('validateEmail', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
      )}

      {/* Choices editor */}
      {['dropdown', 'multiple-choice'].includes(block.type) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Options</Label>
            <div className="flex items-center gap-2">
              <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Upload className="w-4 h-4 mr-1" />
                    Importer
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Importer une liste</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Collez votre liste (une option par ligne)</Label>
                      <textarea
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder={"Option 1\nOption 2\nOption 3\n..."}
                        className="w-full min-h-[200px] px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                      />
                      <p className="text-xs text-gray-500">
                        Chaque ligne sera ajoutée comme une nouvelle option
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                        Annuler
                      </Button>
                      <Button onClick={importChoices} disabled={!importText.trim()}>
                        Importer {importText.trim() && `(${importText.split('\n').filter(l => l.trim()).length})`}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button size="sm" variant="outline" onClick={addChoice}>
                <Plus className="w-4 h-4 mr-1" />
                Ajouter
              </Button>
            </div>
          </div>

          {block.type === 'multiple-choice' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="allowMultiple">Autoriser plusieurs réponses</Label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="allowMultiple"
                    checked={block.attributes.allowMultiple || false}
                    onChange={(e) => updateAttribute('allowMultiple', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allowOtherOption">Autoriser une option &quot;Autre&quot;</Label>
                  <p className="text-xs text-gray-500">L'utilisateur peut saisir une réponse personnalisée</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="allowOtherOption"
                    checked={block.attributes.allowOtherOption || false}
                    onChange={(e) => updateAttribute('allowOtherOption', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          )}

          {block.type === 'dropdown' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allowCustomValue">Autoriser les réponses personnalisées</Label>
                  <p className="text-xs text-gray-500">L'utilisateur peut saisir une réponse qui n'est pas dans la liste</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="allowCustomValue"
                    checked={block.attributes.allowCustomValue || false}
                    onChange={(e) => updateAttribute('allowCustomValue', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <DropdownFilterEditor block={block} isInnerBlock={isInnerBlock} parentGroupId={parentGroupId} />
            </div>
          )}

          {(block.attributes.choices || []).length > 5 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={choicesSearchFilter}
                onChange={(e) => setChoicesSearchFilter(e.target.value)}
                placeholder="Rechercher une option..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div className="space-y-2">
            {(block.attributes.choices || [])
              .map((choice, index) => ({ choice, index }))
              .filter(({ choice }) =>
                choicesSearchFilter.trim() === '' ||
                choice.label.toLowerCase().includes(choicesSearchFilter.toLowerCase())
              )
              .map(({ choice, index }) => (
                <div key={choice.id} className="flex items-center space-x-2 group">
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                  <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs font-medium">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <Input
                    value={choice.label}
                    onChange={(e) => updateChoice(choice.id, { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => removeChoice(choice.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            {choicesSearchFilter.trim() !== '' &&
              (block.attributes.choices || []).filter((c) =>
                c.label.toLowerCase().includes(choicesSearchFilter.toLowerCase())
              ).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">Aucune option ne correspond à votre recherche.</p>
              )}
          </div>
        </div>
      )}

      {/* Image Selection editor */}
      {block.type === 'image-selection' && (
        <ImageSelectionEditor block={block} updateAttribute={updateAttribute} />
      )}

      {/* Date format */}
      {block.type === 'date' && (
        <div className="space-y-2">
          <Label htmlFor="format">Format de date</Label>
          <select
            id="format"
            value={block.attributes.format || 'DD/MM/YYYY'}
            onChange={(e) => updateAttribute('format', e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>
      )}

      {/* Advanced Date editor */}
      {block.type === 'advanced-date' && (
        <AdvancedDateEditor block={block} updateAttribute={updateAttribute} isInnerBlock={isInnerBlock} parentGroupId={parentGroupId} />
      )}

      {/* Time editor */}
      {block.type === 'time' && (
        <div className="space-y-4">
          {/* Option pour activer la plage horaire */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="isTimeRange">Plage horaire</Label>
              <p className="text-xs text-gray-500">Permet de saisir une heure de début et une heure de fin</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                id="isTimeRange"
                checked={block.attributes.isTimeRange || false}
                onChange={(e) => updateAttribute('isTimeRange', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          {/* Labels personnalisés pour la plage horaire */}
          {block.attributes.isTimeRange && (
            <div className="space-y-3 p-3 border border-indigo-200 rounded-lg bg-indigo-50/50">
              <div className="space-y-2">
                <Label htmlFor="startTimeLabel">Label de l'heure de début</Label>
                <Input
                  id="startTimeLabel"
                  value={block.attributes.startTimeLabel || 'Heure de début'}
                  onChange={(e) => updateAttribute('startTimeLabel', e.target.value)}
                  placeholder="Heure de début"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTimeLabel">Label de l'heure de fin</Label>
                <Input
                  id="endTimeLabel"
                  value={block.attributes.endTimeLabel || 'Heure de fin'}
                  onChange={(e) => updateAttribute('endTimeLabel', e.target.value)}
                  placeholder="Heure de fin"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Group inner blocks editor */}
      {block.type === 'group' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Questions du groupe</Label>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Ajouter une question</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-2 pt-4">
                  {innerBlockTypes.map((blockType) => (
                    <button
                      key={blockType.type}
                      onClick={() => {
                        const innerBlocks = block.innerBlocks || []
                        const newInnerBlock: FormBlock = {
                          id: uuidv4(),
                          type: blockType.type,
                          attributes: {
                            label: `${blockType.label} ${innerBlocks.length + 1}`,
                            placeholder: 'Votre réponse',
                            required: false,
                            ...(blockType.type === 'dropdown' || blockType.type === 'multiple-choice' ? {
                              choices: [
                                { id: uuidv4(), label: 'Option 1', value: 'option-1' },
                                { id: uuidv4(), label: 'Option 2', value: 'option-2' },
                              ],
                            } : {}),
                          },
                        }
                        updateBlock(block.id, {
                          innerBlocks: [...innerBlocks, newInnerBlock],
                        })
                      }}
                      className="flex items-center gap-2 p-3 text-left rounded-lg border border-gray-200 hover:border-primary hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-gray-500">{blockType.icon}</span>
                      <span className="text-sm font-medium">{blockType.label}</span>
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Inner blocks list */}
          <div className="space-y-3">
            {(block.innerBlocks || []).map((innerBlock, index) => (
              <div key={innerBlock.id} className="p-3 border rounded-lg bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 flex items-center justify-center bg-sky-100 text-sky-600 rounded text-xs font-medium">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {innerBlockTypes.find(t => t.type === innerBlock.type)?.label || innerBlock.type}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      updateBlock(block.id, {
                        innerBlocks: block.innerBlocks?.filter(b => b.id !== innerBlock.id),
                      })
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <Input
                    value={innerBlock.attributes.label || ''}
                    onChange={(e) => {
                      updateBlock(block.id, {
                        innerBlocks: block.innerBlocks?.map(b =>
                          b.id === innerBlock.id
                            ? { ...b, attributes: { ...b.attributes, label: e.target.value } }
                            : b
                        ),
                      })
                    }}
                    placeholder="Question"
                    className="text-sm"
                  />
                  {['short-text', 'long-text', 'number', 'email', 'phone'].includes(innerBlock.type) && (
                    <Input
                      value={innerBlock.attributes.placeholder || ''}
                      onChange={(e) => {
                        updateBlock(block.id, {
                          innerBlocks: block.innerBlocks?.map(b =>
                            b.id === innerBlock.id
                              ? { ...b, attributes: { ...b.attributes, placeholder: e.target.value } }
                              : b
                          ),
                        })
                      }}
                      placeholder="Placeholder"
                      className="text-sm text-gray-500"
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`required-${innerBlock.id}`}
                      checked={innerBlock.attributes.required || false}
                      onChange={(e) => {
                        updateBlock(block.id, {
                          innerBlocks: block.innerBlocks?.map(b =>
                            b.id === innerBlock.id
                              ? { ...b, attributes: { ...b.attributes, required: e.target.checked } }
                              : b
                          ),
                        })
                      }}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={`required-${innerBlock.id}`} className="text-xs text-gray-500">
                      Obligatoire
                    </Label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(!block.innerBlocks || block.innerBlocks.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-4">
              Aucune question dans ce groupe. Cliquez sur "Ajouter" pour commencer.
            </p>
          )}
        </div>
      )}

      {/* Repeater block settings */}
      {block.type === 'repeater' && (
        <div className="space-y-4">
          {/* Question initiale Oui/Non */}
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h4 className="font-medium text-orange-700 mb-3">Question initiale (Oui/Non)</h4>
            <p className="text-xs text-gray-500 mb-3">
              Cette question détermine si l'utilisateur entre dans le bloc répétable ou passe au bloc suivant.
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="initialQuestion">Question</Label>
                <Input
                  id="initialQuestion"
                  value={block.attributes.initialQuestion || ''}
                  onChange={(e) => {
                    updateBlock(block.id, {
                      attributes: { ...block.attributes, initialQuestion: e.target.value, label: e.target.value },
                    })
                  }}
                  placeholder="Avez-vous des éléments à ajouter ?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optionnel)</Label>
                <textarea
                  id="description"
                  value={block.attributes.description || ''}
                  onChange={(e) => updateAttribute('description', e.target.value)}
                  placeholder="Description ou instruction supplémentaire"
                  className="w-full min-h-[60px] px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-gray-500">
                  💡 Variables : <code className="bg-gray-100 px-1 rounded">@1</code>, <code className="bg-gray-100 px-1 rounded">@2</code> (questions), 
                  <code className="bg-gray-100 px-1 rounded">@2a</code>, <code className="bg-gray-100 px-1 rounded">@2b</code> (blocs internes).
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initialYesLabel">Bouton "Oui"</Label>
                  <Input
                    id="initialYesLabel"
                    value={block.attributes.initialYesLabel || ''}
                    onChange={(e) => updateAttribute('initialYesLabel', e.target.value)}
                    placeholder="Oui"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initialNoLabel">Bouton "Non"</Label>
                  <Input
                    id="initialNoLabel"
                    value={block.attributes.initialNoLabel || ''}
                    onChange={(e) => updateAttribute('initialNoLabel', e.target.value)}
                    placeholder="Non"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Question de répétition */}
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h4 className="font-medium text-amber-700 mb-3">Question de répétition</h4>
            <p className="text-xs text-gray-500 mb-3">
              Posée après chaque série pour savoir si l'utilisateur veut ajouter une autre entrée.
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="repeatQuestion">Question</Label>
                <Input
                  id="repeatQuestion"
                  value={block.attributes.repeatQuestion || ''}
                  onChange={(e) => updateAttribute('repeatQuestion', e.target.value)}
                  placeholder="Voulez-vous ajouter un autre élément ?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="repeatDescription">Description (optionnel)</Label>
                <textarea
                  id="repeatDescription"
                  value={block.attributes.repeatDescription || ''}
                  onChange={(e) => updateAttribute('repeatDescription', e.target.value)}
                  placeholder="Description ou instruction supplémentaire"
                  className="w-full min-h-[60px] px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-gray-500">
                  💡 Variables : <code className="bg-gray-100 px-1 rounded">@1</code>, <code className="bg-gray-100 px-1 rounded">@2</code> (questions), 
                  <code className="bg-gray-100 px-1 rounded">@2a</code>, <code className="bg-gray-100 px-1 rounded">@2b</code> (blocs internes).
                  <br />
                  🔄 <code className="bg-gray-100 px-1 rounded">@2a.all</code> = tous les choix cumulés (ex: "papier, tableaux, crayon")
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="repeatYesLabel">Bouton "Oui"</Label>
                  <Input
                    id="repeatYesLabel"
                    value={block.attributes.repeatYesLabel || ''}
                    onChange={(e) => updateAttribute('repeatYesLabel', e.target.value)}
                    placeholder="Oui"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="repeatNoLabel">Bouton "Non"</Label>
                  <Input
                    id="repeatNoLabel"
                    value={block.attributes.repeatNoLabel || ''}
                    onChange={(e) => updateAttribute('repeatNoLabel', e.target.value)}
                    placeholder="Non"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxRepetitions">Nombre max de répétitions</Label>
                <Input
                  id="maxRepetitions"
                  type="number"
                  min={1}
                  value={block.attributes.maxRepetitions ?? 10}
                  onChange={(e) => updateAttribute('maxRepetitions', Number(e.target.value))}
                />
              </div>

              <div className="flex items-start gap-2 pt-1">
                <input
                  id="excludePreviousChoices"
                  type="checkbox"
                  checked={block.attributes.excludePreviousChoices || false}
                  onChange={(e) => updateAttribute('excludePreviousChoices', e.target.checked)}
                  className="mt-0.5 accent-orange-500"
                />
                <div>
                  <Label htmlFor="excludePreviousChoices" className="cursor-pointer">
                    Masquer les choix déjà sélectionnés
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Pour les questions à choix (liste / choix multiple) dans ce répéteur : les valeurs déjà choisies dans les répétitions précédentes n'apparaissent plus.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Questions à répéter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Questions à répéter</Label>
              <span className="text-xs text-gray-400">{block.innerBlocks?.length || 0} question(s)</span>
            </div>
            <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              💡 Glissez des blocs depuis la liste de gauche. Cliquez sur une question dans la liste pour la modifier en détail.
            </p>
          </div>

          {/* Liste simplifiée des questions */}
          <div className="space-y-2">
            {(block.innerBlocks || []).map((innerBlock, index) => {
              // Blocs frères précédents ayant des choix (peuvent servir de source de masquage)
              const choiceSourceBlocks = (block.innerBlocks || []).slice(0, index).filter(
                b => ['dropdown', 'multiple-choice', 'image-selection'].includes(b.type)
              )
              const hasCondition = !!innerBlock.attributes.visibilitySourceBlockId
              const isExpanded = expandedConditionId === innerBlock.id
              const sourceBlock = choiceSourceBlocks.find(b => b.id === innerBlock.attributes.visibilitySourceBlockId)

              return (
                <div
                  key={innerBlock.id}
                  className={`border rounded-lg bg-white transition-colors ${isExpanded ? 'border-orange-300' : 'hover:bg-orange-50'}`}
                >
                  <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-600 rounded text-xs font-medium">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          {innerBlock.attributes.label || 'Sans titre'}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          {innerBlockTypes.find(t => t.type === innerBlock.type)?.label || innerBlock.type}
                          {hasCondition && (
                            <span className="inline-flex items-center gap-0.5 text-orange-500">
                              <Filter className="w-3 h-3" />
                              <span>conditionnel</span>
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {(index > 0 && choiceSourceBlocks.length > 0) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 ${isExpanded ? 'text-orange-500 bg-orange-50' : 'text-gray-400 hover:text-orange-500 hover:bg-orange-50'}`}
                          title="Masquage conditionnel"
                          onClick={() => setExpandedConditionId(isExpanded ? null : innerBlock.id)}
                        >
                          <Filter className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          updateBlock(block.id, {
                            innerBlocks: block.innerBlocks?.filter(b => b.id !== innerBlock.id),
                          })
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Panneau de condition de masquage */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-orange-100 space-y-3">
                      <p className="text-xs text-orange-600 font-medium">Masquage conditionnel</p>

                      {/* Sélection du bloc source */}
                      <div className="space-y-1">
                        <label className="text-xs text-gray-500">Afficher ce bloc uniquement si :</label>
                        <select
                          className="w-full text-xs border rounded px-2 py-1.5 bg-white"
                          value={innerBlock.attributes.visibilitySourceBlockId || ''}
                          onChange={(e) => {
                            const newSrcId = e.target.value
                            updateBlock(block.id, {
                              innerBlocks: block.innerBlocks?.map(b =>
                                b.id === innerBlock.id
                                  ? { ...b, attributes: { ...b.attributes, visibilitySourceBlockId: newSrcId || undefined, visibilityValues: [] } }
                                  : b
                              ),
                            })
                          }}
                        >
                          <option value="">— Toujours visible —</option>
                          {choiceSourceBlocks.map(src => (
                            <option key={src.id} value={src.id}>
                              {String.fromCharCode(65 + (block.innerBlocks || []).indexOf(src))} — {src.attributes.label || 'Sans titre'}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Sélection des valeurs qui affichent ce bloc */}
                      {innerBlock.attributes.visibilitySourceBlockId && sourceBlock && (
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">Valeurs qui affichent ce bloc :</label>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {(sourceBlock.attributes.choices || []).map(choice => {
                              const isChecked = (innerBlock.attributes.visibilityValues || []).includes(choice.value)
                              return (
                                <label key={choice.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-orange-50 px-1 py-0.5 rounded">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    className="accent-orange-500"
                                    onChange={(e) => {
                                      const current = innerBlock.attributes.visibilityValues || []
                                      const next = e.target.checked
                                        ? [...current, choice.value]
                                        : current.filter(v => v !== choice.value)
                                      updateBlock(block.id, {
                                        innerBlocks: block.innerBlocks?.map(b =>
                                          b.id === innerBlock.id
                                            ? { ...b, attributes: { ...b.attributes, visibilityValues: next } }
                                            : b
                                        ),
                                      })
                                    }}
                                  />
                                  <span>{choice.label}</span>
                                </label>
                              )
                            })}
                          </div>
                          {(sourceBlock.attributes.choices || []).length === 0 && (
                            <p className="text-xs text-gray-400 italic">Ce bloc n'a pas de choix définis.</p>
                          )}
                        </div>
                      )}

                      {/* Supprimer la condition */}
                      {hasCondition && (
                        <button
                          className="text-xs text-red-500 hover:text-red-600 underline"
                          onClick={() => {
                            updateBlock(block.id, {
                              innerBlocks: block.innerBlocks?.map(b =>
                                b.id === innerBlock.id
                                  ? { ...b, attributes: { ...b.attributes, visibilitySourceBlockId: undefined, visibilityValues: [] } }
                                  : b
                              ),
                            })
                          }}
                        >
                          Supprimer la condition
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {(!block.innerBlocks || block.innerBlocks.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-4 border-2 border-dashed border-orange-200 rounded-lg">
              Aucune question dans ce bloc répétable.<br />
              Glissez des blocs ici pour les ajouter.
            </p>
          )}
        </div>
      )}

      {/* Yes/No options */}
      {block.type === 'yes-no' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="yesLabel">Label "Oui"</Label>
            <Input
              id="yesLabel"
              value={block.attributes.yesLabel || 'Oui'}
              onChange={(e) => updateAttribute('yesLabel', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="noLabel">Label "Non"</Label>
            <Input
              id="noLabel"
              value={block.attributes.noLabel || 'Non'}
              onChange={(e) => updateAttribute('noLabel', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Quantity editor */}
      {block.type === 'quantity' && (
        <QuantityEditor block={block} updateAttribute={updateAttribute} isInnerBlock={isInnerBlock} parentGroupId={parentGroupId} />
      )}

      {/* Custom HTML */}
      <div className="space-y-2 pt-4 border-t">
        <Label htmlFor="customHTML">HTML personnalisé (avancé)</Label>
        <textarea
          id="customHTML"
          value={block.attributes.customHTML || ''}
          onChange={(e) => updateAttribute('customHTML', e.target.value)}
          placeholder="<p>HTML personnalisé...</p>"
          className="w-full min-h-[80px] px-3 py-2 text-sm font-mono border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
  )
}

// Composant pour l'éditeur de Date Avancée
interface AdvancedDateEditorProps {
  block: FormBlock
  updateAttribute: (key: string, value: any) => void
  isInnerBlock?: boolean
  parentGroupId?: string
}

function AdvancedDateEditor({ block, updateAttribute, isInnerBlock, parentGroupId }: AdvancedDateEditorProps) {
  const { blocks } = useFormBuilder()
  
  // Récupérer tous les blocs date et advanced-date du formulaire (qui sont avant ce bloc)
  const getAvailableDateBlocks = () => {
    const allBlocks: { id: string; label: string; type: string }[] = []
    let foundCurrentBlock = false
    
    for (const b of blocks) {
      if (b.id === block.id) {
        foundCurrentBlock = true
        break
      }
      
      if (b.type === 'date' || b.type === 'advanced-date') {
        allBlocks.push({
          id: b.id,
          label: b.attributes.label || 'Date sans titre',
          type: b.type === 'advanced-date' ? 'Date avancée' : 'Date',
        })
      }
      
      // Chercher aussi dans les innerBlocks des groupes et repeaters
      if ((b.type === 'group' || b.type === 'repeater') && b.innerBlocks) {
        for (const inner of b.innerBlocks) {
          if (inner.type === 'date' || inner.type === 'advanced-date') {
            allBlocks.push({
              id: inner.id,
              label: `${b.attributes.label || 'Groupe'} > ${inner.attributes.label || 'Date sans titre'}`,
              type: inner.type === 'advanced-date' ? 'Date avancée' : 'Date',
            })
          }
        }
      }
    }
    
    return allBlocks
  }
  
  const availableDateBlocks = getAvailableDateBlocks()
  
  const minDateType = block.attributes.minDateType || 'none'
  const maxDateType = block.attributes.maxDateType || 'none'
  const isDateRange = block.attributes.isDateRange || false

  return (
    <div className="space-y-4">
      {/* Plage de dates */}
      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-purple-700 flex items-center gap-2">
            <CalendarRange className="w-4 h-4" />
            Plage de dates
          </h4>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isDateRange}
              onChange={(e) => updateAttribute('isDateRange', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Permet de sélectionner une date de début et une date de fin
        </p>
        
        {isDateRange && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="space-y-2">
              <Label htmlFor="startDateLabel">Label date de début</Label>
              <Input
                id="startDateLabel"
                value={block.attributes.startDateLabel || ''}
                onChange={(e) => updateAttribute('startDateLabel', e.target.value)}
                placeholder="Date de début"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDateLabel">Label date de fin</Label>
              <Input
                id="endDateLabel"
                value={block.attributes.endDateLabel || ''}
                onChange={(e) => updateAttribute('endDateLabel', e.target.value)}
                placeholder="Date de fin"
              />
            </div>
          </div>
        )}
      </div>

      {/* Format de date */}
      <div className="space-y-2">
        <Label htmlFor="format">Format de date</Label>
        <select
          id="format"
          value={block.attributes.format || 'DD/MM/YYYY'}
          onChange={(e) => updateAttribute('format', e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        </select>
      </div>

      {/* Date Minimum */}
      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 space-y-3">
        <h4 className="font-medium text-orange-700 flex items-center gap-2">
          <CalendarRange className="w-4 h-4" />
          Date minimum
        </h4>
        
        <div className="space-y-2">
          <Label htmlFor="minDateType">Type de restriction</Label>
          <select
            id="minDateType"
            value={minDateType}
            onChange={(e) => updateAttribute('minDateType', e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="none">Aucune restriction</option>
            <option value="today">Aujourd'hui</option>
            <option value="specific">Date spécifique</option>
            {availableDateBlocks.length > 0 && <option value="block">Valeur d'un autre bloc</option>}
          </select>
        </div>

        {minDateType === 'specific' && (
          <div className="space-y-2">
            <Label htmlFor="minDate">Date minimum</Label>
            <Input
              id="minDate"
              type="date"
              value={block.attributes.minDate || ''}
              onChange={(e) => updateAttribute('minDate', e.target.value)}
            />
          </div>
        )}

        {minDateType === 'block' && availableDateBlocks.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="minDateBlockId">Bloc source</Label>
            <select
              id="minDateBlockId"
              value={block.attributes.minDateBlockId || ''}
              onChange={(e) => updateAttribute('minDateBlockId', e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Sélectionner un bloc</option>
              {availableDateBlocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} ({b.type})
                </option>
              ))}
            </select>
          </div>
        )}

        {(minDateType === 'today' || minDateType === 'block') && (
          <div className="space-y-2">
            <Label htmlFor="minDateOffset">Décalage (jours)</Label>
            <Input
              id="minDateOffset"
              type="number"
              value={block.attributes.minDateOffset ?? 0}
              onChange={(e) => updateAttribute('minDateOffset', Number(e.target.value))}
              placeholder="0"
            />
            <p className="text-xs text-gray-500">
              Nombre de jours à ajouter (+) ou retrancher (-) de la date source
            </p>
          </div>
        )}
      </div>

      {/* Date Maximum */}
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-3">
        <h4 className="font-medium text-blue-700 flex items-center gap-2">
          <CalendarRange className="w-4 h-4" />
          Date maximum
        </h4>
        
        <div className="space-y-2">
          <Label htmlFor="maxDateType">Type de restriction</Label>
          <select
            id="maxDateType"
            value={maxDateType}
            onChange={(e) => updateAttribute('maxDateType', e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="none">Aucune restriction</option>
            <option value="today">Aujourd'hui</option>
            <option value="specific">Date spécifique</option>
            {availableDateBlocks.length > 0 && <option value="block">Valeur d'un autre bloc</option>}
          </select>
        </div>

        {maxDateType === 'specific' && (
          <div className="space-y-2">
            <Label htmlFor="maxDate">Date maximum</Label>
            <Input
              id="maxDate"
              type="date"
              value={block.attributes.maxDate || ''}
              onChange={(e) => updateAttribute('maxDate', e.target.value)}
            />
          </div>
        )}

        {maxDateType === 'block' && availableDateBlocks.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="maxDateBlockId">Bloc source</Label>
            <select
              id="maxDateBlockId"
              value={block.attributes.maxDateBlockId || ''}
              onChange={(e) => updateAttribute('maxDateBlockId', e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Sélectionner un bloc</option>
              {availableDateBlocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} ({b.type})
                </option>
              ))}
            </select>
          </div>
        )}

        {(maxDateType === 'today' || maxDateType === 'block') && (
          <div className="space-y-2">
            <Label htmlFor="maxDateOffset">Décalage (jours)</Label>
            <Input
              id="maxDateOffset"
              type="number"
              value={block.attributes.maxDateOffset ?? 0}
              onChange={(e) => updateAttribute('maxDateOffset', Number(e.target.value))}
              placeholder="0"
            />
            <p className="text-xs text-gray-500">
              Nombre de jours à ajouter (+) ou retrancher (-) de la date source
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Composant pour l'éditeur de Sélection Image
interface ImageSelectionEditorProps {
  block: FormBlock
  updateAttribute: (key: string, value: any) => void
}

function ImageSelectionEditor({ block, updateAttribute }: ImageSelectionEditorProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [uploadingChoiceId, setUploadingChoiceId] = useState<string | null>(null)

  const choices = block.attributes.choices || []

  const addImageChoice = () => {
    const newChoice: BlockChoice = {
      id: uuidv4(),
      label: `Image ${choices.length + 1}`,
      value: `image-${choices.length + 1}`,
      imageUrl: '',
    }
    updateAttribute('choices', [...choices, newChoice])
  }

  const updateChoice = (choiceId: string, updates: Partial<BlockChoice>) => {
    updateAttribute(
      'choices',
      choices.map((c: BlockChoice) => (c.id === choiceId ? { ...c, ...updates } : c))
    )
  }

  const removeChoice = (choiceId: string) => {
    updateAttribute(
      'choices',
      choices.filter((c: BlockChoice) => c.id !== choiceId)
    )
  }

  const handleFileUpload = async (choiceId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingChoiceId(choiceId)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        updateChoice(choiceId, { imageUrl: data.url })
      } else {
        console.error('Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setUploadingChoiceId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Options de mise en page */}
      <div className="p-3 bg-fuchsia-50 rounded-lg border border-fuchsia-200 space-y-3">
        <h4 className="font-medium text-fuchsia-700 flex items-center gap-2">
          <Image className="w-4 h-4" />
          Options d'affichage
        </h4>

        {/* Layout */}
        <div className="space-y-2">
          <Label>Disposition</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateAttribute('imageLayout', 'side-by-side')}
              className={`flex items-center justify-center gap-2 p-2 rounded border-2 transition-colors ${
                block.attributes.imageLayout === 'side-by-side'
                  ? 'border-fuchsia-500 bg-fuchsia-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex gap-1">
                <div className="w-4 h-4 bg-gray-300 rounded-sm" />
                <div className="w-4 h-4 bg-gray-300 rounded-sm" />
              </div>
              <span className="text-xs">Côte à côte</span>
            </button>
            <button
              onClick={() => updateAttribute('imageLayout', 'stacked')}
              className={`flex items-center justify-center gap-2 p-2 rounded border-2 transition-colors ${
                block.attributes.imageLayout === 'stacked'
                  ? 'border-fuchsia-500 bg-fuchsia-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex flex-col gap-1">
                <div className="w-8 h-3 bg-gray-300 rounded-sm" />
                <div className="w-8 h-3 bg-gray-300 rounded-sm" />
              </div>
              <span className="text-xs">Superposé</span>
            </button>
          </div>
        </div>

        {/* Colonnes (uniquement pour side-by-side) */}
        {block.attributes.imageLayout === 'side-by-side' && (
          <div className="space-y-2">
            <Label>Nombre de colonnes</Label>
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 4].map((cols) => (
                <button
                  key={cols}
                  onClick={() => updateAttribute('imageColumns', cols)}
                  className={`p-2 rounded border-2 transition-colors text-sm font-medium ${
                    block.attributes.imageColumns === cols
                      ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {cols} col.
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              💡 Sur mobile, l'affichage passera automatiquement en 2 colonnes
            </p>
          </div>
        )}

        {/* Taille des images */}
        <div className="space-y-2">
          <Label>Taille des images</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'small', label: 'Petite' },
              { value: 'medium', label: 'Moyenne' },
              { value: 'large', label: 'Grande' },
            ].map((size) => (
              <button
                key={size.value}
                onClick={() => updateAttribute('imageSize', size.value)}
                className={`p-2 rounded border-2 transition-colors text-sm ${
                  block.attributes.imageSize === size.value
                    ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>

        {/* Afficher les labels */}
        <div className="flex items-center justify-between">
          <Label htmlFor="showImageLabels">Afficher les labels</Label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="showImageLabels"
              checked={block.attributes.showImageLabels !== false}
              onChange={(e) => updateAttribute('showImageLabels', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-fuchsia-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-500"></div>
          </label>
        </div>

        {/* Autoriser plusieurs sélections */}
        <div className="flex items-center justify-between">
          <Label htmlFor="allowMultipleImages">Autoriser plusieurs sélections</Label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="allowMultipleImages"
              checked={block.attributes.allowMultiple || false}
              onChange={(e) => updateAttribute('allowMultiple', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-fuchsia-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-500"></div>
          </label>
        </div>
      </div>

      {/* Liste des images */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Images ({choices.length})</Label>
          <Button size="sm" variant="outline" onClick={addImageChoice}>
            <Plus className="w-4 h-4 mr-1" />
            Ajouter
          </Button>
        </div>

        <div className="space-y-3">
          {choices.map((choice: BlockChoice, index: number) => (
            <div
              key={choice.id}
              className="p-3 border rounded-lg bg-gray-50 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                  <span className="w-6 h-6 flex items-center justify-center bg-fuchsia-100 text-fuchsia-600 rounded text-xs font-medium">
                    {String.fromCharCode(65 + index)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => removeChoice(choice.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Image preview / upload */}
              <div className="space-y-2">
                {choice.imageUrl ? (
                  <div className="relative group">
                    <img
                      src={choice.imageUrl}
                      alt={choice.label}
                      className="w-full h-24 object-cover rounded-md border"
                    />
                    <button
                      onClick={() => updateChoice(choice.id, { imageUrl: '' })}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="URL de l'image"
                      value={choice.imageUrl || ''}
                      onChange={(e) => updateChoice(choice.id, { imageUrl: e.target.value })}
                    />
                    <input
                      ref={(el) => { fileInputRefs.current[choice.id] = el }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(choice.id, e)}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRefs.current[choice.id]?.click()}
                      disabled={uploadingChoiceId === choice.id}
                      className="w-full"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingChoiceId === choice.id ? 'Upload...' : 'Uploader'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Label */}
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Label</Label>
                <Input
                  value={choice.label}
                  onChange={(e) =>
                    updateChoice(choice.id, {
                      label: e.target.value,
                      value: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                    })
                  }
                  placeholder="Nom de l'image"
                  className="text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        {choices.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4 border-2 border-dashed rounded-lg">
            Aucune image. Cliquez sur "Ajouter" pour commencer.
          </p>
        )}
      </div>
    </div>
  )
}

// Composant média pour short-text, long-text, multiple-choice, dropdown
interface BlockMediaEditorProps {
  block: FormBlock
  updateAttribute: (key: string, value: any) => void
}

function BlockMediaEditor({ block, updateAttribute }: BlockMediaEditorProps) {
  const imageFileRef = useRef<HTMLInputElement>(null)
  const excelFileRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const media = block.attributes.blockMedia
  const enabled = !!media

  const handleToggle = (checked: boolean) => {
    if (!checked) {
      updateAttribute('blockMedia', undefined)
    } else {
      updateAttribute('blockMedia', { type: 'image', url: '', name: '', imagePosition: 'top' })
    }
  }

  const handleUpload = async (file: File) => {
    setUploadError('')
    setIsUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setUploadError(data.error || 'Erreur lors de l\'upload')
        return
      }
      updateAttribute('blockMedia', { ...media, url: data.url, name: file.name })
    } catch {
      setUploadError('Erreur réseau')
    } finally {
      setIsUploading(false)
    }
  }

  // NextCloud picker state
  const [ncOpen, setNcOpen] = useState(false)
  const [ncConfigured, setNcConfigured] = useState<boolean | null>(null)
  const [ncBasePath, setNcBasePath] = useState('/')
  const [ncBrowsePath, setNcBrowsePath] = useState('/')
  const [ncItems, setNcItems] = useState<{ name: string; path: string; type: 'folder' | 'file'; contentType?: string }[]>([])
  const [ncLoading, setNcLoading] = useState(false)
  const [ncSelecting, setNcSelecting] = useState(false)

  const isFromNextCloud = !!(media?.url?.startsWith('/api/admin/nextcloud/file'))

  // Vérifie si NextCloud est configuré (une seule fois par montage)
  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => {
        setNcConfigured(!!(d.nextcloudUrl && d.nextcloudUser && d.nextcloudPass))
        if (d.nextcloudBasePath) setNcBasePath(d.nextcloudBasePath)
      })
      .catch(() => setNcConfigured(false))
  }, [])

  const openNcPicker = () => {
    setNcOpen(true)
    ncBrowse(ncBasePath)
  }

  const ncBrowse = async (path: string) => {
    setNcLoading(true)
    setNcBrowsePath(path)
    try {
      const res = await fetch(`/api/admin/nextcloud/browse?path=${encodeURIComponent(path)}`)
      const data = await res.json()
      if (res.ok) {
        const type = media?.type || 'image'
        const filtered = (data.items as typeof ncItems).filter(item => {
          if (item.type === 'folder') return true
          const ext = item.name.split('.').pop()?.toLowerCase() || ''
          if (type === 'image') {
            return (item.contentType || '').startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg'].includes(ext)
          }
          return ext === 'xlsx'
        })
        setNcItems(filtered)
      }
    } catch { /* silently */ }
    finally { setNcLoading(false) }
  }

  const ncSelectFile = async (filePath: string, fileName: string) => {
    setNcSelecting(true)
    try {
      const res = await fetch('/api/admin/nextcloud/browse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      })
      const data = await res.json()
      if (res.ok) {
        updateAttribute('blockMedia', { ...media, url: data.url, name: fileName })
        setNcOpen(false)
      }
    } catch { /* silently */ }
    finally { setNcSelecting(false) }
  }

  const ncBreadcrumbs = ncBrowsePath.split('/').filter(Boolean)

  const positionOptions = [
    { value: 'top',    label: 'Haut',   icon: <ArrowUp className="w-4 h-4" /> },
    { value: 'bottom', label: 'Bas',    icon: <ArrowDown className="w-4 h-4" /> },
    { value: 'left',   label: 'Gauche', icon: <AlignLeft className="w-4 h-4" /> },
    { value: 'right',  label: 'Droite', icon: <AlignRight className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
      <div className="flex items-center justify-between">
        <div>
          <Label>Image / Fichier Excel</Label>
          <p className="text-xs text-gray-500 mt-0.5">Afficher un média à côté de la question</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {enabled && media && (
        <>
          {/* Type de média */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'image', label: 'Image', icon: <Image className="w-4 h-4" /> },
                { value: 'excel', label: 'Fichier Excel', icon: <FileSpreadsheet className="w-4 h-4" /> },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => updateAttribute('blockMedia', { type: t.value, url: '', name: '', imagePosition: 'top' })}
                  className={`flex items-center gap-2 p-2 rounded border-2 text-sm transition-colors ${
                    media.type === t.value ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Image ── */}
          {media.type === 'image' && (
            <div className="space-y-2">
              <Label>Image</Label>
              {media.url ? (
                <div className="relative group space-y-1">
                  <img src={media.url} alt={media.name} className="w-full h-32 object-cover rounded-md border" />
                  {isFromNextCloud && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      <Cloud className="w-2.5 h-2.5" /> Depuis NextCloud
                    </span>
                  )}
                  <button onClick={() => updateAttribute('blockMedia', { ...media, url: '', name: '' })}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input ref={imageFileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => imageFileRef.current?.click()} disabled={isUploading}>
                      <Upload className="w-4 h-4 mr-2" />
                      {isUploading ? 'Upload...' : 'Local'}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={openNcPicker}
                      disabled={!ncConfigured}
                      title={ncConfigured === false ? 'NextCloud non configuré' : 'Choisir depuis NextCloud'}
                      className="border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40">
                      <Cloud className="w-4 h-4 mr-2" />
                      NextCloud
                    </Button>
                  </div>
                  <Input placeholder="ou coller une URL"
                    onChange={(e) => e.target.value && updateAttribute('blockMedia', { ...media, url: e.target.value, name: 'Image' })} />
                </div>
              )}

              {/* Position */}
              <div className="space-y-2 pt-1">
                <Label>Position de l'image</Label>
                <div className="grid grid-cols-4 gap-1">
                  {positionOptions.map((p) => (
                    <button key={p.value}
                      onClick={() => updateAttribute('blockMedia', { ...media, imagePosition: p.value })}
                      className={`flex flex-col items-center justify-center p-2 rounded border-2 text-xs transition-colors ${
                        (media.imagePosition || 'top') === p.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`} title={p.label}>
                      {p.icon}
                      <span className="mt-1">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Excel ── */}
          {media.type === 'excel' && (
            <div className="space-y-3">
              <Label>Fichier Excel (.xlsx)</Label>
              {media.url ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-green-50">
                  {isFromNextCloud
                    ? <Cloud className="w-4 h-4 text-blue-500 shrink-0" />
                    : <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-green-700 truncate">{media.name}</p>
                    {isFromNextCloud && <p className="text-[10px] text-blue-500">Depuis NextCloud</p>}
                  </div>
                  <button onClick={() => updateAttribute('blockMedia', { ...media, url: '', name: '' })}
                    className="p-1 text-red-500 hover:text-red-600 shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <input ref={excelFileRef} type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => excelFileRef.current?.click()} disabled={isUploading}>
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploading ? 'Upload...' : 'Local'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={openNcPicker}
                    disabled={!ncConfigured}
                    title={ncConfigured === false ? 'NextCloud non configuré' : 'Choisir depuis NextCloud'}
                    className="border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-40">
                    <Cloud className="w-4 h-4 mr-2" />
                    NextCloud
                  </Button>
                </div>
              )}

              {/* Options Excel */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Options d'affichage</Label>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Expand className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">Bouton agrandir</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={media.excelAllowExpand ?? true}
                      onChange={(e) => updateAttribute('blockMedia', { ...media, excelAllowExpand: e.target.checked })}
                      className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-gray-500" />
                    <span className="text-sm">Bouton télécharger</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={media.excelAllowDownload ?? false}
                      onChange={(e) => updateAttribute('blockMedia', { ...media, excelAllowDownload: e.target.checked })}
                      className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}

          {/* ── Dialog navigateur NextCloud ── */}
          <Dialog open={ncOpen} onOpenChange={setNcOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-blue-500" />
                  Choisir depuis NextCloud
                  <span className="text-xs font-normal text-gray-400 ml-1">
                    {media.type === 'image' ? '(images)' : '(.xlsx)'}
                  </span>
                </DialogTitle>
              </DialogHeader>

              {/* Fil d'Ariane */}
              <div className="flex items-center gap-1 text-sm flex-wrap px-2 py-1.5 bg-gray-50 rounded border">
                <button className="text-blue-600 hover:underline font-medium" onClick={() => ncBrowse('/')}>
                  Racine
                </button>
                {ncBreadcrumbs.map((crumb, i) => {
                  const crumbPath = '/' + ncBreadcrumbs.slice(0, i + 1).join('/')
                  return (
                    <span key={i} className="flex items-center gap-1">
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                      <button className="text-blue-600 hover:underline" onClick={() => ncBrowse(crumbPath)}>
                        {crumb}
                      </button>
                    </span>
                  )
                })}
              </div>

              {/* Liste des fichiers */}
              <div className="border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                {ncLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : ncItems.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-10">
                    {media.type === 'image' ? 'Aucune image dans ce dossier' : 'Aucun fichier .xlsx dans ce dossier'}
                  </p>
                ) : (
                  <div className="divide-y">
                    {ncItems.map((item) => {
                      const isFolder = item.type === 'folder'
                      const ext = item.name.split('.').pop()?.toLowerCase() || ''
                      const isImg = ['jpg','jpeg','png','gif','webp','svg'].includes(ext)
                      return (
                        <button key={item.path}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 text-left transition-colors disabled:opacity-60"
                          onClick={() => isFolder ? ncBrowse(item.path) : ncSelectFile(item.path, item.name)}
                          disabled={ncSelecting}>
                          {isFolder
                            ? <Folder className="w-4 h-4 text-yellow-400 shrink-0" />
                            : isImg
                              ? <Image className="w-4 h-4 text-purple-400 shrink-0" />
                              : <FileSpreadsheet className="w-4 h-4 text-green-500 shrink-0" />}
                          <span className={`flex-1 truncate ${isFolder ? 'font-medium text-gray-800' : 'text-gray-700'}`}>
                            {item.name}
                          </span>
                          {isFolder
                            ? <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
                            : ncSelecting
                              ? <Loader2 className="w-3 h-3 animate-spin text-gray-400 shrink-0" />
                              : <CheckCircle className="w-3 h-3 text-green-400 opacity-50 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setNcOpen(false)}>Annuler</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}

// Composant pour les attachments du welcome-screen et thankyou-screen
interface WelcomeScreenAttachmentProps {
  block: FormBlock
  updateAttribute: (key: string, value: any) => void
}

function WelcomeScreenAttachment({ block, updateAttribute }: WelcomeScreenAttachmentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [focalPointDragging, setFocalPointDragging] = useState(false)
  
  const showAttachment = block.attributes.showAttachment || false
  const attachmentType = block.attributes.attachmentType || 'image'
  const attachmentUrl = block.attributes.attachmentUrl || ''
  const attachmentLayout = block.attributes.attachmentLayout || 'stack'
  const focalPoint = block.attributes.focalPoint || { x: 50, y: 50 }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        updateAttribute('attachmentUrl', data.url)
      } else {
        console.error('Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFocalPointClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    updateAttribute('focalPoint', { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) })
  }

  const layouts = [
    { value: 'stack', label: 'Empilé', icon: <Layers className="w-4 h-4" /> },
    { value: 'float-right', label: 'Float Right', icon: <PanelRight className="w-4 h-4" /> },
    { value: 'float-left', label: 'Float Left', icon: <PanelLeft className="w-4 h-4" /> },
    { value: 'split-right', label: 'Split Right', icon: <LayoutTemplate className="w-4 h-4 rotate-180" /> },
    { value: 'split-left', label: 'Split Left', icon: <LayoutTemplate className="w-4 h-4" /> },
  ]

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
      {/* Toggle Show Attachment */}
      <div className="flex items-center justify-between">
        <Label htmlFor="showAttachment">Afficher une pièce jointe</Label>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            id="showAttachment"
            checked={showAttachment}
            onChange={(e) => updateAttribute('showAttachment', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {showAttachment && (
        <>
          {/* Attachment Type */}
          <div className="space-y-2">
            <Label>Type de pièce jointe</Label>
            <div className="relative">
              <select
                value={attachmentType}
                onChange={(e) => updateAttribute('attachmentType', e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary appearance-none bg-white"
              >
                <option value="image">Image</option>
                <option value="video">Vidéo (YouTube)</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Image Upload */}
          {attachmentType === 'image' && (
            <div className="space-y-2">
              <Label>Image</Label>
              {attachmentUrl ? (
                <div className="space-y-2">
                  <div className="relative group">
                    <img 
                      src={attachmentUrl} 
                      alt="Preview" 
                      className="w-full h-32 object-cover rounded-md border"
                    />
                    <button
                      onClick={() => updateAttribute('attachmentUrl', '')}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="URL de l'image ou uploadez un fichier"
                    value={attachmentUrl}
                    onChange={(e) => updateAttribute('attachmentUrl', e.target.value)}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploading ? 'Upload en cours...' : 'Uploader une image'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Video URL */}
          {attachmentType === 'video' && (
            <div className="space-y-2">
              <Label>URL de la vidéo YouTube</Label>
              <Input
                placeholder="https://www.youtube.com/watch?v=..."
                value={attachmentUrl}
                onChange={(e) => updateAttribute('attachmentUrl', e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Collez l'URL d'une vidéo YouTube
              </p>
            </div>
          )}

          {/* Layout */}
          <div className="space-y-2">
            <Label>Disposition</Label>
            <div className="grid grid-cols-5 gap-1">
              {layouts.map((layout) => (
                <button
                  key={layout.value}
                  onClick={() => updateAttribute('attachmentLayout', layout.value)}
                  className={`flex flex-col items-center justify-center p-2 rounded border-2 transition-colors ${
                    attachmentLayout === layout.value
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  title={layout.label}
                >
                  {layout.icon}
                  <span className="text-[10px] mt-1 text-gray-500">{layout.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Focal Point Picker - Only for images */}
          {attachmentType === 'image' && attachmentUrl && (
            <div className="space-y-2">
              <Label>Point focal</Label>
              <div
                className="relative w-full h-32 rounded-md overflow-hidden cursor-crosshair border"
                onClick={handleFocalPointClick}
              >
                <img
                  src={attachmentUrl}
                  alt="Focal point"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }}
                />
                <div
                  className="absolute w-4 h-4 bg-white border-2 border-primary rounded-full -translate-x-1/2 -translate-y-1/2 shadow-lg"
                  style={{ left: `${focalPoint.x}%`, top: `${focalPoint.y}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">GAUCHE</Label>
                  <div className="flex items-center">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={focalPoint.x}
                      onChange={(e) => updateAttribute('focalPoint', { ...focalPoint, x: Number(e.target.value) })}
                      className="text-sm"
                    />
                    <span className="ml-1 text-gray-400 text-sm">%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">HAUT</Label>
                  <div className="flex items-center">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={focalPoint.y}
                      onChange={(e) => updateAttribute('focalPoint', { ...focalPoint, y: Number(e.target.value) })}
                      className="text-sm"
                    />
                    <span className="ml-1 text-gray-400 text-sm">%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Composant pour le filtrage des choix d'un dropdown selon un bloc source
function DropdownFilterEditor({ block, isInnerBlock = false, parentGroupId }: {
  block: FormBlock
  isInnerBlock?: boolean
  parentGroupId?: string
}) {
  const { blocks, updateBlock, updateInnerBlock } = useFormBuilder()
  const [expandedSourceValue, setExpandedSourceValue] = useState<string | null>(null)
  const [choiceSearchFilter, setChoiceSearchFilter] = useState('')

  const getAvailableSourceBlocks = () => {
    const result: { id: string; label: string; choices: BlockChoice[] }[] = []
    const choiceTypes = ['dropdown', 'multiple-choice', 'image-selection']

    if (isInnerBlock && parentGroupId) {
      const parentBlock = blocks.find((b) => b.id === parentGroupId)
      if (parentBlock?.innerBlocks) {
        for (const inner of parentBlock.innerBlocks) {
          if (inner.id === block.id) break
          if (choiceTypes.includes(inner.type)) {
            result.push({ id: inner.id, label: inner.attributes.label || 'Sans titre', choices: inner.attributes.choices || [] })
          }
        }
      }
    }

    for (const b of blocks) {
      if (b.id === block.id || b.id === parentGroupId) break
      if (choiceTypes.includes(b.type)) {
        result.push({ id: b.id, label: b.attributes.label || 'Sans titre', choices: b.attributes.choices || [] })
      }
      if ((b.type === 'group' || b.type === 'repeater') && b.innerBlocks) {
        for (const inner of b.innerBlocks) {
          if (choiceTypes.includes(inner.type)) {
            result.push({
              id: inner.id,
              label: `${b.attributes.label || 'Groupe'} › ${inner.attributes.label || 'Sans titre'}`,
              choices: inner.attributes.choices || [],
            })
          }
        }
      }
    }
    return result
  }

  const batchUpdate = (attrs: Partial<typeof block.attributes>) => {
    const newAttrs = { ...block.attributes, ...attrs }
    if (isInnerBlock && parentGroupId) {
      updateInnerBlock(parentGroupId, block.id, { attributes: newAttrs })
    } else {
      updateBlock(block.id, { attributes: newAttrs })
    }
  }

  const availableSourceBlocks = getAvailableSourceBlocks()
  const sourceBlockId = block.attributes.choiceFilterSourceBlockId || ''
  const sourceBlock = availableSourceBlocks.find((b) => b.id === sourceBlockId)
  const choiceFilters: NonNullable<typeof block.attributes.choiceFilters> = block.attributes.choiceFilters || []
  const currentChoices = block.attributes.choices || []

  const getHiddenChoiceIds = (sourceValue: string) =>
    choiceFilters.find((f) => f.sourceValue === sourceValue)?.hiddenChoiceIds || []

  const toggleHiddenChoice = (sourceValue: string, choiceId: string) => {
    const currentHidden = getHiddenChoiceIds(sourceValue)
    const newHidden = currentHidden.includes(choiceId)
      ? currentHidden.filter((id) => id !== choiceId)
      : [...currentHidden, choiceId]
    const newFilters = choiceFilters.filter((f) => f.sourceValue !== sourceValue)
    if (newHidden.length > 0) newFilters.push({ sourceValue, hiddenChoiceIds: newHidden })
    batchUpdate({ choiceFilters: newFilters.length > 0 ? newFilters : [] })
  }

  return (
    <div className="p-4 bg-violet-50 rounded-lg border border-violet-200 space-y-3">
      <h4 className="font-medium text-violet-700 flex items-center gap-2">
        <Filter className="w-4 h-4" />
        Filtrage des choix
      </h4>
      <p className="text-xs text-gray-500">
        Masquer certains choix selon la réponse d'un bloc précédent.
      </p>
      <div className="space-y-2">
        <select
          value={sourceBlockId}
          onChange={(e) => batchUpdate({ choiceFilterSourceBlockId: e.target.value || undefined, choiceFilters: [] })}
          className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">— Aucun filtre —</option>
          {availableSourceBlocks.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
        {availableSourceBlocks.length === 0 && (
          <p className="text-xs text-amber-600">
            Aucun bloc de choix trouvé avant ce bloc.
          </p>
        )}
      </div>

      {sourceBlock && sourceBlock.choices.length > 0 && currentChoices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-600 font-medium">
            Cochez les choix à masquer pour chaque valeur :
          </p>
          {sourceBlock.choices.map((srcChoice) => {
            const hiddenIds = getHiddenChoiceIds(srcChoice.value)
            const isExpanded = expandedSourceValue === srcChoice.value
            return (
              <div key={srcChoice.id} className="border rounded-md overflow-hidden bg-white">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-sm text-left"
                  onClick={() => {
                    setExpandedSourceValue(isExpanded ? null : srcChoice.value)
                    setChoiceSearchFilter('')
                  }}
                >
                  <span className="font-medium">{srcChoice.label}</span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    {hiddenIds.length > 0
                      ? <span className="text-orange-500">{hiddenIds.length} masqué{hiddenIds.length > 1 ? 's' : ''}</span>
                      : 'tout visible'}
                    <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {isExpanded && (
                  <div className="border-t bg-gray-50">
                    <div className="px-3 pt-2 pb-1 relative">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        value={choiceSearchFilter}
                        onChange={(e) => setChoiceSearchFilter(e.target.value)}
                        placeholder="Rechercher un choix..."
                        className="w-full pl-7 pr-3 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                      />
                    </div>
                    <div className="px-3 pb-2 space-y-1.5 max-h-52 overflow-y-auto">
                      {currentChoices
                        .filter((c) =>
                          choiceSearchFilter.trim() === '' ||
                          c.label.toLowerCase().includes(choiceSearchFilter.toLowerCase())
                        )
                        .map((choice) => {
                          const isHidden = hiddenIds.includes(choice.id)
                          return (
                            <label key={choice.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isHidden}
                                onChange={() => toggleHiddenChoice(srcChoice.value, choice.id)}
                                className="rounded"
                              />
                              <span className={isHidden ? 'line-through text-gray-400' : ''}>{choice.label}</span>
                            </label>
                          )
                        })}
                      {choiceSearchFilter.trim() !== '' &&
                        currentChoices.filter((c) =>
                          c.label.toLowerCase().includes(choiceSearchFilter.toLowerCase())
                        ).length === 0 && (
                          <p className="text-xs text-gray-400 py-1">Aucun choix ne correspond.</p>
                        )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Composant pour l'éditeur de Quantité
interface QuantityEditorProps {
  block: FormBlock
  updateAttribute: (key: string, value: any) => void
  isInnerBlock?: boolean
  parentGroupId?: string
}

function QuantityEditor({ block, updateAttribute, isInnerBlock, parentGroupId }: QuantityEditorProps) {
  const { blocks, updateBlock, updateInnerBlock } = useFormBuilder()
  const [quantitySearchFilter, setQuantitySearchFilter] = useState('')

  const getAvailableChoiceBlocks = () => {
    const result: { id: string; label: string; typeName: string; choices: BlockChoice[] }[] = []
    const choiceTypes = ['dropdown', 'multiple-choice', 'image-selection']
    const typeName = (t: string) =>
      t === 'dropdown' ? 'Liste déroulante' : t === 'multiple-choice' ? 'Choix multiple' : 'Sélection Image'

    // Si le bloc est à l'intérieur d'un groupe/répéteur, chercher parmi les blocs frères qui le précèdent
    if (isInnerBlock && parentGroupId) {
      const parentBlock = blocks.find((b) => b.id === parentGroupId)
      if (parentBlock?.innerBlocks) {
        for (const inner of parentBlock.innerBlocks) {
          if (inner.id === block.id) break
          if (choiceTypes.includes(inner.type)) {
            result.push({
              id: inner.id,
              label: inner.attributes.label || 'Sans titre',
              typeName: typeName(inner.type),
              choices: inner.attributes.choices || [],
            })
          }
        }
      }
    }

    // Chercher aussi dans les blocs de haut niveau (et leurs innerBlocks) qui précèdent le bloc courant ou son parent
    for (const b of blocks) {
      if (b.id === block.id || b.id === parentGroupId) break
      if (choiceTypes.includes(b.type)) {
        result.push({
          id: b.id,
          label: b.attributes.label || 'Sans titre',
          typeName: typeName(b.type),
          choices: b.attributes.choices || [],
        })
      }
      if ((b.type === 'group' || b.type === 'repeater') && b.innerBlocks) {
        for (const inner of b.innerBlocks) {
          if (choiceTypes.includes(inner.type)) {
            result.push({
              id: inner.id,
              label: `${b.attributes.label || 'Groupe'} › ${inner.attributes.label || 'Sans titre'}`,
              typeName: typeName(inner.type),
              choices: inner.attributes.choices || [],
            })
          }
        }
      }
    }

    return result
  }

  const availableBlocks = getAvailableChoiceBlocks()
  const sourceBlockId = block.attributes.quantitySourceBlockId || ''
  const sourceBlock = availableBlocks.find((b) => b.id === sourceBlockId)
  const quantityItems: NonNullable<FormBlock['attributes']['quantityItems']> = block.attributes.quantityItems || []

  const getItemConfig = (choiceId: string) =>
    quantityItems.find((item) => item.choiceId === choiceId) || { choiceId, choiceLabel: '', choiceValue: '', min: 1, max: undefined }

  const updateItemConfig = (
    choiceId: string,
    choiceLabel: string,
    choiceValue: string,
    updates: { min?: number; max?: number | undefined }
  ) => {
    const existing = quantityItems.find((item) => item.choiceId === choiceId)
    const newItems = existing
      ? quantityItems.map((item) => (item.choiceId === choiceId ? { ...item, ...updates } : item))
      : [...quantityItems, { choiceId, choiceLabel, choiceValue, min: 1, ...updates }]
    updateAttribute('quantityItems', newItems)
  }

  const handleSourceBlockChange = (newId: string) => {
    // Les deux champs doivent être mis à jour en une seule opération pour éviter
    // que le deuxième appel écrase le premier avec les attributs périmés de la fermeture.
    const newAttrs = { ...block.attributes, quantitySourceBlockId: newId, quantityItems: [] }
    if (isInnerBlock && parentGroupId) {
      updateInnerBlock(parentGroupId, block.id, { attributes: newAttrs })
    } else {
      updateBlock(block.id, { attributes: newAttrs })
    }
  }

  return (
    <div className="space-y-4">
      {/* Bloc source */}
      <div className="p-4 bg-lime-50 rounded-lg border border-lime-200 space-y-3">
        <h4 className="font-medium text-lime-700 flex items-center gap-2">
          <Package className="w-4 h-4" />
          Bloc source
        </h4>
        <p className="text-xs text-gray-500">
          Sélectionnez le bloc Liste déroulante, Choix multiple ou Sélection Image dont vous souhaitez gérer les quantités.
        </p>
        <div className="space-y-2">
          <select
            value={sourceBlockId}
            onChange={(e) => handleSourceBlockChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">— Sélectionner un bloc —</option>
            {availableBlocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label} ({b.typeName})
              </option>
            ))}
          </select>
          {availableBlocks.length === 0 && (
            <p className="text-xs text-amber-600">
              Aucun bloc de choix trouvé avant ce bloc. Ajoutez d'abord une Liste déroulante, un Choix multiple ou une Sélection Image.
            </p>
          )}
        </div>
      </div>

      {/* Configuration par option */}
      {sourceBlock && sourceBlock.choices.length > 0 && (
        <div className="space-y-3">
          <div>
            <Label>Quantités par option</Label>
            <p className="text-xs text-gray-500 mt-0.5">
              Minimum par défaut : 1 — Laissez Maximum vide pour illimité.
            </p>
          </div>

          {sourceBlock.choices.length > 5 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={quantitySearchFilter}
                onChange={(e) => setQuantitySearchFilter(e.target.value)}
                placeholder="Rechercher une option..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {sourceBlock.choices
            .filter((choice) =>
              quantitySearchFilter.trim() === '' ||
              choice.label.toLowerCase().includes(quantitySearchFilter.toLowerCase())
            )
            .map((choice) => {
              const config = getItemConfig(choice.id)
              return (
                <div key={choice.id} className="p-3 border rounded-lg bg-gray-50 space-y-2">
                  <p className="text-sm font-medium text-gray-700 truncate">{choice.label}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`qty-min-${choice.id}`} className="text-xs">Minimum</Label>
                      <Input
                        id={`qty-min-${choice.id}`}
                        type="number"
                        min={0}
                        value={config.min ?? 1}
                        onChange={(e) =>
                          updateItemConfig(choice.id, choice.label, choice.value, {
                            min: e.target.value !== '' ? Number(e.target.value) : 1,
                            max: config.max,
                          })
                        }
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`qty-max-${choice.id}`} className="text-xs">Maximum</Label>
                      <Input
                        id={`qty-max-${choice.id}`}
                        type="number"
                        min={1}
                        value={config.max ?? ''}
                        onChange={(e) =>
                          updateItemConfig(choice.id, choice.label, choice.value, {
                            min: config.min ?? 1,
                            max: e.target.value !== '' ? Number(e.target.value) : undefined,
                          })
                        }
                        placeholder="Illimité"
                      />
                    </div>
                  </div>
                </div>
              )
            })}

          {quantitySearchFilter.trim() !== '' &&
            sourceBlock.choices.filter((c) =>
              c.label.toLowerCase().includes(quantitySearchFilter.toLowerCase())
            ).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">Aucune option ne correspond à votre recherche.</p>
            )}
        </div>
      )}

      {sourceBlock && sourceBlock.choices.length === 0 && (
        <p className="text-xs text-amber-600">
          Le bloc source ne contient aucune option. Ajoutez des choix dans le bloc sélectionné.
        </p>
      )}

      {/* Format de sortie JSON */}
      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
        <h4 className="font-medium text-gray-700 text-sm">Format d'export JSON</h4>
        <div className="space-y-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name={`qty-format-${block.id}`}
              value="object"
              checked={(block.attributes.quantityOutputFormat || 'object') === 'object'}
              onChange={() => updateAttribute('quantityOutputFormat', 'object')}
              className="mt-0.5 accent-primary"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">Objet (par défaut)</p>
              <p className="text-xs text-gray-500 font-mono">{"{ \"colle\": 2, \"stylo\": 1 }"}</p>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name={`qty-format-${block.id}`}
              value="value"
              checked={block.attributes.quantityOutputFormat === 'value'}
              onChange={() => updateAttribute('quantityOutputFormat', 'value')}
              className="mt-0.5 accent-primary"
            />
            <div>
              <p className="text-sm font-medium text-gray-700">Valeur simple</p>
              <p className="text-xs text-gray-500 font-mono">"2"&nbsp;&nbsp;ou&nbsp;&nbsp;"2, 1"</p>
              <p className="text-xs text-gray-400 mt-0.5">Idéal avec une liste déroulante (choix unique)</p>
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
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
import { Plus, Trash2, GripVertical, Upload, Type, AlignLeft, Hash, Mail, Phone, Calendar, ChevronDown, CheckSquare, SlidersHorizontal, ArrowLeft } from 'lucide-react'

const innerBlockTypes: { type: BlockType; label: string; icon: React.ReactNode }[] = [
  { type: 'short-text', label: 'Texte court', icon: <Type className="w-4 h-4" /> },
  { type: 'long-text', label: 'Texte long', icon: <AlignLeft className="w-4 h-4" /> },
  { type: 'number', label: 'Nombre', icon: <Hash className="w-4 h-4" /> },
  { type: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
  { type: 'phone', label: 'Téléphone', icon: <Phone className="w-4 h-4" /> },
  { type: 'date', label: 'Date', icon: <Calendar className="w-4 h-4" /> },
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
      </div>

      {/* Description */}
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

      {/* Placeholder (for text inputs) */}
      {['short-text', 'long-text', 'number', 'email', 'phone'].includes(block.type) && (
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
          )}

          <div className="space-y-2">
            {(block.attributes.choices || []).map((choice, index) => (
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
          </div>
        </div>
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
                    updateAttribute('initialQuestion', e.target.value)
                    updateAttribute('label', e.target.value)
                  }}
                  placeholder="Avez-vous des éléments à ajouter ?"
                />
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
            {(block.innerBlocks || []).map((innerBlock, index) => (
              <div 
                key={innerBlock.id} 
                className="flex items-center justify-between p-2 border rounded-lg bg-white hover:bg-orange-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-600 rounded text-xs font-medium">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {innerBlock.attributes.label || 'Sans titre'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {innerBlockTypes.find(t => t.type === innerBlock.type)?.label || innerBlock.type}
                    </p>
                  </div>
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
            ))}
          </div>

          {(!block.innerBlocks || block.innerBlocks.length === 0) && (
            <p className="text-sm text-gray-400 text-center py-4 border-2 border-dashed border-orange-200 rounded-lg">
              Aucune question dans ce bloc répétable.<br />
              Glissez des blocs ici pour les ajouter.
            </p>
          )}
        </div>
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

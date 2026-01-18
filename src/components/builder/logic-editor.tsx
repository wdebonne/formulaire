'use client'

import { useState } from 'react'
import { useFormBuilder } from '@/stores/form-builder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormBlock, LogicRule, LogicCondition, ConditionOperator } from '@/types/form'
import { v4 as uuidv4 } from 'uuid'
import { Plus, Trash2, ChevronDown, ChevronRight, GitBranch } from 'lucide-react'

interface LogicEditorProps {
  blocks: FormBlock[]
}

const operators: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'Est égal à' },
  { value: 'not_equals', label: 'N\'est pas égal à' },
  { value: 'contains', label: 'Contient' },
  { value: 'not_contains', label: 'Ne contient pas' },
  { value: 'greater_than', label: 'Est supérieur à' },
  { value: 'less_than', label: 'Est inférieur à' },
  { value: 'is_empty', label: 'Est vide' },
  { value: 'is_not_empty', label: 'N\'est pas vide' },
]

export function LogicEditor({ blocks }: LogicEditorProps) {
  const { logic, addLogicRule, updateLogicRule, removeLogicRule, selectBlock, setActivePanel } = useFormBuilder()
  const [expandedBlocks, setExpandedBlocks] = useState<string[]>([])

  // S'assurer que logic est un tableau
  const safeLogic = Array.isArray(logic) ? logic : []

  // Aplatir les blocs pour inclure les blocs internes des groupes
  const flattenBlocks = (blocks: FormBlock[]): { block: FormBlock; parentIndex: number; innerIndex?: number }[] => {
    const result: { block: FormBlock; parentIndex: number; innerIndex?: number }[] = []
    blocks.forEach((block, index) => {
      if (block.type === 'group' && block.innerBlocks) {
        // Ajouter les blocs internes du groupe
        block.innerBlocks.forEach((innerBlock, innerIdx) => {
          result.push({ block: innerBlock, parentIndex: index, innerIndex: innerIdx })
        })
      } else if (!['welcome-screen', 'thankyou-screen', 'statement', 'group'].includes(block.type)) {
        result.push({ block, parentIndex: index })
      }
    })
    return result
  }

  const flattenedBlocks = flattenBlocks(blocks)
  
  // Pour les sélecteurs de conditions, inclure tous les blocs avec choix
  const allSelectableBlocks = flattenedBlocks.filter(
    ({ block }) => !['welcome-screen', 'thankyou-screen', 'statement'].includes(block.type)
  )

  const toggleBlockExpanded = (blockId: string) => {
    setExpandedBlocks((prev) =>
      prev.includes(blockId) ? prev.filter((id) => id !== blockId) : [...prev, blockId]
    )
  }

  const handleAddRule = (blockId: string) => {
    const firstSelectable = allSelectableBlocks[0]
    const newRule: LogicRule = {
      id: uuidv4(),
      conditions: [
        {
          blockId: firstSelectable?.block.id || '',
          operator: 'equals',
          value: '',
        },
      ],
      conditionMatch: 'all',
      action: 'jump',
      targetBlockId: '',
    }
    addLogicRule(blockId, newRule)
  }

  const handleUpdateCondition = (
    blockId: string,
    ruleId: string,
    conditionIndex: number,
    updates: Partial<LogicCondition>
  ) => {
    const blockLogic = safeLogic.find((l) => l.blockId === blockId)
    const rule = blockLogic?.rules.find((r) => r.id === ruleId)
    if (!rule) return

    const newConditions = [...rule.conditions]
    newConditions[conditionIndex] = { ...newConditions[conditionIndex], ...updates }
    updateLogicRule(blockId, ruleId, { conditions: newConditions })
  }

  const handleAddCondition = (blockId: string, ruleId: string) => {
    const blockLogic = safeLogic.find((l) => l.blockId === blockId)
    const rule = blockLogic?.rules.find((r) => r.id === ruleId)
    if (!rule) return

    const firstSelectable = allSelectableBlocks[0]
    const newCondition: LogicCondition = {
      blockId: firstSelectable?.block.id || '',
      operator: 'equals',
      value: '',
    }
    updateLogicRule(blockId, ruleId, { conditions: [...rule.conditions, newCondition] })
  }

  const handleRemoveCondition = (blockId: string, ruleId: string, conditionIndex: number) => {
    const blockLogic = safeLogic.find((l) => l.blockId === blockId)
    const rule = blockLogic?.rules.find((r) => r.id === ruleId)
    if (!rule || rule.conditions.length <= 1) return

    const newConditions = rule.conditions.filter((_, i) => i !== conditionIndex)
    updateLogicRule(blockId, ruleId, { conditions: newConditions })
  }

  const getBlockLabel = (blockId: string) => {
    // Chercher dans les blocs aplatis
    const found = flattenedBlocks.find(({ block }) => block.id === blockId)
    if (found) return found.block.attributes.label || 'Sans titre'
    
    // Chercher dans les blocs normaux
    const block = blocks.find((b) => b.id === blockId)
    return block?.attributes.label || 'Sans titre'
  }

  const getBlockDisplayIndex = (blockId: string): string => {
    const found = flattenedBlocks.find(({ block }) => block.id === blockId)
    if (found) {
      if (found.innerIndex !== undefined) {
        return `${found.parentIndex + 1}${String.fromCharCode(65 + found.innerIndex)}`
      }
      return `${found.parentIndex + 1}`
    }
    const index = blocks.findIndex((b) => b.id === blockId)
    return `${index + 1}`
  }

  if (flattenedBlocks.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <GitBranch className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="font-medium">Aucune question</p>
        <p className="text-sm mt-1">Ajoutez des questions pour configurer la logique</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <div className="mb-4">
        <h3 className="font-medium">Logique conditionnelle</h3>
        <p className="text-sm text-gray-500 mt-1">
          Définissez des règles pour chaque question
        </p>
      </div>

      {flattenedBlocks.map(({ block, parentIndex, innerIndex }) => {
        const blockLogic = safeLogic.find((l) => l.blockId === block.id)
        const isExpanded = expandedBlocks.includes(block.id)
        const displayIndex = innerIndex !== undefined 
          ? `${parentIndex + 1}${String.fromCharCode(65 + innerIndex)}`
          : `${parentIndex + 1}`

        return (
          <div key={block.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => toggleBlockExpanded(block.id)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center space-x-2">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <span className={`${innerIndex !== undefined ? 'w-7' : 'w-6'} h-6 flex items-center justify-center bg-gray-200 rounded text-xs font-medium`}>
                  {displayIndex}
                </span>
                <span className="text-sm font-medium truncate max-w-[150px]">
                  {block.attributes.label || 'Sans titre'}
                </span>
              </div>
              {blockLogic && blockLogic.rules.length > 0 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {blockLogic.rules.length} règle(s)
                </span>
              )}
            </button>

            {isExpanded && (
              <div className="p-3 space-y-3 border-t">
                {blockLogic?.rules.map((rule, ruleIndex) => (
                  <div key={rule.id} className="bg-gray-50 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">
                        Règle {ruleIndex + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-red-500 hover:text-red-600"
                        onClick={() => removeLogicRule(block.id, rule.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>

                    {/* Conditions */}
                    <div className="space-y-2">
                      <Label className="text-xs">Si</Label>
                      {rule.conditions.map((condition, condIndex) => (
                        <div key={condIndex} className="space-y-2">
                          {condIndex > 0 && (
                            <select
                              value={rule.conditionMatch}
                              onChange={(e) =>
                                updateLogicRule(block.id, rule.id, {
                                  conditionMatch: e.target.value as 'all' | 'any',
                                })
                              }
                              className="w-full px-2 py-1 text-xs border rounded"
                            >
                              <option value="all">ET</option>
                              <option value="any">OU</option>
                            </select>
                          )}
                          <div className="flex items-center space-x-2">
                            <select
                              value={condition.blockId}
                              onChange={(e) =>
                                handleUpdateCondition(block.id, rule.id, condIndex, {
                                  blockId: e.target.value,
                                })
                              }
                              className="flex-1 px-2 py-1 text-xs border rounded"
                            >
                              <option value="">Sélectionner...</option>
                              {allSelectableBlocks.map(({ block: qb, parentIndex: pIdx, innerIndex: iIdx }) => (
                                <option key={qb.id} value={qb.id}>
                                  {iIdx !== undefined ? `${pIdx + 1}${String.fromCharCode(65 + iIdx)}` : `${pIdx + 1}`}. {qb.attributes.label || 'Sans titre'}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1"
                              onClick={() => handleRemoveCondition(block.id, rule.id, condIndex)}
                              disabled={rule.conditions.length <= 1}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <select
                            value={condition.operator}
                            onChange={(e) =>
                              handleUpdateCondition(block.id, rule.id, condIndex, {
                                operator: e.target.value as ConditionOperator,
                              })
                            }
                            className="w-full px-2 py-1 text-xs border rounded"
                          >
                            {operators.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </select>
                          {!['is_empty', 'is_not_empty'].includes(condition.operator) && (
                            (() => {
                              // Chercher dans les blocs aplatis d'abord
                              const sourceFlattened = flattenedBlocks.find(({ block: b }) => b.id === condition.blockId)
                              const sourceBlock = sourceFlattened?.block || blocks.find(b => b.id === condition.blockId)
                              const hasChoices = sourceBlock?.attributes.choices && sourceBlock.attributes.choices.length > 0
                              
                              if (hasChoices) {
                                return (
                                  <select
                                    value={condition.value as string}
                                    onChange={(e) =>
                                      handleUpdateCondition(block.id, rule.id, condIndex, {
                                        value: e.target.value,
                                      })
                                    }
                                    className="w-full px-2 py-1 text-xs border rounded"
                                  >
                                    <option value="">Sélectionner une réponse...</option>
                                    {sourceBlock.attributes.choices!.map((choice) => (
                                      <option key={choice.id} value={choice.value}>
                                        {choice.label}
                                      </option>
                                    ))}
                                  </select>
                                )
                              }
                              
                              return (
                                <Input
                                  value={condition.value as string}
                                  onChange={(e) =>
                                    handleUpdateCondition(block.id, rule.id, condIndex, {
                                      value: e.target.value,
                                    })
                                  }
                                  placeholder="Valeur"
                                  className="h-8 text-xs"
                                />
                              )
                            })()
                          )}
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={() => handleAddCondition(block.id, rule.id)}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Ajouter une condition
                      </Button>
                    </div>

                    {/* Action */}
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs">Alors</Label>
                      <select
                        value={rule.action}
                        onChange={(e) =>
                          updateLogicRule(block.id, rule.id, {
                            action: e.target.value as LogicRule['action'],
                          })
                        }
                        className="w-full px-2 py-1 text-xs border rounded"
                      >
                        <option value="jump">Sauter vers</option>
                        <option value="hide">Masquer cette question</option>
                        <option value="show">Afficher cette question</option>
                        <option value="require">Rendre obligatoire</option>
                      </select>
                      {rule.action === 'jump' && (
                        <select
                          value={rule.targetBlockId || ''}
                          onChange={(e) =>
                            updateLogicRule(block.id, rule.id, {
                              targetBlockId: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1 text-xs border rounded"
                        >
                          <option value="">Sélectionner...</option>
                          {blocks.map((b, idx) => (
                            <option key={b.id} value={b.id}>
                              {b.type === 'thankyou-screen'
                                ? 'Écran de fin'
                                : `${idx + 1}. ${b.attributes.label || 'Sans titre'}`}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleAddRule(block.id)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter une règle
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

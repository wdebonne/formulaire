'use client'

import { useState, useRef, useEffect } from 'react'
import { useFormBuilder } from '@/stores/form-builder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormBlock, LogicRule, LogicCondition, ConditionOperator } from '@/types/form'
import { v4 as uuidv4 } from 'uuid'
import { Plus, Trash2, ChevronDown, ChevronRight, GitBranch, Search } from 'lucide-react'

interface LogicEditorProps {
  blocks: FormBlock[]
}

const operators: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'Est égal à' },
  { value: 'not_equals', label: "N'est pas égal à" },
  { value: 'contains', label: 'Contient' },
  { value: 'not_contains', label: 'Ne contient pas' },
  { value: 'greater_than', label: 'Est supérieur à' },
  { value: 'less_than', label: 'Est inférieur à' },
  { value: 'is_empty', label: 'Est vide' },
  { value: 'is_not_empty', label: "N'est pas vide" },
]

interface SearchableSelectOption {
  value: string
  label: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  className?: string
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  className = '',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )
  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch('') }}
        className="w-full px-2 py-1 text-xs border rounded text-left flex items-center justify-between bg-white hover:bg-gray-50"
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="w-3 h-3 ml-1 flex-shrink-0 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded shadow-lg">
          <div className="p-1 border-b">
            <div className="flex items-center px-1 gap-1">
              <Search className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full text-xs outline-none py-1"
                placeholder="Rechercher..."
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-xs text-gray-400 text-center">Aucun résultat</div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value || '__placeholder__'}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setSearch('') }}
                  className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-100 ${
                    o.value === value ? 'bg-primary/10 text-primary font-medium' : ''
                  }`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function LogicEditor({ blocks }: LogicEditorProps) {
  const { logic, addLogicRule, updateLogicRule, removeLogicRule } = useFormBuilder()
  const [expandedBlocks, setExpandedBlocks] = useState<string[]>([])
  const [blockSearch, setBlockSearch] = useState('')
  const [collapsedRules, setCollapsedRules] = useState<Record<string, string[]>>({})

  const safeLogic = Array.isArray(logic) ? logic : []

  const flattenBlocks = (blocks: FormBlock[]): { block: FormBlock; parentIndex: number; innerIndex?: number }[] => {
    const result: { block: FormBlock; parentIndex: number; innerIndex?: number }[] = []
    blocks.forEach((block, index) => {
      if (block.type === 'group' && block.innerBlocks) {
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

  const allSelectableBlocks = flattenedBlocks.filter(
    ({ block }) => !['welcome-screen', 'thankyou-screen', 'statement'].includes(block.type)
  )

  const filteredBlocks = flattenedBlocks.filter(({ block }) =>
    (block.attributes.label || 'Sans titre').toLowerCase().includes(blockSearch.toLowerCase())
  )

  const conditionBlockOptions: SearchableSelectOption[] = allSelectableBlocks.map(
    ({ block: qb, parentIndex: pIdx, innerIndex: iIdx }) => ({
      value: qb.id,
      label: `${iIdx !== undefined ? `${pIdx + 1}${String.fromCharCode(65 + iIdx)}` : `${pIdx + 1}`}. ${qb.attributes.label || 'Sans titre'}`,
    })
  )

  const targetBlockOptions: SearchableSelectOption[] = blocks.map((b, idx) => ({
    value: b.id,
    label:
      b.type === 'thankyou-screen'
        ? 'Écran de fin'
        : `${idx + 1}. ${b.attributes.label || 'Sans titre'}`,
  }))

  const toggleBlockExpanded = (blockId: string) => {
    setExpandedBlocks(prev =>
      prev.includes(blockId) ? prev.filter(id => id !== blockId) : [...prev, blockId]
    )
  }

  const toggleRuleCollapsed = (blockId: string, ruleId: string) => {
    setCollapsedRules(prev => {
      const current = prev[blockId] || []
      return {
        ...prev,
        [blockId]: current.includes(ruleId)
          ? current.filter(id => id !== ruleId)
          : [...current, ruleId],
      }
    })
  }

  const isRuleCollapsed = (blockId: string, ruleId: string) =>
    (collapsedRules[blockId] || []).includes(ruleId)

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
    const blockLogic = safeLogic.find(l => l.blockId === blockId)
    const rule = blockLogic?.rules.find(r => r.id === ruleId)
    if (!rule) return
    const newConditions = [...rule.conditions]
    newConditions[conditionIndex] = { ...newConditions[conditionIndex], ...updates }
    updateLogicRule(blockId, ruleId, { conditions: newConditions })
  }

  const handleAddCondition = (blockId: string, ruleId: string) => {
    const blockLogic = safeLogic.find(l => l.blockId === blockId)
    const rule = blockLogic?.rules.find(r => r.id === ruleId)
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
    const blockLogic = safeLogic.find(l => l.blockId === blockId)
    const rule = blockLogic?.rules.find(r => r.id === ruleId)
    if (!rule || rule.conditions.length <= 1) return
    const newConditions = rule.conditions.filter((_, i) => i !== conditionIndex)
    updateLogicRule(blockId, ruleId, { conditions: newConditions })
  }

  const getBlockLabel = (blockId: string) => {
    const found = flattenedBlocks.find(({ block }) => block.id === blockId)
    if (found) return found.block.attributes.label || 'Sans titre'
    const block = blocks.find(b => b.id === blockId)
    return block?.attributes.label || 'Sans titre'
  }

  const getRuleSummary = (rule: LogicRule) => {
    const cond = rule.conditions[0]
    const condLabel = cond ? getBlockLabel(cond.blockId) : ''
    const moreConditions = rule.conditions.length > 1 ? ` +${rule.conditions.length - 1}` : ''
    let actionLabel = ''
    if (rule.action === 'jump') {
      actionLabel = `→ ${rule.targetBlockId ? getBlockLabel(rule.targetBlockId) : '?'}`
    } else if (rule.action === 'hide') {
      actionLabel = '→ Masquer'
    } else if (rule.action === 'show') {
      actionLabel = '→ Afficher'
    } else {
      actionLabel = '→ Obligatoire'
    }
    return condLabel ? `${condLabel}${moreConditions} ${actionLabel}` : actionLabel
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
        <p className="text-sm text-gray-500 mt-1">Définissez des règles pour chaque question</p>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={blockSearch}
          onChange={e => setBlockSearch(e.target.value)}
          placeholder="Rechercher un bloc..."
          className="h-8 pl-8 text-sm"
        />
      </div>

      {filteredBlocks.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-4">Aucun bloc trouvé</p>
      )}

      {filteredBlocks.map(({ block, parentIndex, innerIndex }) => {
        const blockLogic = safeLogic.find(l => l.blockId === block.id)
        const isExpanded = expandedBlocks.includes(block.id)
        const displayIndex =
          innerIndex !== undefined
            ? `${parentIndex + 1}${String.fromCharCode(65 + innerIndex)}`
            : `${parentIndex + 1}`

        return (
          <div key={block.id} className="border rounded-lg">
            <button
              onClick={() => toggleBlockExpanded(block.id)}
              className={`w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors ${isExpanded ? 'rounded-t-lg' : 'rounded-lg'}`}
            >
              <div className="flex items-center space-x-2">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <span
                  className={`${innerIndex !== undefined ? 'w-7' : 'w-6'} h-6 flex items-center justify-center bg-gray-200 rounded text-xs font-medium`}
                >
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
                {blockLogic?.rules.map((rule, ruleIndex) => {
                  const ruleCollapsed = isRuleCollapsed(block.id, rule.id)
                  return (
                    <div key={rule.id} className="bg-gray-50 rounded-lg border border-gray-200">
                      {/* En-tête de règle cliquable */}
                      <div className="flex items-center justify-between px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleRuleCollapsed(block.id, rule.id)}
                          className="flex items-center gap-1.5 flex-1 text-left min-w-0"
                        >
                          {ruleCollapsed ? (
                            <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          )}
                          <span className="text-xs font-medium text-gray-500 flex-shrink-0">
                            Règle {ruleIndex + 1}
                          </span>
                          {ruleCollapsed && (
                            <span className="text-xs text-gray-400 truncate">
                              — {getRuleSummary(rule)}
                            </span>
                          )}
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-red-500 hover:text-red-600 flex-shrink-0"
                          onClick={() => removeLogicRule(block.id, rule.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Corps de la règle */}
                      {!ruleCollapsed && (
                        <div className="px-3 pb-3 space-y-3 border-t border-gray-200">
                          {/* Conditions */}
                          <div className="space-y-2 pt-2">
                            <Label className="text-xs">Si</Label>
                            {rule.conditions.map((condition, condIndex) => (
                              <div key={condIndex} className="space-y-2">
                                {condIndex > 0 && (
                                  <select
                                    value={rule.conditionMatch}
                                    onChange={e =>
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
                                  <SearchableSelect
                                    value={condition.blockId}
                                    onChange={value =>
                                      handleUpdateCondition(block.id, rule.id, condIndex, {
                                        blockId: value,
                                      })
                                    }
                                    options={conditionBlockOptions}
                                    placeholder="Sélectionner..."
                                    className="flex-1"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1"
                                    onClick={() =>
                                      handleRemoveCondition(block.id, rule.id, condIndex)
                                    }
                                    disabled={rule.conditions.length <= 1}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                                <select
                                  value={condition.operator}
                                  onChange={e =>
                                    handleUpdateCondition(block.id, rule.id, condIndex, {
                                      operator: e.target.value as ConditionOperator,
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs border rounded"
                                >
                                  {operators.map(op => (
                                    <option key={op.value} value={op.value}>
                                      {op.label}
                                    </option>
                                  ))}
                                </select>
                                {!['is_empty', 'is_not_empty'].includes(condition.operator) &&
                                  (() => {
                                    const sourceFlattened = flattenedBlocks.find(
                                      ({ block: b }) => b.id === condition.blockId
                                    )
                                    const sourceBlock =
                                      sourceFlattened?.block ||
                                      blocks.find(b => b.id === condition.blockId)
                                    const hasChoices =
                                      sourceBlock?.attributes.choices &&
                                      sourceBlock.attributes.choices.length > 0

                                    if (hasChoices) {
                                      return (
                                        <select
                                          value={condition.value as string}
                                          onChange={e =>
                                            handleUpdateCondition(block.id, rule.id, condIndex, {
                                              value: e.target.value,
                                            })
                                          }
                                          className="w-full px-2 py-1 text-xs border rounded"
                                        >
                                          <option value="">Sélectionner une réponse...</option>
                                          {sourceBlock!.attributes.choices!.map(choice => (
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
                                        onChange={e =>
                                          handleUpdateCondition(block.id, rule.id, condIndex, {
                                            value: e.target.value,
                                          })
                                        }
                                        placeholder="Valeur"
                                        className="h-8 text-xs"
                                      />
                                    )
                                  })()}
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
                              onChange={e =>
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
                              <SearchableSelect
                                value={rule.targetBlockId || ''}
                                onChange={value =>
                                  updateLogicRule(block.id, rule.id, { targetBlockId: value })
                                }
                                options={targetBlockOptions}
                                placeholder="Sélectionner..."
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

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

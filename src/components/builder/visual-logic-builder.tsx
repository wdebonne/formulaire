'use client'

import { useState, useMemo } from 'react'
import { useFormBuilder } from '@/stores/form-builder'
import { Button } from '@/components/ui/button'
import type { FormBlock, LogicRule, LogicCondition, ConditionOperator } from '@/types/form'
import { v4 as uuidv4 } from 'uuid'
import { X, Plus, Trash2, GitBranch } from 'lucide-react'

interface VisualLogicBuilderProps {
  open: boolean
  onClose: () => void
  blocks: FormBlock[]
}

// Layout constants
const BLOCK_HEIGHT = 68
const BLOCK_GAP = 44
const BLOCK_STEP = BLOCK_HEIGHT + BLOCK_GAP
const PADDING_TOP = 48
const PADDING_BOTTOM = 60
const BLOCK_LEFT = 40
const BLOCK_WIDTH = 264
const BLOCK_RIGHT = BLOCK_LEFT + BLOCK_WIDTH
const ARROW_BASE_X = BLOCK_RIGHT + 28
const ARROW_LANE_W = 48

const RULE_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
]

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

function blockCY(idx: number) { return PADDING_TOP + idx * BLOCK_STEP + BLOCK_HEIGHT / 2 }
function blockTY(idx: number) { return PADDING_TOP + idx * BLOCK_STEP }
function blockBY(idx: number) { return PADDING_TOP + idx * BLOCK_STEP + BLOCK_HEIGHT }

// Assign horizontal lanes so arrows don't overlap vertically
function assignLanes(jumps: { id: string; si: number; ti: number }[]): Map<string, number> {
  const lanes = new Map<string, number>()
  const sorted = [...jumps].sort((a, b) =>
    Math.abs(b.ti - b.si) - Math.abs(a.ti - a.si)
  )
  const used: { min: number; max: number; lane: number }[] = []
  for (const j of sorted) {
    const mn = Math.min(j.si, j.ti), mx = Math.max(j.si, j.ti)
    let lane = 0
    while (used.some(u => u.lane === lane && u.max >= mn && u.min <= mx)) lane++
    lanes.set(j.id, lane)
    used.push({ min: mn, max: mx, lane })
  }
  return lanes
}

function condSummary(rule: LogicRule, blocks: FormBlock[]): string {
  const c = rule.conditions[0]
  if (!c) return '?'
  const b = blocks.find(b => b.id === c.blockId)
  const lbl = b?.attributes.label || 'Bloc'
  const short = lbl.length > 14 ? lbl.slice(0, 13) + '…' : lbl
  return rule.conditions.length > 1 ? `${short} +${rule.conditions.length - 1}` : short
}

interface SelectedRule { blockId: string; ruleId: string }

// ─── Main component ────────────────────────────────────────────────────────────

export function VisualLogicBuilder({ open, onClose, blocks }: VisualLogicBuilderProps) {
  const { logic, addLogicRule, updateLogicRule, removeLogicRule } = useFormBuilder()
  const [selected, setSelected] = useState<SelectedRule | null>(null)

  const safeLogic = Array.isArray(logic) ? logic : []

  // Collect jump rules for arrow rendering
  const jumps = useMemo(() => {
    const res: { blockId: string; rule: LogicRule; si: number; ti: number; ci: number }[] = []
    let ci = 0
    for (const bl of safeLogic) {
      const si = blocks.findIndex(b => b.id === bl.blockId)
      if (si === -1) continue
      for (const rule of bl.rules) {
        if (rule.action === 'jump' && rule.targetBlockId) {
          const ti = blocks.findIndex(b => b.id === rule.targetBlockId)
          if (ti !== -1) {
            res.push({ blockId: bl.blockId, rule, si, ti, ci: ci % RULE_COLORS.length })
            ci++
          }
        }
      }
    }
    return res
  }, [safeLogic, blocks])

  const lanes = useMemo(
    () => assignLanes(jumps.map(j => ({ id: j.rule.id, si: j.si, ti: j.ti }))),
    [jumps]
  )

  const maxLane = Math.max(0, ...Array.from(lanes.values()))
  const canvasW = ARROW_BASE_X + (maxLane + 1) * ARROW_LANE_W + 40
  const canvasH = PADDING_TOP + blocks.length * BLOCK_STEP + PADDING_BOTTOM

  const handleAddRule = (blockId: string) => {
    const first = blocks.find(b => !['welcome-screen', 'thankyou-screen', 'statement'].includes(b.type))
    const last = blocks[blocks.length - 1]
    const newRule: LogicRule = {
      id: uuidv4(),
      conditions: [{ blockId: first?.id || '', operator: 'equals', value: '' }],
      conditionMatch: 'all',
      action: 'jump',
      targetBlockId: last?.id || '',
    }
    addLogicRule(blockId, newRule)
    setSelected({ blockId, ruleId: newRule.id })
  }

  const liveRule = selected
    ? safeLogic.find(l => l.blockId === selected.blockId)?.rules.find(r => r.id === selected.ruleId)
    : null

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#eef2f7' }}>
      {/* Header */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-5 shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5">
          <GitBranch className="w-5 h-5 text-indigo-500" />
          <span className="font-semibold text-gray-900">Éditeur de logique visuel</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {blocks.length} blocs
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
          <X className="w-4 h-4" />
          Fermer
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-auto p-8">
          <div className="relative" style={{ width: canvasW, height: canvasH }}>

            {/* SVG layer — arrows */}
            <svg
              className="absolute inset-0"
              width={canvasW}
              height={canvasH}
              style={{ pointerEvents: 'none' }}
            >
              {/* Default flow: dashed lines between consecutive blocks */}
              {blocks.map((block, idx) => {
                if (idx === blocks.length - 1) return null
                const cx = BLOCK_LEFT + BLOCK_WIDTH / 2
                const y1 = blockBY(idx)
                const y2 = blockTY(idx + 1)
                return (
                  <g key={`fl-${block.id}`}>
                    <line x1={cx} y1={y1} x2={cx} y2={y2 - 6} stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="5 4" />
                    <polygon
                      points={`${cx},${y2} ${cx - 5},${y2 - 8} ${cx + 5},${y2 - 8}`}
                      fill="#cbd5e1"
                    />
                  </g>
                )
              })}

              {/* Jump arrows */}
              {jumps.map((j) => {
                const lane = lanes.get(j.rule.id) ?? 0
                const laneX = ARROW_BASE_X + lane * ARROW_LANE_W
                const sy = blockCY(j.si)
                const ty = blockCY(j.ti)
                const color = RULE_COLORS[j.ci]
                const isSelected = selected?.ruleId === j.rule.id
                const strokeW = isSelected ? 3 : 2
                const selectedColor = isSelected ? '#1d4ed8' : color

                // Cubic bezier: right edge of source → lane X → right edge of target
                const d = `M ${BLOCK_RIGHT} ${sy} C ${laneX} ${sy} ${laneX} ${ty} ${BLOCK_RIGHT + 8} ${ty}`
                const midY = (sy + ty) / 2

                return (
                  <g
                    key={j.rule.id}
                    style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onClick={() => setSelected(
                      selected?.ruleId === j.rule.id ? null : { blockId: j.blockId, ruleId: j.rule.id }
                    )}
                  >
                    {/* Wider invisible hit area */}
                    <path d={d} fill="none" stroke="transparent" strokeWidth={14} />
                    {/* Visible path */}
                    <path
                      d={d}
                      fill="none"
                      stroke={selectedColor}
                      strokeWidth={strokeW}
                      strokeDasharray={j.ti < j.si ? '7 4' : undefined}
                    />
                    {/* Arrowhead (left-pointing triangle at target) */}
                    <polygon
                      points={`${BLOCK_RIGHT + 8},${ty} ${BLOCK_RIGHT + 18},${ty - 6} ${BLOCK_RIGHT + 18},${ty + 6}`}
                      fill={selectedColor}
                    />
                    {/* Start dot */}
                    <circle cx={BLOCK_RIGHT} cy={sy} r={4} fill={selectedColor} />
                    {/* Condition label badge */}
                    <foreignObject
                      x={laneX - 46}
                      y={midY - 12}
                      width={92}
                      height={24}
                      style={{ pointerEvents: 'none' }}
                    >
                      <div
                        style={{
                          background: selectedColor,
                          color: 'white',
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 99,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: 90,
                          textAlign: 'center',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                        }}
                      >
                        {condSummary(j.rule, blocks)}
                      </div>
                    </foreignObject>
                  </g>
                )
              })}
            </svg>

            {/* Block cards */}
            {blocks.map((block, idx) => {
              const bl = safeLogic.find(l => l.blockId === block.id)
              const jumpRules = bl?.rules.filter(r => r.action === 'jump') ?? []
              const otherRules = bl?.rules.filter(r => r.action !== 'jump') ?? []
              const isSelected = selected?.blockId === block.id
              const isScreen = ['welcome-screen', 'thankyou-screen'].includes(block.type)

              return (
                <div
                  key={block.id}
                  className="absolute"
                  style={{ left: BLOCK_LEFT, top: blockTY(idx), width: BLOCK_WIDTH, height: BLOCK_HEIGHT }}
                >
                  <div
                    className={`w-full h-full rounded-xl border-2 bg-white shadow-sm flex items-center gap-2.5 px-3 transition-all ${
                      isSelected
                        ? 'border-indigo-500 shadow-indigo-100 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow'
                    }`}
                  >
                    {/* Index badge */}
                    <span
                      className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold ${
                        isScreen ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {idx + 1}
                    </span>

                    {/* Label */}
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                      {block.attributes.label || 'Sans titre'}
                    </span>

                    {/* Rule badges */}
                    <div className="flex gap-1 flex-shrink-0">
                      {otherRules.map(rule => (
                        <button
                          key={rule.id}
                          onClick={() => setSelected(
                            selected?.ruleId === rule.id ? null : { blockId: block.id, ruleId: rule.id }
                          )}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                            selected?.ruleId === rule.id
                              ? 'bg-indigo-500 text-white'
                              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                          }`}
                        >
                          {rule.action === 'hide' ? 'Masquer' : rule.action === 'show' ? 'Afficher' : 'Requis'}
                        </button>
                      ))}
                      {jumpRules.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                          {jumpRules.length}↗
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Add rule button (centered below card) */}
                  {!isScreen && (
                    <button
                      onClick={() => handleAddRule(block.id)}
                      title="Ajouter une règle"
                      className="absolute left-1/2 -translate-x-1/2 -bottom-3.5 w-7 h-7 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center shadow-md transition-colors z-10"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Rule edit panel */}
        {selected && liveRule && (
          <RuleEditPanel
            blockId={selected.blockId}
            rule={liveRule}
            blocks={blocks}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Rule edit panel ────────────────────────────────────────────────────────────

interface RuleEditPanelProps {
  blockId: string
  rule: LogicRule
  blocks: FormBlock[]
  onClose: () => void
}

function RuleEditPanel({ blockId, rule, blocks, onClose }: RuleEditPanelProps) {
  const { updateLogicRule, removeLogicRule } = useFormBuilder()

  const sourceBlock = blocks.find(b => b.id === blockId)
  const sourceIdx = blocks.findIndex(b => b.id === blockId)

  const selectableBlocks = blocks.filter(
    b => !['welcome-screen', 'thankyou-screen', 'statement'].includes(b.type)
  )

  const handleUpdateCondition = (ci: number, updates: Partial<LogicCondition>) => {
    const next = [...rule.conditions]
    next[ci] = { ...next[ci], ...updates }
    updateLogicRule(blockId, rule.id, { conditions: next })
  }

  const handleAddCondition = () => {
    const newCond: LogicCondition = { blockId: selectableBlocks[0]?.id || '', operator: 'equals', value: '' }
    updateLogicRule(blockId, rule.id, { conditions: [...rule.conditions, newCond] })
  }

  const handleRemoveCondition = (ci: number) => {
    if (rule.conditions.length <= 1) return
    updateLogicRule(blockId, rule.id, { conditions: rule.conditions.filter((_, i) => i !== ci) })
  }

  const handleDelete = () => {
    removeLogicRule(blockId, rule.id)
    onClose()
  }

  return (
    <div className="w-80 bg-white border-l flex flex-col shrink-0 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <span className="text-sm font-semibold text-gray-800">Éditer la règle</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleDelete} className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-5">
        {/* Source block */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Bloc source</p>
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
            <span className="w-6 h-6 flex items-center justify-center bg-indigo-100 rounded text-xs font-bold text-indigo-700 flex-shrink-0">
              {sourceIdx + 1}
            </span>
            <span className="text-sm font-medium text-indigo-900 truncate">
              {sourceBlock?.attributes.label || 'Sans titre'}
            </span>
          </div>
        </div>

        {/* Conditions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Si</p>
            <select
              value={rule.conditionMatch}
              onChange={e => updateLogicRule(blockId, rule.id, { conditionMatch: e.target.value as 'all' | 'any' })}
              className="text-xs border rounded px-2 py-1 bg-white"
            >
              <option value="all">Toutes (ET)</option>
              <option value="any">L'une (OU)</option>
            </select>
          </div>

          {rule.conditions.map((condition, ci) => (
            <ConditionRow
              key={ci}
              condition={condition}
              selectableBlocks={selectableBlocks}
              allBlocks={blocks}
              canRemove={rule.conditions.length > 1}
              onUpdate={u => handleUpdateCondition(ci, u)}
              onRemove={() => handleRemoveCondition(ci)}
            />
          ))}

          <button
            onClick={handleAddCondition}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
          >
            <Plus className="w-3 h-3" />
            Ajouter une condition
          </button>
        </div>

        {/* Action */}
        <div className="space-y-2 pt-3 border-t">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Alors</p>
          <select
            value={rule.action}
            onChange={e => updateLogicRule(blockId, rule.id, { action: e.target.value as LogicRule['action'] })}
            className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
          >
            <option value="jump">Sauter vers…</option>
            <option value="hide">Masquer ce bloc</option>
            <option value="show">Afficher ce bloc</option>
            <option value="require">Rendre obligatoire</option>
          </select>

          {rule.action === 'jump' && (
            <select
              value={rule.targetBlockId || ''}
              onChange={e => updateLogicRule(blockId, rule.id, { targetBlockId: e.target.value })}
              className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
            >
              <option value="">Sélectionner un bloc…</option>
              {blocks.map((b, i) => (
                <option key={b.id} value={b.id}>
                  {b.type === 'thankyou-screen'
                    ? 'Écran de fin'
                    : `${i + 1}. ${b.attributes.label || 'Sans titre'}`}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Condition row ───────────────────────────────────────────────────────────────

interface ConditionRowProps {
  condition: LogicCondition
  selectableBlocks: FormBlock[]
  allBlocks: FormBlock[]
  canRemove: boolean
  onUpdate: (u: Partial<LogicCondition>) => void
  onRemove: () => void
}

function ConditionRow({ condition, selectableBlocks, allBlocks, canRemove, onUpdate, onRemove }: ConditionRowProps) {
  const srcBlock = allBlocks.find(b => b.id === condition.blockId)
    || selectableBlocks.find(b => b.id === condition.blockId)
  const hasChoices = (srcBlock?.attributes.choices?.length ?? 0) > 0
  const needsValue = !['is_empty', 'is_not_empty'].includes(condition.operator)

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 relative">
      {canRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Block selector */}
      <select
        value={condition.blockId}
        onChange={e => onUpdate({ blockId: e.target.value, value: '' })}
        className="w-full text-xs border rounded px-2 py-1.5 bg-white pr-6"
      >
        <option value="">Sélectionner un bloc…</option>
        {selectableBlocks.map((b, i) => (
          <option key={b.id} value={b.id}>
            {i + 1}. {b.attributes.label || 'Sans titre'}
          </option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={condition.operator}
        onChange={e => onUpdate({ operator: e.target.value as ConditionOperator })}
        className="w-full text-xs border rounded px-2 py-1.5 bg-white"
      >
        {operators.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {/* Value */}
      {needsValue && (
        hasChoices ? (
          <select
            value={condition.value as string}
            onChange={e => onUpdate({ value: e.target.value })}
            className="w-full text-xs border rounded px-2 py-1.5 bg-white"
          >
            <option value="">Sélectionner…</option>
            {srcBlock!.attributes.choices!.map(c => (
              <option key={c.id} value={c.value}>{c.label}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={condition.value as string}
            onChange={e => onUpdate({ value: e.target.value })}
            placeholder="Valeur…"
            className="w-full text-xs border rounded px-2 py-1.5 bg-white"
          />
        )
      )}
    </div>
  )
}

'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useFormBuilder } from '@/stores/form-builder'
import { Button } from '@/components/ui/button'
import type { FormBlock, LogicRule, LogicCondition, ConditionOperator } from '@/types/form'
import { v4 as uuidv4 } from 'uuid'
import { X, Plus, Trash2, GitBranch, Search, ChevronDown } from 'lucide-react'

interface VisualLogicBuilderProps {
  open: boolean
  onClose: () => void
  blocks: FormBlock[]
}

// ─── Layout constants ──────────────────────────────────────────────────────────
const BH = 72          // block height
const BGAP = 52        // gap between blocks
const BSTEP = BH + BGAP
const PAD_TOP = 56
const PAD_BOT = 80
const BL = 40          // block left
const BW = 308         // block width
const BR = BL + BW     // block right edge = 348
const ARROW_START = BR + 24   // horizontal start of arrow area
const LANE_W = 80      // width per lane (wider = less overlap)
const CORNER = 10      // rounded corner radius
const ARROWHEAD = 10   // arrowhead size

const COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#06b6d4',
]

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals',       label: 'Est égal à' },
  { value: 'not_equals',   label: "N'est pas égal à" },
  { value: 'contains',     label: 'Contient' },
  { value: 'not_contains', label: 'Ne contient pas' },
  { value: 'greater_than', label: 'Est supérieur à' },
  { value: 'less_than',    label: 'Est inférieur à' },
  { value: 'is_empty',     label: 'Est vide' },
  { value: 'is_not_empty', label: "N'est pas vide" },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────
const cy  = (i: number) => PAD_TOP + i * BSTEP + BH / 2
const top = (i: number) => PAD_TOP + i * BSTEP
const bot = (i: number) => PAD_TOP + i * BSTEP + BH

/** Assign non-overlapping horizontal lanes to arrows */
function assignLanes(jumps: { id: string; si: number; ti: number }[]): Map<string, number> {
  const map = new Map<string, number>()
  // Wider spans get outer lanes first
  const sorted = [...jumps].sort((a, b) =>
    Math.abs(b.ti - b.si) - Math.abs(a.ti - a.si)
  )
  const used: { mn: number; mx: number; lane: number }[] = []
  for (const j of sorted) {
    const mn = Math.min(j.si, j.ti), mx = Math.max(j.si, j.ti)
    let lane = 0
    while (used.some(u => u.lane === lane && u.mx >= mn && u.mn <= mx)) lane++
    map.set(j.id, lane)
    used.push({ mn, mx, lane })
  }
  return map
}

/** Orthogonal path with rounded corners: right edge → laneX → right edge */
function makePath(laneX: number, sy: number, ty: number): string {
  const r = Math.min(CORNER, Math.abs(ty - sy) / 2.2)
  const sign = ty > sy ? 1 : -1
  if (Math.abs(ty - sy) < 2) {
    return `M ${BR} ${sy} H ${BR + ARROWHEAD + 4}`
  }
  // Horizontal out → corner → vertical → corner → horizontal back
  return [
    `M ${BR} ${sy}`,
    `L ${laneX - r} ${sy}`,
    `Q ${laneX} ${sy} ${laneX} ${sy + r * sign}`,
    `L ${laneX} ${ty - r * sign}`,
    `Q ${laneX} ${ty} ${laneX - r} ${ty}`,
    `L ${BR + ARROWHEAD + 4} ${ty}`,
  ].join(' ')
}

/** Short summary of a rule's first condition for the label badge */
function summary(rule: LogicRule, blocks: FormBlock[]): string {
  const c = rule.conditions[0]
  if (!c) return '?'
  const b = blocks.find(x => x.id === c.blockId)
  const lbl = b?.attributes.label || 'Bloc'
  const short = lbl.length > 15 ? lbl.slice(0, 14) + '…' : lbl
  return rule.conditions.length > 1 ? `${short} +${rule.conditions.length - 1}` : short
}

// ─── Selected state ─────────────────────────────────────────────────────────────
interface Sel { blockId: string; ruleId: string }

// ─── Main component ─────────────────────────────────────────────────────────────
export function VisualLogicBuilder({ open, onClose, blocks }: VisualLogicBuilderProps) {
  const { logic, addLogicRule } = useFormBuilder()
  const [sel, setSel] = useState<Sel | null>(null)

  const safeLogic = Array.isArray(logic) ? logic : []

  // Build jump list
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
            res.push({ blockId: bl.blockId, rule, si, ti, ci: ci % COLORS.length })
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

  // Stagger multiple arrows from/to the same block vertically (±offset around centre)
  const { outOff, inOff } = useMemo(() => {
    const out = new Map<string, number>()
    const inn = new Map<string, number>()

    // By source
    const bySrc = new Map<number, typeof jumps>()
    for (const j of jumps) {
      if (!bySrc.has(j.si)) bySrc.set(j.si, [])
      bySrc.get(j.si)!.push(j)
    }
    bySrc.forEach(g => {
      const n = g.length
      g.forEach((j, i) => out.set(j.rule.id, n === 1 ? 0 : (i - (n - 1) / 2) * 18))
    })

    // By target
    const byTgt = new Map<number, typeof jumps>()
    for (const j of jumps) {
      if (!byTgt.has(j.ti)) byTgt.set(j.ti, [])
      byTgt.get(j.ti)!.push(j)
    }
    byTgt.forEach(g => {
      const n = g.length
      g.forEach((j, i) => inn.set(j.rule.id, n === 1 ? 0 : (i - (n - 1) / 2) * 18))
    })

    return { outOff: out, inOff: inn }
  }, [jumps])

  const maxLane = Math.max(0, ...Array.from(lanes.values()))
  const canvasW = ARROW_START + (maxLane + 1) * LANE_W + 48
  const canvasH = PAD_TOP + blocks.length * BSTEP + PAD_BOT

  const handleAdd = (blockId: string) => {
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
    setSel({ blockId, ruleId: newRule.id })
  }

  const liveRule = sel
    ? safeLogic.find(l => l.blockId === sel.blockId)?.rules.find(r => r.id === sel.ruleId)
    : null

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f4f8' }}>

      {/* ── Header ── */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-5 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-indigo-500" />
          <span className="font-semibold text-gray-900">Éditeur de logique visuel</span>
          <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full font-medium">
            {blocks.length} blocs · {jumps.length} saut{jumps.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
          <X className="w-4 h-4" />
          Fermer
        </Button>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Canvas — centered in available space */}
        <div className="flex-1 overflow-auto">
          <div className="min-h-full flex justify-center p-8">
            <div className="relative" style={{ width: canvasW, height: canvasH, minWidth: 500 }}>

              {/* ── SVG layer ── */}
              <svg
                className="absolute inset-0 overflow-visible"
                width={canvasW}
                height={canvasH}
                style={{ pointerEvents: 'none' }}
              >
                {/* Default flow: dotted down-arrows between consecutive blocks */}
                {blocks.map((b, idx) => {
                  if (idx === blocks.length - 1) return null
                  const cx = BL + BW / 2
                  const y1 = bot(idx), y2 = top(idx + 1)
                  return (
                    <g key={`f-${b.id}`}>
                      <line x1={cx} y1={y1} x2={cx} y2={y2 - 7}
                        stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="5 4" />
                      <polygon
                        points={`${cx},${y2} ${cx - 5},${y2 - 9} ${cx + 5},${y2 - 9}`}
                        fill="#cbd5e1"
                      />
                    </g>
                  )
                })}

                {/* Jump rule arrows */}
                {jumps.map(j => {
                  const lane = lanes.get(j.rule.id) ?? 0
                  const laneX = ARROW_START + lane * LANE_W
                  const sy = cy(j.si) + (outOff.get(j.rule.id) ?? 0)
                  const ty = cy(j.ti) + (inOff.get(j.rule.id) ?? 0)
                  const color = COLORS[j.ci]
                  const isSelected = sel?.ruleId === j.rule.id
                  const stroke = isSelected ? '#1d4ed8' : color
                  const sw = isSelected ? 3 : 2
                  const d = makePath(laneX, sy, ty)
                  const midY = (sy + ty) / 2

                  return (
                    <g
                      key={j.rule.id}
                      style={{ pointerEvents: 'all', cursor: 'pointer' }}
                      onClick={() => setSel(
                        isSelected ? null : { blockId: j.blockId, ruleId: j.rule.id }
                      )}
                    >
                      {/* Fat invisible hit area */}
                      <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
                      {/* Path */}
                      <path d={d} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
                      {/* Start dot on source block */}
                      <circle cx={BR} cy={sy} r={4.5} fill={stroke} />
                      {/* Arrowhead at target (left-pointing) */}
                      <polygon
                        points={`
                          ${BR + ARROWHEAD + 4},${ty}
                          ${BR + ARROWHEAD * 2 + 4},${ty - ARROWHEAD / 1.5}
                          ${BR + ARROWHEAD * 2 + 4},${ty + ARROWHEAD / 1.5}
                        `}
                        fill={stroke}
                      />
                      {/* Label badge on the vertical segment */}
                      <foreignObject
                        x={laneX + 5}
                        y={midY - 11}
                        width={120}
                        height={22}
                        style={{ pointerEvents: 'none', overflow: 'visible' }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            background: stroke,
                            color: 'white',
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 99,
                            whiteSpace: 'nowrap',
                            maxWidth: 116,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            boxShadow: '0 1px 5px rgba(0,0,0,.2)',
                          }}
                          title={summary(j.rule, blocks)}
                        >
                          {summary(j.rule, blocks)}
                        </span>
                      </foreignObject>
                    </g>
                  )
                })}
              </svg>

              {/* ── Block cards ── */}
              {blocks.map((block, idx) => {
                const bl = safeLogic.find(l => l.blockId === block.id)
                const jumpRules  = bl?.rules.filter(r => r.action === 'jump')  ?? []
                const otherRules = bl?.rules.filter(r => r.action !== 'jump') ?? []
                const isSelBlock = sel?.blockId === block.id
                const isScreen   = ['welcome-screen', 'thankyou-screen'].includes(block.type)

                return (
                  <div
                    key={block.id}
                    className="absolute"
                    style={{ left: BL, top: top(idx), width: BW, height: BH }}
                  >
                    <div
                      className={`w-full h-full rounded-xl border-2 bg-white shadow-sm flex items-center gap-3 px-3 transition-all select-none ${
                        isSelBlock
                          ? 'border-indigo-500 shadow-md shadow-indigo-100'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow'
                      }`}
                    >
                      {/* Index */}
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
                      <div className="flex gap-1 flex-shrink-0 items-center">
                        {otherRules.map(rule => (
                          <button
                            key={rule.id}
                            onClick={() => setSel(
                              sel?.ruleId === rule.id ? null : { blockId: block.id, ruleId: rule.id }
                            )}
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold transition-colors ${
                              sel?.ruleId === rule.id
                                ? 'bg-indigo-500 text-white'
                                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                            }`}
                          >
                            {rule.action === 'hide' ? 'Masquer'
                              : rule.action === 'show' ? 'Afficher'
                              : 'Requis'}
                          </button>
                        ))}
                        {jumpRules.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">
                            {jumpRules.length}↗
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Add rule button below card */}
                    {!isScreen && (
                      <button
                        onClick={() => handleAdd(block.id)}
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
        </div>

        {/* ── Rule edit panel ── */}
        {sel && liveRule && (
          <RuleEditPanel
            blockId={sel.blockId}
            rule={liveRule}
            blocks={blocks}
            onClose={() => setSel(null)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Searchable block selector ─────────────────────────────────────────────────

interface BlockOption { value: string; label: string }

interface SearchableBlockSelectProps {
  value: string
  onChange: (v: string) => void
  options: BlockOption[]
  placeholder?: string
  size?: 'sm' | 'md'
}

function SearchableBlockSelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner un bloc…',
  size = 'md',
}: SearchableBlockSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus search input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10)
  }, [open])

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const selected = options.find(o => o.value === value)
  const textSm = size === 'sm' ? 'text-xs' : 'text-sm'
  const py = size === 'sm' ? 'py-1.5' : 'py-2.5'

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setQuery('') }}
        className={`w-full flex items-center justify-between gap-2 px-3 ${py} border rounded-xl bg-white hover:border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-300 transition-colors ${textSm} ${open ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-gray-200'}`}
      >
        <span className={`truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[9999] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="flex-1 text-xs bg-transparent outline-none placeholder-gray-400"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-gray-300 hover:text-gray-500">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400">Aucun résultat</div>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value || '__empty__'}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 transition-colors ${
                    o.value === value ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700'
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

// ─── Rule edit panel ────────────────────────────────────────────────────────────

interface RuleEditPanelProps {
  blockId: string
  rule: LogicRule
  blocks: FormBlock[]
  onClose: () => void
}

function RuleEditPanel({ blockId, rule, blocks, onClose }: RuleEditPanelProps) {
  const { updateLogicRule, removeLogicRule } = useFormBuilder()

  const srcBlock = blocks.find(b => b.id === blockId)
  const srcIdx   = blocks.findIndex(b => b.id === blockId)

  const selectable = blocks.filter(
    b => !['welcome-screen', 'thankyou-screen', 'statement'].includes(b.type)
  )

  // Options for the jump target (all blocks including thankyou)
  const targetOptions: BlockOption[] = blocks.map((b, i) => ({
    value: b.id,
    label: b.type === 'thankyou-screen' ? 'Écran de fin' : `${i + 1}. ${b.attributes.label || 'Sans titre'}`,
  }))

  const updateCond = (ci: number, u: Partial<LogicCondition>) => {
    const next = [...rule.conditions]
    next[ci] = { ...next[ci], ...u }
    updateLogicRule(blockId, rule.id, { conditions: next })
  }

  const addCond = () => {
    const nc: LogicCondition = { blockId: selectable[0]?.id || '', operator: 'equals', value: '' }
    updateLogicRule(blockId, rule.id, { conditions: [...rule.conditions, nc] })
  }

  const removeCond = (ci: number) => {
    if (rule.conditions.length <= 1) return
    updateLogicRule(blockId, rule.id, { conditions: rule.conditions.filter((_, i) => i !== ci) })
  }

  const handleDelete = () => { removeLogicRule(blockId, rule.id); onClose() }

  return (
    <div className="w-80 bg-white border-l flex flex-col shrink-0" style={{ boxShadow: '-4px 0 16px rgba(0,0,0,.06)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 shrink-0">
        <span className="text-sm font-semibold text-gray-800">Éditer la règle</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={handleDelete}
            className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-5">
        {/* Source block info */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Bloc source</p>
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
            <span className="w-6 h-6 flex items-center justify-center bg-indigo-100 rounded-lg text-xs font-bold text-indigo-700 flex-shrink-0">
              {srcIdx + 1}
            </span>
            <span className="text-sm font-medium text-indigo-900 truncate">
              {srcBlock?.attributes.label || 'Sans titre'}
            </span>
          </div>
        </div>

        {/* Conditions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Si</p>
            <select
              value={rule.conditionMatch}
              onChange={e => updateLogicRule(blockId, rule.id, { conditionMatch: e.target.value as 'all' | 'any' })}
              className="text-xs border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
            >
              <option value="all">Toutes (ET)</option>
              <option value="any">L'une (OU)</option>
            </select>
          </div>

          {rule.conditions.map((cond, ci) => (
            <CondRow
              key={ci}
              cond={cond}
              selectable={selectable}
              allBlocks={blocks}
              canRemove={rule.conditions.length > 1}
              onUpdate={u => updateCond(ci, u)}
              onRemove={() => removeCond(ci)}
            />
          ))}

          <button
            onClick={addCond}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-indigo-600 border border-dashed border-indigo-300 rounded-xl hover:bg-indigo-50 transition-colors font-semibold"
          >
            <Plus className="w-3 h-3" />
            Ajouter une condition
          </button>
        </div>

        {/* Action */}
        <div className="space-y-2.5 pt-4 border-t">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Alors</p>
          <select
            value={rule.action}
            onChange={e => updateLogicRule(blockId, rule.id, { action: e.target.value as LogicRule['action'] })}
            className="w-full text-sm border rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
          >
            <option value="jump">Sauter vers…</option>
            <option value="hide">Masquer ce bloc</option>
            <option value="show">Afficher ce bloc</option>
            <option value="require">Rendre obligatoire</option>
          </select>

          {rule.action === 'jump' && (
            <SearchableBlockSelect
              value={rule.targetBlockId || ''}
              onChange={v => updateLogicRule(blockId, rule.id, { targetBlockId: v })}
              options={targetOptions}
              placeholder="Sélectionner un bloc…"
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Condition row ───────────────────────────────────────────────────────────────

interface CondRowProps {
  cond: LogicCondition
  selectable: FormBlock[]
  allBlocks: FormBlock[]
  canRemove: boolean
  onUpdate: (u: Partial<LogicCondition>) => void
  onRemove: () => void
}

function CondRow({ cond, selectable, allBlocks, canRemove, onUpdate, onRemove }: CondRowProps) {
  const src = allBlocks.find(b => b.id === cond.blockId)
    || selectable.find(b => b.id === cond.blockId)
  const hasChoices = (src?.attributes.choices?.length ?? 0) > 0
  const needsValue = !['is_empty', 'is_not_empty'].includes(cond.operator)

  const blockOptions: BlockOption[] = selectable.map((b, i) => ({
    value: b.id,
    label: `${i + 1}. ${b.attributes.label || 'Sans titre'}`,
  }))

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2 relative">
      {canRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2.5 right-2.5 text-gray-300 hover:text-red-400 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Block selector — searchable */}
      <SearchableBlockSelect
        value={cond.blockId}
        onChange={v => onUpdate({ blockId: v, value: '' })}
        options={blockOptions}
        placeholder="Sélectionner un bloc…"
        size="sm"
      />

      {/* Operator */}
      <select
        value={cond.operator}
        onChange={e => onUpdate({ operator: e.target.value as ConditionOperator })}
        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
      >
        {OPERATORS.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {/* Value */}
      {needsValue && (
        hasChoices ? (
          <select
            value={cond.value as string}
            onChange={e => onUpdate({ value: e.target.value })}
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
          >
            <option value="">Sélectionner…</option>
            {src!.attributes.choices!.map(c => (
              <option key={c.id} value={c.value}>{c.label}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={cond.value as string}
            onChange={e => onUpdate({ value: e.target.value })}
            placeholder="Valeur…"
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
          />
        )
      )}
    </div>
  )
}

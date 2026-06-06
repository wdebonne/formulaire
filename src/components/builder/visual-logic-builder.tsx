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
const BL = 220         // block left (space for left-side arrows)
const BW = 368         // block width
const BR = BL + BW     // block right edge
const ARROW_R_START = BR + 28   // right arrows start here
const ARROW_L_START = BL - 28   // left arrows start here
const LANE_W = 76      // width per lane
const CORNER = 10      // rounded corner radius
const AH = 10          // arrowhead size

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

/** Orthogonal path — RIGHT side: right edge → laneX → right edge */
function makeRightPath(laneX: number, sy: number, ty: number): string {
  const r = Math.min(CORNER, Math.abs(ty - sy) / 2.2)
  const sign = ty > sy ? 1 : -1
  if (Math.abs(ty - sy) < 2) return `M ${BR} ${sy} H ${BR + AH + 4}`
  return [
    `M ${BR} ${sy}`,
    `L ${laneX - r} ${sy}`,
    `Q ${laneX} ${sy} ${laneX} ${sy + r * sign}`,
    `L ${laneX} ${ty - r * sign}`,
    `Q ${laneX} ${ty} ${laneX - r} ${ty}`,
    `L ${BR + AH + 4} ${ty}`,
  ].join(' ')
}

/** Orthogonal path — LEFT side: left edge → laneX → left edge */
function makeLeftPath(laneX: number, sy: number, ty: number): string {
  const r = Math.min(CORNER, Math.abs(ty - sy) / 2.2)
  const sign = ty > sy ? 1 : -1
  if (Math.abs(ty - sy) < 2) return `M ${BL} ${sy} H ${BL - AH - 4}`
  return [
    `M ${BL} ${sy}`,
    `L ${laneX + r} ${sy}`,
    `Q ${laneX} ${sy} ${laneX} ${sy + r * sign}`,
    `L ${laneX} ${ty - r * sign}`,
    `Q ${laneX} ${ty} ${laneX + r} ${ty}`,
    `L ${BL - AH - 4} ${ty}`,
  ].join(' ')
}

/** Assign right/left side per rule — alternates per source block to balance both sides */
function assignSides(jumps: { id: string; si: number }[]): Map<string, 'right' | 'left'> {
  const sides = new Map<string, 'right' | 'left'>()
  const bySrc = new Map<number, string[]>()
  for (const j of jumps) {
    if (!bySrc.has(j.si)) bySrc.set(j.si, [])
    bySrc.get(j.si)!.push(j.id)
  }
  bySrc.forEach(ids => {
    ids.forEach((id, i) => sides.set(id, i % 2 === 0 ? 'right' : 'left'))
  })
  return sides
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

  // Assign right/left side to each arrow
  const sides = useMemo(
    () => assignSides(jumps.map(j => ({ id: j.rule.id, si: j.si }))),
    [jumps]
  )

  // Separate lane pools per side
  const rightJumps = useMemo(() => jumps.filter(j => sides.get(j.rule.id) === 'right'), [jumps, sides])
  const leftJumps  = useMemo(() => jumps.filter(j => sides.get(j.rule.id) === 'left'),  [jumps, sides])
  const rightLanes = useMemo(() => assignLanes(rightJumps.map(j => ({ id: j.rule.id, si: j.si, ti: j.ti }))), [rightJumps])
  const leftLanes  = useMemo(() => assignLanes(leftJumps.map(j =>  ({ id: j.rule.id, si: j.si, ti: j.ti }))), [leftJumps])

  // Stagger: per-side, separate source offsets to avoid mixing left/right arrows at same Y
  const { outOff, inOff } = useMemo(() => {
    const out = new Map<string, number>()
    const inn = new Map<string, number>()

    // By source + side
    const bySrcSide = new Map<string, typeof jumps>()
    for (const j of jumps) {
      const key = `${j.si}-${sides.get(j.rule.id)}`
      if (!bySrcSide.has(key)) bySrcSide.set(key, [])
      bySrcSide.get(key)!.push(j)
    }
    bySrcSide.forEach(g => {
      const n = g.length
      g.forEach((j, i) => out.set(j.rule.id, n === 1 ? 0 : (i - (n - 1) / 2) * 16))
    })

    // By target + side
    const byTgtSide = new Map<string, typeof jumps>()
    for (const j of jumps) {
      const key = `${j.ti}-${sides.get(j.rule.id)}`
      if (!byTgtSide.has(key)) byTgtSide.set(key, [])
      byTgtSide.get(key)!.push(j)
    }
    byTgtSide.forEach(g => {
      const n = g.length
      g.forEach((j, i) => inn.set(j.rule.id, n === 1 ? 0 : (i - (n - 1) / 2) * 16))
    })

    return { outOff: out, inOff: inn }
  }, [jumps, sides])

  const maxRightLane = Math.max(0, ...Array.from(rightLanes.values()))
  const maxLeftLane  = Math.max(0, ...Array.from(leftLanes.values()))
  const canvasW = ARROW_R_START + (maxRightLane + 1) * LANE_W + 48
  const canvasH = PAD_TOP + blocks.length * BSTEP + PAD_BOT

  const handleAdd = (blockId: string) => {
    const blockIdx = blocks.findIndex(b => b.id === blockId)
    const nextBlock = blocks[blockIdx + 1] ?? blocks[blocks.length - 1]
    const newRule: LogicRule = {
      id: uuidv4(),
      conditions: [{ blockId, operator: 'equals', value: '' }],
      conditionMatch: 'all',
      action: 'jump',
      targetBlockId: nextBlock?.id || '',
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

                {/* Jump rule arrows — left & right sides */}
                {jumps.map(j => {
                  const isLeft   = sides.get(j.rule.id) === 'left'
                  const lanePool = isLeft ? leftLanes : rightLanes
                  const lane     = lanePool.get(j.rule.id) ?? 0
                  const laneX    = isLeft
                    ? ARROW_L_START - lane * LANE_W
                    : ARROW_R_START + lane * LANE_W
                  const sx  = isLeft ? BL : BR
                  const sy  = cy(j.si) + (outOff.get(j.rule.id) ?? 0)
                  const ty  = cy(j.ti) + (inOff.get(j.rule.id) ?? 0)
                  const midY = (sy + ty) / 2
                  const color = COLORS[j.ci]
                  const isSelected = sel?.ruleId === j.rule.id
                  const stroke = isSelected ? '#1d4ed8' : color
                  const sw = isSelected ? 3 : 2
                  const d = isLeft ? makeLeftPath(laneX, sy, ty) : makeRightPath(laneX, sy, ty)

                  // Arrowhead tip & base — points INTO block from the side
                  const tipX  = isLeft ? BL - AH - 4    : BR + AH + 4
                  const baseX = isLeft ? BL - AH * 2 - 4 : BR + AH * 2 + 4
                  // Label: to the LEFT of the lane for left-side arrows, to the right for right-side
                  const labelX = isLeft ? laneX - 132 : laneX + 6

                  return (
                    <g
                      key={j.rule.id}
                      style={{ pointerEvents: 'all', cursor: 'pointer' }}
                      onClick={() => setSel(
                        isSelected ? null : { blockId: j.blockId, ruleId: j.rule.id }
                      )}
                    >
                      <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
                      <path d={d} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
                      {/* Start dot */}
                      <circle cx={sx} cy={sy} r={4.5} fill={stroke} />
                      {/* Arrowhead */}
                      <polygon
                        points={`${tipX},${ty} ${baseX},${ty - AH / 1.5} ${baseX},${ty + AH / 1.5}`}
                        fill={stroke}
                      />
                      {/* Label badge on the vertical segment */}
                      <foreignObject
                        x={labelX}
                        y={midY - 11}
                        width={130}
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
                            maxWidth: 126,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            boxShadow: '0 1px 4px rgba(0,0,0,.18)',
                            lineHeight: '16px',
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
                const allRules   = bl?.rules ?? []
                const jumpRules  = allRules.filter(r => r.action === 'jump')
                const otherRules = allRules.filter(r => r.action !== 'jump')
                const isSelBlock = sel?.blockId === block.id
                const isScreen   = ['welcome-screen', 'thankyou-screen'].includes(block.type)
                const hasRules   = allRules.length > 0

                // Click on card body → open first rule's editor
                const handleCardClick = () => {
                  if (!hasRules) return
                  const firstRule = allRules[0]
                  setSel(prev =>
                    prev?.ruleId === firstRule.id ? null : { blockId: block.id, ruleId: firstRule.id }
                  )
                }

                return (
                  <div
                    key={block.id}
                    className="absolute"
                    style={{ left: BL, top: top(idx), width: BW, height: BH }}
                  >
                    <div
                      onClick={handleCardClick}
                      className={`w-full h-full rounded-xl border-2 bg-white shadow-sm flex items-center gap-3 px-3 transition-all select-none ${
                        isSelBlock
                          ? 'border-indigo-500 shadow-md shadow-indigo-100'
                          : hasRules
                            ? 'border-gray-200 hover:border-indigo-300 hover:shadow cursor-pointer'
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

                      {/* Label — slightly larger max-width when no badges */}
                      <span
                        className="flex-1 text-sm font-medium text-gray-800 truncate"
                        title={block.attributes.label || 'Sans titre'}
                      >
                        {block.attributes.label || 'Sans titre'}
                      </span>

                      {/* Rule badges — stop propagation so badge clicks don't also fire card click */}
                      <div
                        className="flex gap-1 flex-shrink-0 items-center"
                        onClick={e => e.stopPropagation()}
                      >
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
                          <button
                            onClick={() => setSel(
                              sel?.ruleId === jumpRules[0].id ? null : { blockId: block.id, ruleId: jumpRules[0].id }
                            )}
                            className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold transition-colors ${
                              isSelBlock && sel && jumpRules.some(r => r.id === sel.ruleId)
                                ? 'bg-emerald-500 text-white'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {jumpRules.length}↗
                          </button>
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
            onSelectRule={(ruleId) => setSel({ blockId: sel.blockId, ruleId })}
            onAddRule={() => handleAdd(sel.blockId)}
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
  onSelectRule: (ruleId: string) => void
  onAddRule: () => void
}

const ACTION_META: Record<string, { label: string; color: string }> = {
  jump:    { label: 'Sauter',   color: '#6366f1' },
  hide:    { label: 'Masquer',  color: '#ef4444' },
  show:    { label: 'Afficher', color: '#10b981' },
  require: { label: 'Requis',   color: '#f59e0b' },
}

function RuleEditPanel({ blockId, rule, blocks, onClose, onSelectRule, onAddRule }: RuleEditPanelProps) {
  const { logic, updateLogicRule, removeLogicRule } = useFormBuilder()

  const safeLogic = Array.isArray(logic) ? logic : []
  const allRules  = safeLogic.find(l => l.blockId === blockId)?.rules ?? []

  const srcBlock = blocks.find(b => b.id === blockId)
  const srcIdx   = blocks.findIndex(b => b.id === blockId)

  const selectable = blocks.filter(
    b => !['welcome-screen', 'thankyou-screen', 'statement'].includes(b.type)
  )

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
    <div className="flex bg-white border-l shrink-0" style={{ width: 420, boxShadow: '-4px 0 16px rgba(0,0,0,.06)' }}>

      {/* ── Left: rule list navigation ── */}
      <div className="w-36 border-r bg-gray-50 flex flex-col shrink-0">
        {/* Sidebar header */}
        <div className="px-3 py-2.5 border-b bg-gray-100 shrink-0">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
            {srcIdx + 1}. {srcBlock?.attributes.label?.slice(0, 16) || 'Bloc'}
          </p>
        </div>

        {/* Rule list */}
        <div className="flex-1 overflow-auto py-1">
          {allRules.map((r, i) => {
            const meta = ACTION_META[r.action] ?? ACTION_META.jump
            const cond = r.conditions[0]
            const condBlock = blocks.find(b => b.id === cond?.blockId)
            const condLabel = condBlock?.attributes.label?.slice(0, 18) || '?'
            const isActive  = r.id === rule.id
            return (
              <button
                key={r.id}
                onClick={() => onSelectRule(r.id)}
                className={`w-full text-left px-3 py-2 transition-colors border-l-2 ${
                  isActive
                    ? 'bg-white border-indigo-500'
                    : 'border-transparent hover:bg-gray-100 hover:border-gray-300'
                }`}
              >
                <span
                  className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mb-1"
                  style={{ background: meta.color + '20', color: meta.color }}
                >
                  {meta.label}
                </span>
                <p className="text-[11px] text-gray-600 truncate leading-tight">{condLabel}</p>
              </button>
            )
          })}
        </div>

        {/* Add rule */}
        <button
          onClick={onAddRule}
          className="flex items-center justify-center gap-1 px-3 py-2 border-t text-xs text-indigo-600 hover:bg-indigo-50 transition-colors font-semibold shrink-0"
        >
          <Plus className="w-3 h-3" />
          Nouvelle règle
        </button>
      </div>

      {/* ── Right: editor ── */}
      <div className="flex-1 flex flex-col min-w-0">
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
      </div>{/* end right editor column */}
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

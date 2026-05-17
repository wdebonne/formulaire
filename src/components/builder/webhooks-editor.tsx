'use client'

import { useState, useRef, useEffect } from 'react'
import { useFormBuilder } from '@/stores/form-builder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FormBlock, Webhook, WebhookFieldMapping, WebhookHeader } from '@/types/form'
import { v4 as uuidv4 } from 'uuid'
import {
  Plus, Trash2, ChevronDown, ChevronRight, Webhook as WebhookIcon,
  Play, Maximize2, X, ArrowRight, Calendar, Clock, AtSign,
  AlignLeft, Hash, Mail, Phone, List, CheckSquare, Layers,
  ToggleLeft, Globe, FileText, PenLine, Image, LayoutList, Search,
  GripVertical,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface WebhooksEditorProps {
  blocks: FormBlock[]
}

// ─── Icône par type de bloc ───────────────────────────────────────────────────
function getBlockTypeIcon(type: string) {
  const cls = 'w-3.5 h-3.5'
  switch (type) {
    case 'short-text':    return <AlignLeft className={cls} />
    case 'long-text':     return <FileText className={cls} />
    case 'email':         return <Mail className={cls} />
    case 'phone':         return <Phone className={cls} />
    case 'number':        return <Hash className={cls} />
    case 'dropdown':      return <List className={cls} />
    case 'multiple-choice': return <CheckSquare className={cls} />
    case 'date':
    case 'advanced-date': return <Calendar className={cls} />
    case 'time':          return <Clock className={cls} />
    case 'group':         return <Layers className={cls} />
    case 'repeater':      return <LayoutList className={cls} />
    case 'legal':         return <ToggleLeft className={cls} />
    case 'website':       return <Globe className={cls} />
    case 'signature':     return <PenLine className={cls} />
    case 'image-selection': return <Image className={cls} />
    default:              return <AlignLeft className={cls} />
  }
}

// ─── Formats date/heure prédéfinis ────────────────────────────────────────────
const DATE_FORMATS = [
  { token: '{date:dd-MM-YYYY}',     label: 'dd-MM-YYYY',     example: '23-05-2026' },
  { token: '{date:YYYY-MM-dd}',     label: 'YYYY-MM-dd',     example: '2026-05-23' },
  { token: '{date:ddMMYYYY}',       label: 'ddMMYYYY',       example: '23052026' },
  { token: '{date:YYYYMMdd}',       label: 'YYYYMMdd',       example: '20260523' },
  { token: '{date:dd-MM-YY}',       label: 'dd-MM-YY',       example: '23-05-26' },
]

const TIME_FORMATS = [
  { token: '{time:HH-mm-ss}', label: 'HH-mm-ss', example: '14-30-00' },
  { token: '{time:HH-mm}',    label: 'HH-mm',    example: '14-30' },
  { token: '{time:HHmmss}',   label: 'HHmmss',   example: '143000' },
  { token: '{time:HHmm}',     label: 'HHmm',     example: '1430' },
]

// ─── Résolution du template pour la prévisualisation ─────────────────────────
function resolvePreview(template: string, blocks: FormBlock[]): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const now = new Date()

  return template
    .replace(/\{field:([^}]+)\}/g, (_, blockId) => {
      const block = blocks.find((b) => b.id === blockId)
      return block ? `[${block.attributes.label || 'Champ'}]` : '[?]'
    })
    .replace(/\{date:([^}]+)\}/g, (_, fmt) =>
      fmt
        .replace('YYYY', String(now.getFullYear()))
        .replace('YY', String(now.getFullYear()).slice(-2))
        .replace('MM', pad(now.getMonth() + 1))
        .replace('dd', pad(now.getDate()))
    )
    .replace(/\{time:([^}]+)\}/g, (_, fmt) =>
      fmt
        .replace('HH', pad(now.getHours()))
        .replace('mm', pad(now.getMinutes()))
        .replace('ss', pad(now.getSeconds()))
    )
    .replace(/\{entry_id\}/g, '[ID-réponse]')
    .replace(/\{form_id\}/g, '[ID-formulaire]')
}

// ─── Éditeur de valeur personnalisée ─────────────────────────────────────────
function CustomValueEditor({
  template,
  allMappableBlocks,
  onTemplateChange,
}: {
  template: string
  allMappableBlocks: FormBlock[]
  onTemplateChange: (t: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showFields, setShowFields] = useState(false)
  const [showDates, setShowDates] = useState(false)
  const [showTimes, setShowTimes] = useState(false)

  const insertToken = (token: string) => {
    const el = textareaRef.current
    if (!el) { onTemplateChange(template + token); return }
    const start = el.selectionStart
    const end = el.selectionEnd
    const next = template.slice(0, start) + token + template.slice(end)
    onTemplateChange(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    }, 0)
  }

  const preview = template ? resolvePreview(template, allMappableBlocks) : ''

  return (
    <div className="mt-1.5 space-y-2 p-3 bg-gray-50 border border-dashed rounded-lg">
      {/* Zone de saisie du template */}
      <textarea
        ref={textareaRef}
        value={template}
        onChange={(e) => onTemplateChange(e.target.value)}
        placeholder="ex: rapport_{field:abc}_{date:dd-MM-YYYY}_{time:HH-mm-ss}.pdf"
        rows={2}
        className="w-full px-2.5 py-1.5 text-xs font-mono border rounded resize-none focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white"
      />

      {/* Barre d'outils */}
      <div className="flex flex-wrap gap-1.5">
        {/* Insérer un champ */}
        <div className="relative">
          {showFields && (
            <div className="fixed inset-0 z-10" onClick={() => setShowFields(false)} />
          )}
          <button
            type="button"
            onClick={() => { setShowFields(!showFields); setShowDates(false); setShowTimes(false) }}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded hover:bg-purple-100 font-medium"
          >
            <AtSign className="w-3 h-3" /> Champ
          </button>
          {showFields && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white border rounded-lg shadow-xl w-60 max-h-52 overflow-y-auto">
              <div className="p-1.5 space-y-0.5">
                <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Métadonnées</p>
                {[
                  { token: '{entry_id}', label: 'ID de la réponse' },
                  { token: '{form_id}', label: 'ID du formulaire' },
                ].map((item) => (
                  <button key={item.token} type="button"
                    onClick={() => { insertToken(item.token); setShowFields(false) }}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-purple-50 rounded text-purple-700 font-mono"
                  >
                    {item.token}
                    <span className="font-sans text-gray-500 ml-2 font-normal">{item.label}</span>
                  </button>
                ))}

                <p className="px-2 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Questions</p>
                {allMappableBlocks.map((b) => (
                  <button key={b.id} type="button"
                    onClick={() => { insertToken(`{field:${b.id}}`); setShowFields(false) }}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-purple-50 rounded flex items-center gap-1.5 text-gray-700"
                  >
                    <span className="text-gray-400 shrink-0">{getBlockTypeIcon(b.type)}</span>
                    <span className="truncate">{b.attributes.label || 'Sans titre'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Insérer une date */}
        <div className="relative">
          {showDates && (
            <div className="fixed inset-0 z-10" onClick={() => setShowDates(false)} />
          )}
          <button
            type="button"
            onClick={() => { setShowDates(!showDates); setShowFields(false); setShowTimes(false) }}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 font-medium"
          >
            <Calendar className="w-3 h-3" /> Date
          </button>
          {showDates && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white border rounded-lg shadow-xl w-52">
              <div className="p-1.5 space-y-0.5">
                <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Format date</p>
                {DATE_FORMATS.map((f) => (
                  <button key={f.token} type="button"
                    onClick={() => { insertToken(f.token); setShowDates(false) }}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 rounded flex items-center justify-between"
                  >
                    <span className="font-mono text-blue-700">{f.label}</span>
                    <span className="text-gray-400 text-xs">{f.example}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Insérer une heure */}
        <div className="relative">
          {showTimes && (
            <div className="fixed inset-0 z-10" onClick={() => setShowTimes(false)} />
          )}
          <button
            type="button"
            onClick={() => { setShowTimes(!showTimes); setShowFields(false); setShowDates(false) }}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 font-medium"
          >
            <Clock className="w-3 h-3" /> Heure
          </button>
          {showTimes && (
            <div className="absolute top-full left-0 mt-1 z-20 bg-white border rounded-lg shadow-xl w-48">
              <div className="p-1.5 space-y-0.5">
                <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Format heure</p>
                {TIME_FORMATS.map((f) => (
                  <button key={f.token} type="button"
                    onClick={() => { insertToken(f.token); setShowTimes(false) }}
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-green-50 rounded flex items-center justify-between"
                  >
                    <span className="font-mono text-green-700">{f.label}</span>
                    <span className="text-gray-400 text-xs">{f.example}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Aperçu */}
      {preview && (
        <div className="px-2.5 py-1.5 bg-white border rounded text-xs">
          <span className="text-gray-400">Aperçu : </span>
          <span className="font-mono text-gray-800 break-all">{preview}</span>
        </div>
      )}

      {/* Aide tokens */}
      <p className="text-xs text-gray-400">
        Tapez du texte libre et insérez des tokens via les boutons ci-dessus.
        Exemple nom de fichier Windows : <span className="font-mono text-gray-500">rapport_{'{date:dd-MM-YYYY}'}_{'{time:HH-mm-ss}'}.pdf</span>
      </p>
    </div>
  )
}

// ─── Sélecteur de bloc avec recherche ────────────────────────────────────────
function BlockValueSelect({
  value,
  onChange,
  questionBlocks,
  placeholder = 'Choisir une valeur…',
  size = 'sm',
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  questionBlocks: FormBlock[]
  placeholder?: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const q = search.toLowerCase().trim()

  type Item = { value: string; label: string; indent?: boolean }

  const metaItems: Item[] = [
    { value: 'entry_id', label: 'ID de la réponse' },
    { value: 'entry_date', label: 'Date de soumission' },
  ]

  const questionItems: Item[] = questionBlocks.flatMap((b) => [
    { value: b.id, label: b.attributes.label || 'Sans titre' },
    ...((b.type === 'group' || b.type === 'repeater') && b.innerBlocks?.length
      ? b.innerBlocks.map((ib: any) => ({
          value: ib.id,
          label: ib.attributes?.label || 'Sans titre',
          indent: true,
        }))
      : []),
  ])

  const filteredMeta = q ? metaItems.filter((i) => i.label.toLowerCase().includes(q)) : metaItems
  const filteredQuestions = q ? questionItems.filter((i) => i.label.toLowerCase().includes(q)) : questionItems
  const showCustom = !q || 'personnalisée'.includes(q) || 'texte'.includes(q)

  const allItems: Item[] = [
    ...metaItems,
    ...questionItems,
    { value: '_custom', label: '✏️  Personnalisée (texte + champs + date…)' },
  ]
  const selected = value ? allItems.find((i) => i.value === value) : null

  const isSmall = size === 'sm'
  const triggerH = isSmall ? 'h-7' : 'h-9'
  const textSz = isSmall ? 'text-xs' : 'text-sm'

  const handleSelect = (v: string) => {
    onChange(v)
    setOpen(false)
    setSearch('')
  }

  const noResults = filteredMeta.length === 0 && filteredQuestions.length === 0 && !showCustom

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-2 border rounded bg-white hover:bg-gray-50 ${triggerH} ${textSz}`}
      >
        <span className={`truncate ${!value ? 'text-gray-400' : value === '_custom' ? 'text-purple-700' : 'text-gray-700'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`flex-shrink-0 ml-1 text-gray-400 ${isSmall ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg overflow-hidden min-w-[200px]">
          <div className="p-1.5 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                autoFocus
                className="w-full pl-6 pr-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {!value && !q && (
              <button type="button" onClick={() => handleSelect('')}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-400 italic hover:bg-gray-50">
                {placeholder}
              </button>
            )}
            {filteredMeta.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">Métadonnées</div>
                {filteredMeta.map((item) => (
                  <button key={item.value} type="button" onClick={() => handleSelect(item.value)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors ${value === item.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                    {item.label}
                  </button>
                ))}
              </>
            )}
            {filteredQuestions.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">Questions</div>
                {filteredQuestions.map((item) => (
                  <button key={item.value} type="button" onClick={() => handleSelect(item.value)}
                    className={`w-full text-left text-xs hover:bg-blue-50 transition-colors py-1.5 ${item.indent ? 'pl-6' : 'pl-3'} pr-3 ${value === item.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                    {item.indent && <span className="text-gray-400">↳ </span>}{item.label}
                  </button>
                ))}
              </>
            )}
            {showCustom && (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">Valeur personnalisée</div>
                <button type="button" onClick={() => handleSelect('_custom')}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-purple-50 transition-colors ${value === '_custom' ? 'bg-purple-50 text-purple-700 font-medium' : 'text-purple-600'}`}>
                  ✏️  Personnalisée (texte + champs + date…)
                </button>
              </>
            )}
            {noResults && (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">Aucun résultat pour &quot;{search}&quot;</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Ligne de mapping triable (drag & drop) ──────────────────────────────────
interface SortableMappingRowProps {
  id: string
  index: number
  mapping: WebhookFieldMapping
  allMappableBlocks: FormBlock[]
  questionBlocks: FormBlock[]
  isDragDisabled: boolean
  onUpdate: (index: number, updates: Partial<WebhookFieldMapping>) => void
  onRemove: (index: number) => void
}

function SortableMappingRow({
  id, index, mapping, allMappableBlocks, questionBlocks,
  isDragDisabled, onUpdate, onRemove,
}: SortableMappingRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isDragDisabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? 'relative' as const : undefined,
  }

  const block = allMappableBlocks.find((b) => b.id === mapping.blockId)
  const isCustom = mapping.blockId === '_custom'
  const hasKey = mapping.key.trim() !== ''
  const isRepeater = block?.type === 'repeater'
  const isFlatRepeater = isRepeater && mapping.flatRepeater

  const flatPreviewKeys = isFlatRepeater && hasKey && block?.innerBlocks
    ? block.innerBlocks.slice(0, 2).map((ib: any) => {
        const slug = (ib.attributes?.label || ib.id || 'champ')
          .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
        return `${mapping.key}_${slug}_1`
      })
    : []

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="grid grid-cols-[20px_1fr_28px_1fr_36px] gap-2 items-center group">
        {/* Poignée de tri */}
        <div
          className={`flex items-center justify-center h-9 text-gray-300 hover:text-gray-500 transition-colors ${isDragDisabled ? 'opacity-0 pointer-events-none' : 'cursor-grab active:cursor-grabbing'}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        {/* Clé JSON */}
        <Input
          value={mapping.key}
          onChange={(e) => onUpdate(index, { key: e.target.value })}
          placeholder={isFlatRepeater ? 'préfixe_clé' : 'nom_du_champ'}
          className={`h-9 text-sm font-mono ${hasKey ? 'text-orange-600 border-orange-200 bg-orange-50/50' : ''}`}
        />
        {/* Flèche */}
        <div className="flex items-center justify-center">
          <ArrowRight className="w-4 h-4 text-gray-400" />
        </div>
        {/* Sélecteur de valeur */}
        <BlockValueSelect
          value={mapping.blockId}
          onChange={(v) => onUpdate(index, {
            blockId: v,
            customTemplate: v !== '_custom' ? undefined : '',
            flatRepeater: false,
          })}
          questionBlocks={questionBlocks}
          size="md"
        />
        {/* Supprimer */}
        <Button
          variant="ghost" size="sm"
          className="h-9 px-2 text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Option clés plates pour les répéteurs */}
      {isRepeater && (
        <div className="pl-7 pr-10 ml-1">
          <label className="flex items-start gap-2 cursor-pointer group/flat">
            <input
              type="checkbox"
              checked={!!mapping.flatRepeater}
              onChange={(e) => onUpdate(index, { flatRepeater: e.target.checked })}
              className="mt-0.5 accent-orange-500"
            />
            <div>
              <span className="text-xs text-gray-600 group-hover/flat:text-gray-800">
                Développer en clés plates <span className="font-mono text-orange-600">préfixe_champ_N</span>
              </span>
              {isFlatRepeater && flatPreviewKeys.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Ex : <span className="font-mono">{flatPreviewKeys.join(', ')}, …</span>
                </p>
              )}
              {!isFlatRepeater && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Par défaut : envoie un tableau d&apos;objets JSON
                </p>
              )}
            </div>
          </label>
        </div>
      )}

      {/* Éditeur de valeur personnalisée */}
      {isCustom && (
        <div className="pl-7 pr-10">
          <CustomValueEditor
            template={mapping.customTemplate || ''}
            allMappableBlocks={allMappableBlocks}
            onTemplateChange={(t) => onUpdate(index, { customTemplate: t })}
          />
        </div>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────
export function WebhooksEditor({ blocks }: WebhooksEditorProps) {
  const { webhooks, addWebhook, updateWebhook, removeWebhook } = useFormBuilder()
  const [expandedWebhooks, setExpandedWebhooks] = useState<string[]>([])
  const [maximizedWebhookId, setMaximizedWebhookId] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [mappingSearch, setMappingSearch] = useState('')
  const { toast } = useToast()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const questionBlocks = blocks.filter(
    (b) => !['welcome-screen', 'thankyou-screen', 'statement'].includes(b.type)
  )

  // Tous les blocs mappables (y compris innerBlocks des groupes/répéteurs)
  const allMappableBlocks: FormBlock[] = []
  questionBlocks.forEach((b) => {
    allMappableBlocks.push(b)
    if ((b.type === 'group' || b.type === 'repeater') && b.innerBlocks) {
      b.innerBlocks.forEach((inner) => allMappableBlocks.push(inner))
    }
  })

  useEffect(() => { setMappingSearch('') }, [maximizedWebhookId])

  const toggleExpanded = (webhookId: string) => {
    setExpandedWebhooks((prev) =>
      prev.includes(webhookId) ? prev.filter((id) => id !== webhookId) : [...prev, webhookId]
    )
  }

  const handleAddWebhook = () => {
    const newWebhook: Webhook = {
      id: uuidv4(),
      name: `Webhook ${webhooks.length + 1}`,
      url: '',
      method: 'POST',
      headers: [],
      bodyFormat: 'JSON',
      fieldMappings: [],
      enabled: true,
      triggerOn: 'submission',
    }
    addWebhook(newWebhook)
    setExpandedWebhooks((prev) => [...prev, newWebhook.id])
  }

  const handleAddHeader = (webhookId: string) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return
    updateWebhook(webhookId, { headers: [...webhook.headers, { key: '', value: '' }] })
  }

  const handleUpdateHeader = (webhookId: string, i: number, updates: Partial<WebhookHeader>) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return
    const h = [...webhook.headers]
    h[i] = { ...h[i], ...updates }
    updateWebhook(webhookId, { headers: h })
  }

  const handleRemoveHeader = (webhookId: string, i: number) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return
    updateWebhook(webhookId, { headers: webhook.headers.filter((_, idx) => idx !== i) })
  }

  const handleAddFieldMapping = (webhookId: string) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return
    updateWebhook(webhookId, { fieldMappings: [...webhook.fieldMappings, { key: '', blockId: '' }] })
  }

  const handleUpdateFieldMapping = (webhookId: string, i: number, updates: Partial<WebhookFieldMapping>) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return
    const m = [...webhook.fieldMappings]
    m[i] = { ...m[i], ...updates }
    updateWebhook(webhookId, { fieldMappings: m })
  }

  const handleRemoveFieldMapping = (webhookId: string, i: number) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return
    updateWebhook(webhookId, { fieldMappings: webhook.fieldMappings.filter((_, idx) => idx !== i) })
  }

  const handleReorderFieldMappings = (webhookId: string, oldIndex: number, newIndex: number) => {
    const webhook = webhooks.find((w) => w.id === webhookId)
    if (!webhook) return
    updateWebhook(webhookId, { fieldMappings: arrayMove(webhook.fieldMappings, oldIndex, newIndex) })
  }

  const handleTestWebhook = async (webhook: Webhook) => {
    if (!webhook.url) {
      toast({ title: 'Erreur', description: 'Veuillez saisir une URL', variant: 'destructive' })
      return
    }
    setTesting(webhook.id)
    try {
      const testData: Record<string, any> = { _test: true, _timestamp: new Date().toISOString() }
      webhook.fieldMappings.forEach((mapping) => {
        if (!mapping.key) return
        if (mapping.blockId === 'entry_date') {
          testData[mapping.key] = new Date().toISOString()
        } else if (mapping.blockId === 'entry_id') {
          testData[mapping.key] = 'test-entry-id'
        } else if (mapping.blockId === '_custom') {
          testData[mapping.key] = mapping.customTemplate
            ? resolvePreview(mapping.customTemplate, allMappableBlocks)
            : ''
        } else {
          const block = allMappableBlocks.find((b) => b.id === mapping.blockId)
          testData[mapping.key] = `Valeur test pour "${block?.attributes.label || 'champ'}"`
        }
      })
      const headers: Record<string, string> = {}
      webhook.headers.forEach((h) => { if (h.key) headers[h.key] = h.value })
      if (webhook.bodyFormat === 'JSON') headers['Content-Type'] = 'application/json'

      const res = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhook.url, method: webhook.method, headers, data: testData, bodyFormat: webhook.bodyFormat }),
      })
      const result = await res.json()
      if (result.success) {
        toast({ title: 'Test réussi', description: `Réponse: ${result.status}` })
      } else {
        throw new Error(result.error || 'Erreur lors du test')
      }
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } finally {
      setTesting(null)
    }
  }

  // ─── Formulaire webhook (compact + agrandi) ─────────────────────────────────
  const renderWebhookForm = (webhook: Webhook, compact = true) => {
    const inputCls = compact ? 'h-8 text-sm' : 'h-9 text-sm'
    const selectCls = compact
      ? 'w-full px-2 py-1 text-sm border rounded'
      : 'w-full px-3 py-2 text-sm border rounded-md'

    return (
      <div className={compact ? 'p-3 space-y-4 border-t' : 'space-y-4'}>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Nom</Label>
          <Input value={webhook.name} onChange={(e) => updateWebhook(webhook.id, { name: e.target.value })} placeholder="Nom du webhook" className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">URL</Label>
          <Input value={webhook.url} onChange={(e) => updateWebhook(webhook.id, { url: e.target.value })} placeholder="https://..." className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Méthode</Label>
          <select value={webhook.method} onChange={(e) => updateWebhook(webhook.id, { method: e.target.value as Webhook['method'] })} className={selectCls}>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="PATCH">PATCH</option>
            <option value="GET">GET</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Déclencher</Label>
          <select value={webhook.triggerOn} onChange={(e) => updateWebhook(webhook.id, { triggerOn: e.target.value as Webhook['triggerOn'] })} className={selectCls}>
            <option value="submission">À la soumission</option>
            <option value="partial">Soumission partielle</option>
            <option value="save">À l'enregistrement</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Format du corps</Label>
          <select value={webhook.bodyFormat} onChange={(e) => updateWebhook(webhook.id, { bodyFormat: e.target.value as Webhook['bodyFormat'] })} className={selectCls}>
            <option value="JSON">JSON</option>
            <option value="FORM">Form Data</option>
          </select>
        </div>

        {/* En-têtes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">En-têtes</Label>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleAddHeader(webhook.id)}>
              <Plus className="w-3 h-3 mr-1" />Ajouter
            </Button>
          </div>
          {webhook.headers.map((header, i) => (
            <div key={i} className="flex items-center space-x-2">
              <Input value={header.key} onChange={(e) => handleUpdateHeader(webhook.id, i, { key: e.target.value })} placeholder="Clé" className="h-7 text-xs flex-1" />
              <Input value={header.value} onChange={(e) => handleUpdateHeader(webhook.id, i, { value: e.target.value })} placeholder="Valeur" className="h-7 text-xs flex-1" />
              <Button variant="ghost" size="sm" className="h-7 px-2 text-red-400 hover:text-red-600" onClick={() => handleRemoveHeader(webhook.id, i)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>

        {/* Actif */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Label className="text-xs font-medium">Actif</Label>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={webhook.enabled} onChange={(e) => updateWebhook(webhook.id, { enabled: e.target.checked })} className="sr-only peer" />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>

        {/* Test */}
        <Button variant="outline" size="sm" className="w-full" onClick={() => handleTestWebhook(webhook)} disabled={testing === webhook.id}>
          <Play className="w-4 h-4 mr-1" />
          {testing === webhook.id ? 'Test en cours...' : 'Tester le webhook'}
        </Button>
      </div>
    )
  }

  // ─── Selector block commun ──────────────────────────────────────────────────
  const BlockSelector = ({ webhookId, mapping, index, className = '' }: {
    webhookId: string; mapping: WebhookFieldMapping; index: number; className?: string
  }) => (
    <BlockValueSelect
      value={mapping.blockId}
      onChange={(v) => handleUpdateFieldMapping(webhookId, index, {
        blockId: v,
        customTemplate: v !== '_custom' ? undefined : (mapping.customTemplate || ''),
      })}
      questionBlocks={questionBlocks}
      placeholder="Sélectionner…"
      size="sm"
      className={className}
    />
  )

  // ─── Mapping agrandi (deux colonnes, recherche + drag & drop) ───────────────
  const renderFieldMappingsExpanded = (webhook: Webhook) => {
    const isSearching = mappingSearch.trim() !== ''
    const q = mappingSearch.toLowerCase()

    const filteredMappings = webhook.fieldMappings
      .map((m, i) => ({ mapping: m, originalIndex: i }))
      .filter(({ mapping }) => {
        if (!isSearching) return true
        if (mapping.key.toLowerCase().includes(q)) return true
        const block = allMappableBlocks.find((b) => b.id === mapping.blockId)
        if (block && (block.attributes.label || '').toLowerCase().includes(q)) return true
        if (mapping.blockId === 'entry_date' && 'date entrée'.includes(q)) return true
        if (mapping.blockId === 'entry_id' && 'id entrée'.includes(q)) return true
        if (mapping.blockId === '_custom' && (mapping.customTemplate || '').toLowerCase().includes(q)) return true
        return false
      })

    const items = webhook.fieldMappings.map((_, i) => String(i))

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id) {
        handleReorderFieldMappings(webhook.id, Number(active.id), Number(over.id))
      }
    }

    return (
      <div className="space-y-3">
        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <Input
            value={mappingSearch}
            onChange={(e) => setMappingSearch(e.target.value)}
            placeholder="Rechercher un champ ou une valeur…"
            className="h-8 text-sm pl-8 pr-8 bg-gray-50 focus:bg-white"
          />
          {isSearching && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onClick={() => setMappingSearch('')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* En-têtes colonnes */}
        <div className="grid grid-cols-[20px_1fr_28px_1fr_36px] gap-2 px-1">
          <span />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Clé JSON / Préfixe</span>
          <span />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Valeur</span>
          <span />
        </div>

        {/* États vides */}
        {webhook.fieldMappings.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Aucun mapping — cliquez sur &quot;+ Ajouter&quot;</p>
        )}
        {isSearching && filteredMappings.length === 0 && webhook.fieldMappings.length > 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Aucun résultat pour &quot;{mappingSearch}&quot;</p>
        )}

        {/* Compteur de résultats filtrage */}
        {isSearching && filteredMappings.length > 0 && (
          <p className="text-xs text-gray-400 px-1">
            {filteredMappings.length} résultat{filteredMappings.length !== 1 ? 's' : ''} sur {webhook.fieldMappings.length}
          </p>
        )}

        {/* Liste triable */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            {filteredMappings.map(({ mapping, originalIndex }) => (
              <SortableMappingRow
                key={originalIndex}
                id={String(originalIndex)}
                index={originalIndex}
                mapping={mapping}
                allMappableBlocks={allMappableBlocks}
                questionBlocks={questionBlocks}
                isDragDisabled={isSearching}
                onUpdate={(i, updates) => handleUpdateFieldMapping(webhook.id, i, updates)}
                onRemove={(i) => handleRemoveFieldMapping(webhook.id, i)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <Button variant="outline" size="sm" className="w-full border-dashed text-gray-500 hover:text-gray-700 mt-2" onClick={() => handleAddFieldMapping(webhook.id)}>
          <Plus className="w-4 h-4 mr-2" />Ajouter un mapping
        </Button>
      </div>
    )
  }

  // ─── Modal agrandie ──────────────────────────────────────────────────────────
  const maximizedWebhook = webhooks.find((w) => w.id === maximizedWebhookId)

  return (
    <>
      <div className="p-4 space-y-4">
        <div className="mb-4">
          <h3 className="font-medium">Webhooks</h3>
          <p className="text-sm text-gray-500 mt-1">Envoyez les réponses vers des services externes</p>
        </div>

        {webhooks.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <WebhookIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-medium">Aucun webhook</p>
            <p className="text-sm mt-1">Ajoutez un webhook pour envoyer les données</p>
          </div>
        )}

        {webhooks.map((webhook) => {
          const isExpanded = expandedWebhooks.includes(webhook.id)
          return (
            <div key={webhook.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3 bg-gray-50">
                <button onClick={() => toggleExpanded(webhook.id)} className="flex items-center space-x-2 flex-1 min-w-0">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  <WebhookIcon className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-medium truncate">{webhook.name}</span>
                  {!webhook.enabled && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded shrink-0">Désactivé</span>}
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-purple-600 hover:bg-purple-50" title="Agrandir"
                    onClick={(e) => { e.stopPropagation(); setMaximizedWebhookId(webhook.id) }}>
                    <Maximize2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => removeWebhook(webhook.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <>
                  {renderWebhookForm(webhook, true)}
                  {/* Mapping compact */}
                  <div className="px-3 pb-3 space-y-2 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Mapping des champs</Label>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-6 text-xs text-purple-600 hover:text-purple-700"
                          onClick={() => setMaximizedWebhookId(webhook.id)}>
                          <Maximize2 className="w-3 h-3 mr-1" />Agrandir
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleAddFieldMapping(webhook.id)}>
                          <Plus className="w-3 h-3 mr-1" />Ajouter
                        </Button>
                      </div>
                    </div>
                    {webhook.fieldMappings.map((mapping, index) => {
                      const compactBlock = allMappableBlocks.find((b) => b.id === mapping.blockId)
                      const isCompactRepeater = compactBlock?.type === 'repeater'
                      return (
                        <div key={index} className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Input value={mapping.key}
                              onChange={(e) => handleUpdateFieldMapping(webhook.id, index, { key: e.target.value })}
                              placeholder={isCompactRepeater && mapping.flatRepeater ? 'préfixe' : 'Clé JSON'}
                              className={`h-7 text-xs flex-1 font-mono ${mapping.key ? 'text-orange-600' : ''}`} />
                            <BlockSelector webhookId={webhook.id} mapping={mapping} index={index} className="flex-1 h-7" />
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-red-400"
                              onClick={() => handleRemoveFieldMapping(webhook.id, index)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          {/* Toggle clés plates (compact) */}
                          {isCompactRepeater && (
                            <label className="flex items-center gap-1.5 cursor-pointer pl-0.5">
                              <input
                                type="checkbox"
                                checked={!!mapping.flatRepeater}
                                onChange={(e) => handleUpdateFieldMapping(webhook.id, index, { flatRepeater: e.target.checked })}
                                className="accent-orange-500 w-3 h-3"
                              />
                              <span className="text-xs text-gray-500">Clés plates <span className="font-mono text-orange-500">préfixe_champ_N</span></span>
                            </label>
                          )}
                          {/* Éditeur compact pour valeur personnalisée */}
                          {mapping.blockId === '_custom' && (
                            <CustomValueEditor
                              template={mapping.customTemplate || ''}
                              allMappableBlocks={allMappableBlocks}
                              onTemplateChange={(t) => handleUpdateFieldMapping(webhook.id, index, { customTemplate: t })}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )
        })}

        <Button variant="outline" className="w-full" onClick={handleAddWebhook}>
          <Plus className="w-4 h-4 mr-2" />Ajouter un webhook
        </Button>
      </div>

      {/* ─── Modal agrandie ──────────────────────────────────────────────── */}
      {maximizedWebhook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMaximizedWebhookId(null)}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full flex flex-col"
            style={{ maxWidth: '960px', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <WebhookIcon className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">{maximizedWebhook.name}</h2>
                  <p className="text-xs text-gray-400 truncate max-w-xs">{maximizedWebhook.url || 'URL non définie'}</p>
                </div>
                {!maximizedWebhook.enabled && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Désactivé</span>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-gray-700"
                onClick={() => setMaximizedWebhookId(null)} title="Rétrécir">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Corps — deux colonnes */}
            <div className="flex flex-1 overflow-hidden">
              {/* Config */}
              <div className="w-72 shrink-0 border-r overflow-y-auto p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Configuration</p>
                {renderWebhookForm(maximizedWebhook, false)}
              </div>

              {/* Mapping */}
              <div className="flex-1 overflow-y-auto p-5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Request Body</p>
                  <span className="text-xs text-gray-400">
                    {maximizedWebhook.fieldMappings.length} mapping{maximizedWebhook.fieldMappings.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-gray-500">Format :</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">{maximizedWebhook.bodyFormat}</span>
                </div>
                {renderFieldMappingsExpanded(maximizedWebhook)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

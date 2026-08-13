'use client'

import type { ReactNode } from 'react'

// Édition des valeurs d'une réponse déjà enregistrée (modal « Détail de la réponse »).
//
// Les valeurs manipulées ici sont celles de Response.data, donc déjà normalisées par
// resolveDataLabels() à la soumission : libellés de choix (« A, B » pour un choix multiple),
// dates au format du bloc. Chaque champ reconvertit cette forme d'affichage vers une valeur
// éditable, et renvoie une valeur brute (slug de choix, date ISO, tableau) que la route PATCH
// repasse dans resolveDataLabels() — le stockage reste ainsi identique à celui d'une soumission.

interface Choice {
  id?: string
  label: string
  value: string
}

export interface EditableBlock {
  id: string
  type: string
  attributes: {
    label?: string
    choices?: Choice[]
    [key: string]: any
  }
  innerBlocks?: EditableBlock[]
}

interface ResponseEditFieldsProps {
  blocks: EditableBlock[]
  data: Record<string, any>
  onChange: (key: string, value: any) => void
}

const READONLY_TYPES = ['file', 'signature', 'quantity']
const CHOICE_TYPES = ['dropdown', 'multiple-choice', 'image-selection']

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

function matchChoice(choices: Choice[], value: string): Choice | undefined {
  return choices.find((c) => c.value === value || c.id === value || c.label === value)
}

// « A, B » → ['A', 'B'], sans casser une option dont le libellé contient une virgule :
// les fragments consécutifs qui reconstituent une option connue sont recollés, plus longs d'abord.
function splitTokens(value: any, choices: Choice[]): string[] {
  if (value === null || value === undefined || value === '') return []
  if (Array.isArray(value)) return value.map((v) => String(v))

  const parts = String(value)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  const tokens: string[] = []
  let i = 0
  while (i < parts.length) {
    let matched = false
    for (let take = parts.length - i; take > 1; take--) {
      const candidate = parts.slice(i, i + take).join(', ')
      if (matchChoice(choices, candidate)) {
        tokens.push(candidate)
        i += take
        matched = true
        break
      }
    }
    if (!matched) {
      tokens.push(parts[i])
      i += 1
    }
  }
  return tokens
}

// Valeur stockée (« 12/08/2026 ») → valeur d'un <input type="date"> (« 2026-08-12 »).
// Retourne '' si la conversion échoue : l'appelant bascule alors sur un champ texte libre
// plutôt que d'effacer silencieusement une valeur qu'il ne sait pas relire.
function toDateInput(value: any, format = 'DD/MM/YYYY'): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const numbers = raw.match(/\d+/g)
  if (!numbers) return ''

  const tokens = format.match(/YYYY|YY|MM|DD/g) || ['DD', 'MM', 'YYYY']
  const parts: Record<string, string> = {}
  tokens.forEach((token, index) => {
    if (numbers[index]) parts[token] = numbers[index]
  })

  const year = parts.YYYY || (parts.YY ? `20${parts.YY}` : '')
  const month = parts.MM
  const day = parts.DD
  if (!year || !month || !day) return ''

  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function toText(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function BlockField({
  block,
  fieldKey,
  data,
  onChange,
}: {
  block: EditableBlock
  fieldKey: string
  data: Record<string, any>
  onChange: (key: string, value: any) => void
}) {
  const value = data[fieldKey]
  const label = block.attributes.label || block.id
  const choices = block.attributes.choices || []

  const wrap = (children: ReactNode, hint?: string) => (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )

  if (READONLY_TYPES.includes(block.type)) {
    return wrap(
      <p className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-500 break-all">
        {toText(value) || '-'}
      </p>,
      'Ce type de champ ne peut pas être corrigé ici.'
    )
  }

  if (CHOICE_TYPES.includes(block.type) && choices.length > 0) {
    const allowMultiple = Boolean(block.attributes.allowMultiple || block.attributes.multiple)
    const tokens = splitTokens(value, choices)
    const selected = tokens.map((token) => matchChoice(choices, token)?.value ?? token)
    const extras = tokens.filter((token) => !matchChoice(choices, token))

    if (!allowMultiple && block.type !== 'multiple-choice') {
      const current = selected[0] ?? ''
      return wrap(
        <select
          value={current}
          onChange={(e) => onChange(fieldKey, e.target.value ? [e.target.value] : '')}
          className={inputClass}
        >
          <option value="">— Aucune réponse —</option>
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
          {extras.map((extra) => (
            <option key={extra} value={extra}>
              {extra} (hors liste)
            </option>
          ))}
        </select>
      )
    }

    const toggle = (optionValue: string, checked: boolean) => {
      const next = checked
        ? allowMultiple
          ? [...selected, optionValue]
          : [optionValue]
        : selected.filter((v) => v !== optionValue)
      onChange(fieldKey, next)
    }

    return wrap(
      <div className="space-y-1.5 rounded-lg border border-gray-200 p-3">
        {choices.map((choice) => (
          <label key={choice.value} className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type={allowMultiple ? 'checkbox' : 'radio'}
              name={fieldKey}
              checked={selected.includes(choice.value)}
              onChange={(e) => toggle(choice.value, e.target.checked)}
              className="h-4 w-4"
            />
            {choice.label}
          </label>
        ))}
        {extras.map((extra) => (
          <label key={extra} className="flex items-center gap-2 text-sm text-gray-500 italic">
            <input
              type="checkbox"
              checked
              onChange={() => toggle(extra, false)}
              className="h-4 w-4"
            />
            {extra} (hors liste)
          </label>
        ))}
        {!allowMultiple && selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(fieldKey, [])}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Effacer la réponse
          </button>
        )}
      </div>
    )
  }

  switch (block.type) {
    case 'long-text':
      return wrap(
        <textarea
          value={toText(value)}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          rows={3}
          className={inputClass}
        />
      )

    case 'yes-no': {
      const yesLabel = block.attributes.yesLabel || 'Oui'
      const noLabel = block.attributes.noLabel || 'Non'
      const current = toText(value)
      return wrap(
        <select
          value={current === 'yes' || current === 'no' ? current : ''}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className={inputClass}
        >
          <option value="">— Aucune réponse —</option>
          <option value="yes">{yesLabel}</option>
          <option value="no">{noLabel}</option>
        </select>
      )
    }

    case 'legal':
      return wrap(
        <label className="flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={value === true || value === 'true'}
            onChange={(e) => onChange(fieldKey, e.target.checked)}
            className="h-4 w-4"
          />
          Accepté
        </label>
      )

    case 'number':
    case 'slider':
      return wrap(
        <input
          type="number"
          value={toText(value)}
          min={block.attributes.min}
          max={block.attributes.max}
          step={block.attributes.step ?? 'any'}
          onChange={(e) => onChange(fieldKey, e.target.value === '' ? '' : Number(e.target.value))}
          className={inputClass}
        />
      )

    case 'time':
      return wrap(
        <input
          type="time"
          value={toText(value)}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className={inputClass}
        />
      )

    case 'date':
    case 'advanced-date': {
      const format = block.attributes.format || 'DD/MM/YYYY'
      const dateValue = toDateInput(value, format)
      // Plage de dates ou valeur illisible : on garde un champ texte pour ne rien perdre.
      if (!dateValue && toText(value)) break
      return wrap(
        <input
          type="date"
          value={dateValue}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className={inputClass}
        />
      )
    }

    case 'email':
      return wrap(
        <input
          type="email"
          value={toText(value)}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className={inputClass}
        />
      )

    default:
      break
  }

  return wrap(
    <input
      type="text"
      value={toText(value)}
      onChange={(e) => onChange(fieldKey, e.target.value)}
      className={inputClass}
    />
  )
}

function repeaterCount(block: EditableBlock, data: Record<string, any>): number {
  const inners = block.innerBlocks || []
  if (inners.length === 0) return 0
  let index = 1
  while (inners.some((inner) => data[`${block.id}_${index}_${inner.id}`] !== undefined)) {
    index++
  }
  return index - 1
}

export function ResponseEditFields({ blocks, data, onChange }: ResponseEditFieldsProps) {
  return (
    <div className="space-y-5">
      {blocks.map((block) => {
        if (block.type === 'repeater' && block.innerBlocks?.length) {
          const count = repeaterCount(block, data)
          return (
            <div key={block.id} className="border-b pb-4 last:border-0">
              <p className="text-sm font-medium text-gray-500 mb-2">
                {block.attributes.label || block.id}
              </p>
              {count === 0 ? (
                <p className="text-sm text-gray-400">Aucune entrée</p>
              ) : (
                <div className="space-y-3">
                  {Array.from({ length: count }, (_, i) => i + 1).map((index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3 space-y-3">
                      <p className="text-xs font-medium text-gray-400">Entrée #{index}</p>
                      {block.innerBlocks!.map((inner) => (
                        <BlockField
                          key={inner.id}
                          block={inner}
                          fieldKey={`${block.id}_${index}_${inner.id}`}
                          data={data}
                          onChange={onChange}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        }

        if (block.type === 'group' && block.innerBlocks?.length) {
          return (
            <div key={block.id} className="border-b pb-4 last:border-0">
              <p className="text-sm font-medium text-gray-500 mb-2">
                {block.attributes.label || block.id}
              </p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                {block.innerBlocks.map((inner) => (
                  <BlockField
                    key={inner.id}
                    block={inner}
                    fieldKey={inner.id}
                    data={data}
                    onChange={onChange}
                  />
                ))}
              </div>
            </div>
          )
        }

        return (
          <div key={block.id} className="border-b pb-4 last:border-0">
            <BlockField block={block} fieldKey={block.id} data={data} onChange={onChange} />
          </div>
        )
      })}
    </div>
  )
}

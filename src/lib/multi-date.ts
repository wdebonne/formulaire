// Date avancée en mode « plusieurs dates » : un événement récurrent saisi sur un seul calendrier,
// plutôt qu'un formulaire rempli autant de fois qu'il y a de dates.
//
// Pendant la saisie la réponse est un tableau de dates ISO ; à la soumission, resolveDataLabels()
// la joint en « 03/10/2026, 10/10/2026 » comme un choix multiple. Les dates ne contiennent pas de
// virgule, donc la relecture par découpage est sûre.

import type { BlockAttributes } from '@/types/form'
import { findBlockDeep } from '@/lib/response-format'

type MultiDateAttributes = Pick<
  BlockAttributes,
  'multiDateMode' | 'multiDateConditionBlockId' | 'multiDateConditionValue'
>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function hasMultiDateOption(attributes: MultiDateAttributes | undefined): boolean {
  const mode = attributes?.multiDateMode
  return mode === 'always' || mode === 'conditional'
}

// Une condition se lit sur la réponse brute en cours de saisie (slug du choix, `yes`/`no`), mais
// reste vraie si la valeur attendue a été enregistrée comme libellé.
function matchesExpected(sourceBlock: any, answer: unknown, expected: string): boolean {
  const accepted = new Set([expected])
  const choice = (sourceBlock?.attributes?.choices || []).find(
    (c: any) => c.value === expected || c.id === expected || c.label === expected
  )
  if (choice) {
    accepted.add(choice.value)
    accepted.add(choice.label)
  }
  const values = Array.isArray(answer) ? answer : [answer]
  return values.some((v) => typeof v === 'string' && accepted.has(v))
}

// Dans un répéteur, la question source vit sous la même itération que la date :
// `{repeaterId}_{n}_{sourceId}` plutôt que `{sourceId}`.
function sourceAnswer(answers: Record<string, any>, sourceId: string, answerKey?: string): unknown {
  if (answerKey) {
    const m = answerKey.match(/^(.+_\d+)_[^_]+$/)
    if (m) {
      const scoped = answers[`${m[1]}_${sourceId}`]
      if (scoped !== undefined) return scoped
    }
  }
  return answers[sourceId]
}

export function isMultiDateActive(
  block: { attributes?: MultiDateAttributes } | undefined,
  answers: Record<string, any>,
  blocks: any[],
  answerKey?: string
): boolean {
  const attributes = block?.attributes
  if (attributes?.multiDateMode === 'always') return true
  if (attributes?.multiDateMode !== 'conditional') return false

  const sourceId = attributes.multiDateConditionBlockId
  const expected = attributes.multiDateConditionValue
  // Une condition incomplète ne s'applique pas : le bloc reste une date simple, comme avant.
  if (!sourceId || !expected) return false

  const answer = sourceAnswer(answers, sourceId, answerKey)
  return matchesExpected(findBlockDeep(blocks, sourceId), answer, expected)
}

export function toDateList(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : []
  const dates = parts
    .map((p) => (typeof p === 'string' ? p.trim().slice(0, 10) : ''))
    .filter((p) => ISO_DATE.test(p))
  return Array.from(new Set(dates)).sort()
}

function blockIdOfAnswerKey(answerKey: string): string {
  const parts = answerKey.split('_')
  return parts[parts.length - 1]
}

// Le répondant a pu cocher trois dates, revenir en arrière et répondre « Non » : la question ne
// demande plus qu'une date, on n'envoie que la première plutôt qu'une liste que le formulaire
// n'affichait plus.
export function normalizeMultiDateAnswers(
  data: Record<string, any>,
  blocks: any[]
): Record<string, any> {
  const normalized: Record<string, any> = { ...data }

  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value)) continue
    const block = findBlockDeep(blocks, key) ?? findBlockDeep(blocks, blockIdOfAnswerKey(key))
    if (block?.type !== 'advanced-date') continue

    const dates = toDateList(value)
    if (dates.length === 0) {
      delete normalized[key]
    } else if (!isMultiDateActive(block, data, blocks, key)) {
      normalized[key] = dates[0]
    } else {
      normalized[key] = dates
    }
  }

  return normalized
}

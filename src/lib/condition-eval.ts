// Évaluation des conditions d'un circuit d'envoi, contre une réponse déjà enregistrée.
//
// Volontairement pur (aucun import Prisma ni docxtemplater) : utilisable côté serveur à la
// soumission comme côté client pour prévisualiser quels circuits se déclencheraient.
//
// Ne pas confondre avec l'évaluateur de logique de formulaire de public-form-client.tsx : celui-ci
// travaille sur les réponses en cours de saisie, qui contiennent les valeurs brutes (slugs), alors
// qu'ici Response.data contient déjà les libellés résolus par resolveDataLabels(). D'où la
// normalisation des deux côtés avant comparaison.

import { findBlockDeep, formatBlockValue } from './response-format'
import type { LogicCondition } from '@/types/form'

function flatten(value: any): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(', ')
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => `${k} : ${flatten(v)}`)
      .join(', ')
  }
  return String(value)
}

/**
 * Ramène une valeur à une forme comparable, indépendante de la façon dont elle a été stockée.
 *
 * Un même choix peut apparaître comme slug (`service-technique`), identifiant, ou libellé
 * (`Service technique`) selon l'ancienneté de la réponse et selon qu'on regarde la condition ou
 * la donnée. Les blocs Oui/Non, eux, stockent `yes`/`no` alors que l'utilisateur raisonne en
 * « Oui »/« Non ».
 */
export function canonicalizeValue(block: any, value: any): string {
  const raw = String(value ?? '').trim().replace(/^__other__:/, '')
  const low = raw.toLowerCase()
  if (!low) return ''

  if (block?.type === 'yes-no') {
    const yes = String(block.attributes?.yesLabel || 'Oui').toLowerCase()
    const no = String(block.attributes?.noLabel || 'Non').toLowerCase()
    if (['yes', 'oui', 'true', yes].includes(low)) return 'yes'
    if (['no', 'non', 'false', no].includes(low)) return 'no'
    return low
  }

  if (block?.type === 'legal') {
    return ['true', 'oui', 'yes', '1'].includes(low) ? 'true' : 'false'
  }

  const choices: any[] = block?.attributes?.choices || []
  const match = choices.find((c) =>
    [c.value, c.id, c.label]
      .filter(Boolean)
      .some((candidate: any) => String(candidate).trim().toLowerCase() === low)
  )
  return String(match?.label ?? raw).trim().toLowerCase()
}

// Les valeurs comparables d'une réponse. Un choix multiple est stocké en chaîne jointe par
// resolveDataLabels : on la redécoupe pour que « est égal à » reste vrai sur une option cochée.
function answerParts(block: any, rawValue: any): string[] {
  if (rawValue === undefined || rawValue === null || rawValue === '') return []
  if (Array.isArray(rawValue)) return rawValue.map((v) => canonicalizeValue(block, v)).filter(Boolean)

  const formatted = flatten(formatBlockValue(block, rawValue))
  if (!formatted) return []
  return formatted
    .split(',')
    .map((part) => canonicalizeValue(block, part))
    .filter(Boolean)
}

function evaluateOne(
  condition: LogicCondition,
  blocks: any[],
  responseData: Record<string, any>
): boolean {
  const block = findBlockDeep(blocks, condition.blockId)
  const rawAnswer = responseData[condition.blockId]

  const hasAnswer =
    rawAnswer !== undefined &&
    rawAnswer !== null &&
    rawAnswer !== '' &&
    !(Array.isArray(rawAnswer) && rawAnswer.length === 0)

  const parts = answerParts(block, rawAnswer)
  const expected = canonicalizeValue(block, condition.value)
  const answerText = flatten(formatBlockValue(block, rawAnswer)).toLowerCase()
  const expectedText = String(condition.value ?? '').trim().toLowerCase()

  switch (condition.operator) {
    case 'equals':
      // Sur une question à choix multiples, vrai dès que l'option est cochée parmi d'autres.
      return hasAnswer && parts.includes(expected)
    case 'not_equals':
      return hasAnswer && !parts.includes(expected)
    case 'contains':
      return hasAnswer && answerText.includes(expectedText)
    case 'not_contains':
      return hasAnswer && !answerText.includes(expectedText)
    case 'greater_than':
      return hasAnswer && Number(rawAnswer) > Number(condition.value)
    case 'less_than':
      return hasAnswer && Number(rawAnswer) < Number(condition.value)
    case 'is_empty':
      return !hasAnswer
    case 'is_not_empty':
      return hasAnswer
    default:
      return false
  }
}

/**
 * Un circuit **sans condition part systématiquement**.
 *
 * C'est l'inverse du choix fait pour la logique de formulaire (où une règle sans condition ne
 * s'applique pas), et c'est délibéré : un circuit fraîchement créé, ou l'unique circuit issu de
 * l'ancienne configuration, doit envoyer sans qu'on ait à inventer une condition toujours vraie.
 */
export function evaluateRouteConditions(
  conditions: LogicCondition[] | undefined,
  match: 'all' | 'any' | undefined,
  blocks: any[],
  responseData: Record<string, any>
): boolean {
  const list = (conditions || []).filter((c) => c && c.blockId && c.operator)
  if (list.length === 0) return true

  const results = list.map((condition) => evaluateOne(condition, blocks, responseData))
  return match === 'any' ? results.some(Boolean) : results.every(Boolean)
}

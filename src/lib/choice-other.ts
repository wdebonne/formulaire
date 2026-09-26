// Option « Autre » d'un choix multiple : libellé personnalisable, et deux usages distincts.
//
// - `choice` (historique) : « Autre » est une option de plus, qui remplace ou s'ajoute aux choix
//   selon `allowMultiple`, et ouvre une saisie libre.
// - `complement` : un champ libre toujours affiché sous les choix (« Commentaire », « Votre avis »),
//   qui s'ajoute à la sélection sans en être une — y compris quand une seule réponse est permise.
//
// En mode complément, la saisie vit pendant le remplissage sous une clé à part
// (`{clé de la réponse}__complement`) : la réponse elle-même garde sa forme (chaîne pour un choix
// unique), si bien que la logique conditionnelle, qui compare avec `===`, continue de fonctionner.
// Elle n'est fusionnée dans la réponse qu'à l'envoi, par `mergeChoiceComplements()`, au format
// `__other__:` que tout l'aval (libellés, exports, webhooks, rapports) sait déjà nettoyer.

import type { BlockAttributes } from '@/types/form'
import { findBlockDeep } from '@/lib/response-format'

export const OTHER_PREFIX = '__other__:'
export const COMPLEMENT_SUFFIX = '__complement'
export const DEFAULT_OTHER_LABEL = 'Autre'

type OtherAttributes = Pick<BlockAttributes, 'allowOtherOption' | 'otherOptionLabel' | 'otherOptionMode'>

export function otherOptionLabel(attributes: OtherAttributes | undefined): string {
  return attributes?.otherOptionLabel?.trim() || DEFAULT_OTHER_LABEL
}

export function isComplementMode(attributes: OtherAttributes | undefined): boolean {
  return !!attributes?.allowOtherOption && attributes.otherOptionMode === 'complement'
}

export function complementKey(answerKey: string): string {
  return `${answerKey}${COMPLEMENT_SUFFIX}`
}

// Clé de premier niveau ou de groupe : l'identifiant du bloc. Clé de répéteur :
// `{repeaterId}_{n}_{innerId}` — les identifiants sont des UUID, sans tiret bas.
function blockIdOfAnswerKey(answerKey: string): string {
  const parts = answerKey.split('_')
  return parts[parts.length - 1]
}

export function mergeChoiceComplements(
  data: Record<string, any>,
  blocks: any[]
): Record<string, any> {
  const merged: Record<string, any> = { ...data }

  for (const key of Object.keys(data)) {
    if (!key.endsWith(COMPLEMENT_SUFFIX)) continue
    delete merged[key]

    const text = typeof data[key] === 'string' ? data[key].trim() : ''
    if (!text) continue

    const answerKey = key.slice(0, -COMPLEMENT_SUFFIX.length)
    const block = findBlockDeep(blocks, answerKey) ?? findBlockDeep(blocks, blockIdOfAnswerKey(answerKey))
    // Un complément dont le bloc a disparu ou changé de mode n'a plus de place où aller.
    if (!block || !isComplementMode(block.attributes)) continue

    const current = merged[answerKey]
    const selection = Array.isArray(current)
      ? current
      : current === undefined || current === null || current === ''
        ? []
        : [current]
    merged[answerKey] = [...selection, `${OTHER_PREFIX}${otherOptionLabel(block.attributes)} : ${text}`]
  }

  return merged
}

// Retire le complément d'une réponse pour ne compter que la sélection (statistiques). Le complément
// est toujours ajouté en dernier : sous forme résolue (`"A, Commentaire : …"`), tout ce qui suit
// son libellé lui appartient, virgules comprises.
export function stripChoiceComplement(value: any, attributes: OtherAttributes | undefined): any {
  if (!isComplementMode(attributes)) return value
  const marker = `${otherOptionLabel(attributes)} : `

  if (Array.isArray(value)) {
    return value.filter((v) => !(typeof v === 'string' && v.startsWith(`${OTHER_PREFIX}${marker}`)))
  }
  if (typeof value !== 'string') return value

  if (value.startsWith(marker) || value.startsWith(`${OTHER_PREFIX}${marker}`)) return ''
  const index = value.indexOf(`, ${marker}`)
  return index >= 0 ? value.slice(0, index) : value
}

// Identifiants et attributs ARIA du rendu public, au même titre que `form-options.ts` :
// aucune dépendance serveur, pour que les composants `'use client'` du formulaire les importent.
//
// Un formulaire conversationnel n'affiche qu'une question à la fois : le lien entre l'intitulé,
// la description, le message d'erreur et le contrôle ne peut pas reposer sur la proximité
// visuelle, il doit être déclaré. Ces fonctions sont la seule source de ces identifiants, pour
// qu'un `aria-describedby` ne puisse pas désigner un identifiant que personne n'écrit.

export function labelId(blockId: string): string {
  return `fb-label-${blockId}`
}

export function descId(blockId: string): string {
  return `fb-desc-${blockId}`
}

export function errorId(blockId: string): string {
  return `fb-error-${blockId}`
}

export function fieldId(blockId: string): string {
  return `fb-field-${blockId}`
}

export function hintId(blockId: string): string {
  return `fb-hint-${blockId}`
}

// `aria-describedby` accepte une liste d'identifiants séparés par des espaces, mais pas une
// chaîne vide : elle désignerait un élément inexistant et certains lecteurs d'écran annoncent
// alors « vide » à la place de la description.
export function describedBy(...ids: Array<string | false | null | undefined>): string | undefined {
  const kept = ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
  return kept.length > 0 ? kept.join(' ') : undefined
}

// Types de blocs dont le contrôle est un élément de formulaire natif unique : leur intitulé peut
// être un `<label for>`. Les autres (choix, quantité, signature, fichier, plage de dates) sont
// composés de plusieurs éléments ou de boutons : leur intitulé est un `<span id>` désigné par
// l'`aria-labelledby` d'un conteneur `role="group"` / `role="radiogroup"`.
const NATIVE_LABEL_TYPES = new Set([
  'short-text',
  'email',
  'number',
  'website',
  'phone',
  'long-text',
  'address',
  'dropdown',
  'date',
  'slider',
])

export function usesNativeLabel(blockType: string): boolean {
  return NATIVE_LABEL_TYPES.has(blockType)
}

export interface FieldA11y {
  id?: string
  'aria-labelledby'?: string
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  'aria-required'?: true
}

interface FieldA11yInput {
  blockId: string
  label?: string
  hideLabel?: boolean
  required?: boolean
  hasDescription?: boolean
  hasError?: boolean
  hasHint?: boolean
  withId?: boolean
}

// Un intitulé masqué visuellement reste un intitulé : `hideLabel` retire le `<h2>` du document,
// donc l'`aria-labelledby` ne désigne plus rien et la question doit repasser par `aria-label`.
export function fieldA11y({
  blockId,
  label,
  hideLabel,
  required,
  hasDescription,
  hasError,
  hasHint,
  withId = true,
}: FieldA11yInput): FieldA11y {
  const described = describedBy(
    hasDescription && descId(blockId),
    hasHint && hintId(blockId),
    hasError && errorId(blockId)
  )

  return {
    ...(withId ? { id: fieldId(blockId) } : {}),
    ...(hideLabel
      ? label
        ? { 'aria-label': label }
        : {}
      : { 'aria-labelledby': labelId(blockId) }),
    ...(described ? { 'aria-describedby': described } : {}),
    ...(hasError ? { 'aria-invalid': true as const } : {}),
    ...(required ? { 'aria-required': true as const } : {}),
  }
}
